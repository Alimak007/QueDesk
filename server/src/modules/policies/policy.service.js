import { POLICY_STATUS, ROLES, USER_STATUS } from '../../constants/index.js';
import { ApiError } from '../../utils/ApiError.js';
import { escapeRegex } from '../../utils/pagination.js';
import { isAdmin } from '../../utils/scope.js';
import { audit } from '../audit/audit.service.js';
import { User } from '../users/user.model.js';
import { Policy } from './policy.model.js';
import { PolicyAcceptance } from './policyAcceptance.model.js';

const POPULATE = [
  { path: 'createdBy', select: 'firstName lastName' },
  { path: 'updatedBy', select: 'firstName lastName' },
];

const fullName = (u) => [u?.firstName, u?.lastName].filter(Boolean).join(' ');

/** Published policies meant for this person: company-wide ones plus their department's. */
function applicableFilter(user) {
  return {
    status: POLICY_STATUS.PUBLISHED,
    $or: [{ departments: { $size: 0 } }, ...(user.department ? [{ departments: user.department }] : [])],
  };
}

const appliesTo = (policy, employee) => !policy.departments.length || policy.departments.includes(employee.department);

/**
 * Policies this person still has to accept: published, required, meant for
 * them, and not yet accepted in their current version. Admins write the
 * policies, so they are never asked.
 */
export async function listPendingPolicies(user, { select } = {}) {
  if (isAdmin(user)) return [];
  const query = Policy.find({ ...applicableFilter(user), requiresAcceptance: true }).sort({ createdAt: 1 });
  const policies = select ? await query.select(select).lean() : await query;
  if (!policies.length) return [];

  const accepted = await PolicyAcceptance.find({ user: user._id, policy: { $in: policies.map((p) => p._id) } })
    .select('policy version')
    .lean();
  const done = new Set(accepted.map((a) => `${a.policy}:${a.version}`));
  return policies.filter((p) => !done.has(`${p._id}:${p.version}`));
}

/** Cheap check used on every request from an employee. */
export async function hasPendingPolicies(user) {
  return (await listPendingPolicies(user, { select: '_id version' })).length > 0;
}

/** How many of the active employees a policy applies to have accepted its current version. */
async function attachStats(policies) {
  if (!policies.length) return [];
  const [employees, acceptances] = await Promise.all([
    User.find({ role: ROLES.EMPLOYEE, status: USER_STATUS.ACTIVE }).select('department').lean(),
    PolicyAcceptance.find({ policy: { $in: policies.map((p) => p._id) } }).select('policy user version').lean(),
  ]);
  const accepted = new Set(acceptances.map((a) => `${a.policy}:${a.version}:${a.user}`));

  return policies.map((policy) => {
    const audience = employees.filter((e) => appliesTo(policy, e));
    return {
      ...policy.toJSON(),
      stats: {
        audience: audience.length,
        accepted: audience.filter((e) => accepted.has(`${policy._id}:${policy.version}:${e._id}`)).length,
      },
    };
  });
}

/** The person's latest acceptance of each policy, and whether it covers the current version. */
async function attachOwnAcceptance(policies, user) {
  const acceptances = await PolicyAcceptance.find({ user: user._id, policy: { $in: policies.map((p) => p._id) } })
    .sort({ version: -1 })
    .lean();
  return policies.map((policy) => {
    const latest = acceptances.find((a) => String(a.policy) === String(policy._id));
    return {
      ...policy.toJSON(),
      acceptance: latest
        ? { version: latest.version, acceptedAt: latest.acceptedAt, current: latest.version === policy.version }
        : null,
    };
  });
}

export async function listPolicies(query, actor) {
  if (!isAdmin(actor)) {
    const policies = await Policy.find(applicableFilter(actor)).sort({ title: 1 });
    return attachOwnAcceptance(policies, actor);
  }

  const filter = {};
  if (query.status) filter.status = query.status;
  if (query.category) filter.category = query.category;
  if (query.search) filter.title = new RegExp(escapeRegex(query.search), 'i');
  const policies = await Policy.find(filter).sort({ updatedAt: -1 }).populate(POPULATE);
  return attachStats(policies);
}

/** Employees only ever see published policies meant for them; anything else is "not found". */
export async function getPolicy(id, actor) {
  if (!isAdmin(actor)) {
    const policy = await Policy.findOne({ _id: id, ...applicableFilter(actor) });
    if (!policy) throw ApiError.notFound('Policy not found');
    return (await attachOwnAcceptance([policy], actor))[0];
  }
  const policy = await Policy.findById(id).populate(POPULATE);
  if (!policy) throw ApiError.notFound('Policy not found');
  return (await attachStats([policy]))[0];
}

export async function createPolicy({ publish, ...data }, actor) {
  const now = new Date();
  const policy = await Policy.create({
    ...data,
    status: publish ? POLICY_STATUS.PUBLISHED : POLICY_STATUS.DRAFT,
    publishedAt: publish ? now : null,
    versionDate: publish ? now : null,
    createdBy: actor._id,
    updatedBy: actor._id,
  });
  await audit(
    actor,
    publish ? 'policy.published' : 'policy.created',
    'policy',
    policy._id,
    `${publish ? 'Published' : 'Drafted'} policy “${policy.title}”`,
  );
  return getPolicy(policy.id, actor);
}

