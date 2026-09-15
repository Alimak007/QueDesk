import { ROLES, USER_STATUS } from '../../constants/index.js';
import { ApiError } from '../../utils/ApiError.js';
import { buildPage, escapeRegex, getPagination } from '../../utils/pagination.js';
import { DailyStatus } from '../daily-status/dailyStatus.model.js';
import { Leave } from '../leaves/leave.model.js';
import { Lead } from '../sales/lead.model.js';
import { nextSequence } from './counter.model.js';
import { User } from './user.model.js';

async function generateEmployeeId() {
  // Skip any IDs that were entered manually and collide with the sequence.
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const seq = await nextSequence('employeeId');
    const candidate = `EMP-${String(seq).padStart(4, '0')}`;
    if (!(await User.exists({ employeeId: candidate }))) return candidate;
  }
  throw new ApiError(500, 'Could not generate a unique employee ID');
}

async function assertAnotherActiveAdminExists(excludeUserId) {
  const count = await User.countDocuments({
    _id: { $ne: excludeUserId },
    role: ROLES.ADMIN,
    status: USER_STATUS.ACTIVE,
  });
  if (count === 0) {
    throw ApiError.conflict('At least one active admin is required. Promote another user first.');
  }
}

export async function listUsers(query) {
  const { search, department, role, status, sortBy, sortOrder } = query;
  const filter = {};

  if (department) filter.department = department;
  if (role) filter.role = role;
  if (status) filter.status = status;
  if (search) {
    const rx = new RegExp(escapeRegex(search), 'i');
    filter.$or = [
      { firstName: rx },
      { lastName: rx },
      { email: rx },
      { employeeId: rx },
      { designation: rx },
    ];
  }

  const { page, limit, skip } = getPagination(query);
  const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1, _id: 1 };

  const [items, total] = await Promise.all([
    User.find(filter).sort(sort).skip(skip).limit(limit),
    User.countDocuments(filter),
  ]);

  return buildPage(items, total, { page, limit });
}

export async function getUser(id) {
  const user = await User.findById(id);
  if (!user) throw ApiError.notFound('Employee not found');
  return user;
}

export async function createUser({ password, employeeId, ...data }) {
  if (await User.exists({ email: data.email })) {
    throw ApiError.conflict('An employee with this email already exists', {
      details: [{ path: 'email', message: 'This email is already in use' }],
    });
  }
  if (employeeId && (await User.exists({ employeeId: employeeId.toUpperCase() }))) {
    throw ApiError.conflict('This employee ID is already in use', {
      details: [{ path: 'employeeId', message: 'This employee ID is already in use' }],
    });
  }

  const user = new User({ ...data, employeeId: employeeId || (await generateEmployeeId()) });
  await user.setPassword(password);
  await user.save();
  return user;
}

export async function updateUser(id, updates, actor) {
  const user = await getUser(id);

  if (updates.role && updates.role !== user.role && user.role === ROLES.ADMIN) {
    if (user.id === actor.id) throw ApiError.conflict('You cannot change your own role');
    await assertAnotherActiveAdminExists(user._id);
  }

  if (updates.email && updates.email !== user.email && (await User.exists({ email: updates.email }))) {
    throw ApiError.conflict('An employee with this email already exists', {
      details: [{ path: 'email', message: 'This email is already in use' }],
    });
  }

  const roleChanged = updates.role && updates.role !== user.role;
  Object.assign(user, updates);
  if (roleChanged) user.tokenVersion += 1;
  await user.save();
  return user;
}

export async function setUserStatus(id, status, actor) {
  const user = await getUser(id);
  if (user.status === status) return user;

  if (status === USER_STATUS.INACTIVE) {
    if (user.id === actor.id) throw ApiError.conflict('You cannot deactivate your own account');
    if (user.role === ROLES.ADMIN) await assertAnotherActiveAdminExists(user._id);
    user.deactivatedAt = new Date();
    user.tokenVersion += 1; // Sign the user out everywhere.
  } else {
    user.deactivatedAt = null;
  }

  user.status = status;
  await user.save();
  return user;
}

export async function resetPassword(id, password) {
  const user = await getUser(id);
  await user.setPassword(password);
  user.tokenVersion += 1;
  await user.save();
  return user;
}

/**
 * Permanently deletes an employee only when they have no historical records.
 * Otherwise the caller is asked to deactivate instead so history is preserved.
 */
export async function deleteUser(id, actor) {
  const user = await getUser(id);
  if (user.id === actor.id) throw ApiError.conflict('You cannot delete your own account');
  if (user.role === ROLES.ADMIN && user.status === USER_STATUS.ACTIVE) {
    await assertAnotherActiveAdminExists(user._id);
  }

  const [leaves, reports, leads] = await Promise.all([
    Leave.countDocuments({ employee: user._id }),
    DailyStatus.countDocuments({ employee: user._id }),
    Lead.countDocuments({ $or: [{ owner: user._id }, { createdBy: user._id }] }),
  ]);

  if (leaves + reports + leads > 0) {
    throw ApiError.conflict(
      'This employee has historical records (leaves, status reports or sales leads). Deactivate the account instead to preserve history.',
      { code: 'HAS_HISTORY' },
    );
  }

  await user.deleteOne();
}

export async function getUserHistorySummary(id) {
  const user = await getUser(id);
  const [leaves, reports, leads] = await Promise.all([
    Leave.countDocuments({ employee: user._id }),
    DailyStatus.countDocuments({ employee: user._id }),
    Lead.countDocuments({ owner: user._id }),
  ]);
  return { leaves, reports, leads };
}

export async function listDepartments() {
  const departments = await User.distinct('department');
  return departments.filter(Boolean).sort((a, b) => a.localeCompare(b));
}

/**
 * Minimal, non-sensitive directory used by shared modules (e.g. Sales owner
 * pickers). Deliberately excludes email, phone and other personal details.
 */
export async function listDirectory() {
  return User.find({ status: USER_STATUS.ACTIVE })
    .select('firstName lastName designation department')
    .sort({ firstName: 1, lastName: 1 })
    .lean()
    .then((users) =>
      users.map((u) => ({
        id: u._id.toString(),
        fullName: [u.firstName, u.lastName].filter(Boolean).join(' '),
        designation: u.designation,
        department: u.department,
      })),
    );
}