/**
 * Edits a policy. A published policy keeps its acceptances for small fixes;
 * `newVersion` marks a change that everyone it applies to must accept again.
 */
export async function updatePolicy(id, { newVersion, publish, ...data }, actor) {
  const policy = await Policy.findById(id);
  if (!policy) throw ApiError.notFound('Policy not found');

  Object.assign(policy, data, { updatedBy: actor._id });
  const now = new Date();
  const bumped = Boolean(newVersion && policy.publishedAt);
  if (bumped) {
    policy.version += 1;
    policy.versionDate = now;
  }
  if (publish && policy.status !== POLICY_STATUS.PUBLISHED) {
    policy.status = POLICY_STATUS.PUBLISHED;
    policy.publishedAt ??= now;
    policy.versionDate ??= now;
  }
  await policy.save();

  await audit(
    actor,
    'policy.updated',
    'policy',
    policy._id,
    bumped
      ? `Updated policy “${policy.title}” to version ${policy.version}; everyone must accept it again`
      : `Updated policy “${policy.title}”`,
  );
  return getPolicy(policy.id, actor);
}

export async function setPolicyStatus(id, status, actor) {
  const policy = await Policy.findById(id);
  if (!policy) throw ApiError.notFound('Policy not found');
  if (policy.status === status) throw ApiError.conflict(`This policy is already ${status}`);
  if (status === POLICY_STATUS.ARCHIVED && policy.status !== POLICY_STATUS.PUBLISHED) {
    throw ApiError.conflict('Only a published policy can be archived. Delete a draft instead.');
  }

  policy.status = status;
  policy.updatedBy = actor._id;
  if (status === POLICY_STATUS.PUBLISHED) {
    const now = new Date();
    policy.publishedAt ??= now;
    policy.versionDate ??= now;
  }
  await policy.save();

  const verb = status === POLICY_STATUS.PUBLISHED ? 'Published' : 'Archived';
  await audit(actor, `policy.${status}`, 'policy', policy._id, `${verb} policy “${policy.title}”`);
  return getPolicy(policy.id, actor);
}

/** Once anyone has accepted a policy it is kept as a record; it can be archived instead. */
export async function deletePolicy(id, actor) {
  const policy = await Policy.findById(id);
  if (!policy) throw ApiError.notFound('Policy not found');
  if (await PolicyAcceptance.exists({ policy: policy._id })) {
    throw ApiError.conflict(
      'Employees have already accepted this policy. Archive it instead, so the record of who accepted it is kept.',
    );
  }
  await policy.deleteOne();
  await audit(actor, 'policy.deleted', 'policy', policy._id, `Deleted policy “${policy.title}”`);
}

/** Every active employee the policy applies to, with where they stand on its current version. */
export async function listAcceptances(id) {
  const policy = await Policy.findById(id);
  if (!policy) throw ApiError.notFound('Policy not found');

  const [employees, acceptances] = await Promise.all([
    User.find({ role: ROLES.EMPLOYEE, status: USER_STATUS.ACTIVE })
      .select('firstName lastName email employeeId department designation')
      .sort({ firstName: 1, lastName: 1 })
      .lean(),
    PolicyAcceptance.find({ policy: policy._id }).sort({ version: -1 }).lean(),
  ]);

  const items = employees
    .filter((e) => appliesTo(policy, e))
    .map(({ _id, ...employee }) => {
      const latest = acceptances.find((a) => String(a.user) === String(_id));
      const status = !latest ? 'pending' : latest.version === policy.version ? 'accepted' : 'outdated';
      return {
        employee: { id: String(_id), ...employee, name: fullName(employee) },
        status,
        acceptedAt: latest?.acceptedAt ?? null,
        acceptedVersion: latest?.version ?? null,
      };
    });

  return { version: policy.version, requiresAcceptance: policy.requiresAcceptance, status: policy.status, items };
}

/**
 * Records the person's agreement to the policies they were shown. Each one has
 * to be pending for them right now, in the version they read, so a policy that
 * changed while they were reading is never accepted unseen.
 */
export async function acceptPolicies(user, { policies }) {
  const pending = await listPendingPolicies(user);
  const byId = new Map(pending.map((p) => [p.id, p]));

  for (const { id, version } of policies) {
    const policy = byId.get(id);
    if (!policy || policy.version !== version) {
      throw ApiError.conflict(
        'One of these policies has changed or is no longer waiting for you. Reload the page to read the latest version.',
        { code: 'POLICY_CHANGED' },
      );
    }
  }

  try {
    await PolicyAcceptance.insertMany(
      policies.map(({ id, version }) => ({ policy: id, user: user._id, version })),
      { ordered: false },
    );
  } catch (err) {
    // Accepting twice (a double click, a second tab) is harmless.
    const duplicatesOnly = err?.code === 11000 || err?.writeErrors?.every((e) => e.code === 11000);
    if (!duplicatesOnly) throw err;
  }

  return { pending: (await listPendingPolicies(user)).length };
}
