/**
 * End-to-end API tests for the security-critical rules in the spec:
 * data privacy (§6.3, §7.3, §13), role-based access (§15), the dynamic Sales
 * form (§11) and employee deletion (§17 rule 8).
 *
 * Runs against a disposable in-memory MongoDB: no network, no credentials,
 * and no chance of touching real data.
 */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

process.env.NODE_ENV = 'test';

const { default: mongoose } = await import('mongoose');
const { default: request } = await import('supertest');
const { startTestDatabase, stopTestDatabase } = await import('./helpers.js');
const { createApp } = await import('../src/app.js');
const { runMigrations } = await import('../src/config/migrations.js');
await import('../src/models.js');
const { createUser } = await import('../src/modules/users/user.service.js');

const PASSWORD = 'Passw0rd!';

let app;
const agents = {};
const ids = {};

/** Next weekday on or after `offset` days from today, as YYYY-MM-DD. */
function workday(offset) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

function nextSaturday() {
  const d = new Date();
  d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7 || 7));
  return d.toISOString().slice(0, 10);
}

/** A Thursday far enough ahead not to clash with the other fixtures. */
function nextThursday() {
  const d = new Date();
  d.setDate(d.getDate() + 60 + ((4 - ((d.getDay() + 60) % 7) + 7) % 7));
  return d.toISOString().slice(0, 10);
}

function addDays(dateOnly, days) {
  const d = new Date(`${dateOnly}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function signIn(email) {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/login').send({ email, password: PASSWORD });
  assert.equal(res.status, 200, `login failed for ${email}: ${JSON.stringify(res.body)}`);
  return agent;
}

before(async () => {
  await startTestDatabase();
  await runMigrations();
  app = createApp();

  const admin = await createUser({ firstName: 'Ada', lastName: 'Admin', email: 'admin@test.io', password: PASSWORD, role: 'admin' });
  const alice = await createUser({ firstName: 'Alice', email: 'alice@test.io', password: PASSWORD, phone: '+91 90000 00001' });
  const bob = await createUser({ firstName: 'Bob', email: 'bob@test.io', password: PASSWORD });
  Object.assign(ids, { admin: admin.id, alice: alice.id, bob: bob.id });

  agents.admin = await signIn('admin@test.io');
  agents.alice = await signIn('alice@test.io');
  agents.bob = await signIn('bob@test.io');
});

after(async () => {
  await stopTestDatabase();
});

describe('authentication', () => {
  test('rejects wrong credentials without revealing which part was wrong', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'alice@test.io', password: 'nope-nope1' });
    assert.equal(res.status, 401);
    assert.equal(res.body.error.message, 'Invalid email or password');
  });

  test('rejects NoSQL operator injection in the login body', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: { $ne: null }, password: { $ne: null } });
    assert.equal(res.status, 400);
  });

  test('session probe returns null when signed out and never leaks the password hash', async () => {
    const anon = await request(app).get('/api/auth/session');
    assert.equal(anon.status, 200);
    assert.equal(anon.body.data.user, null);

    const me = await agents.alice.get('/api/auth/me');
    assert.equal(me.body.data.user.email, 'alice@test.io');
    assert.equal(me.body.data.user.passwordHash, undefined);
    assert.equal(me.body.data.user.tokenVersion, undefined);
  });

  test('protected routes require a session', async () => {
    const res = await request(app).get('/api/leaves');
    assert.equal(res.status, 401);
  });
});

describe('leave privacy and workflow', () => {
  let aliceLeave;

  test('employee applies for leave; a single day counts as one', async () => {
    const res = await agents.alice.post('/api/leaves').send({
      type: 'casual',
      startDate: workday(14),
      endDate: workday(14),
      reason: 'Personal work',
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.data.leave.status, 'pending');
    assert.equal(res.body.data.leave.days, 1);
    aliceLeave = res.body.data.leave;
  });

  test('Saturdays and Sundays are not counted', async () => {
    // Thursday to Monday spans five dates but only three working days.
    const thursday = nextThursday();
    const res = await agents.bob.post('/api/leaves').send({
      type: 'sick',
      startDate: thursday,
      endDate: addDays(thursday, 4),
      reason: 'Unwell',
    });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.equal(res.body.data.leave.days, 3, 'Thu, Fri and Mon count; Sat and Sun do not');
    await agents.bob.delete(`/api/leaves/${res.body.data.leave.id}`);
  });

  test('a company holiday still counts as leave', async () => {
    // Only weekends are skipped: a holiday inside the range must not shrink it.
    const monday = addDays(nextThursday(), 4);
    const holiday = await agents.admin.post('/api/events').send({
      title: 'Founders Day',
      type: 'holiday',
      startDate: addDays(monday, 1),
      endDate: addDays(monday, 1),
    });
    assert.equal(holiday.status, 201, JSON.stringify(holiday.body));

    const res = await agents.bob.post('/api/leaves').send({
      type: 'casual',
      startDate: addDays(monday, 1),
      endDate: addDays(monday, 2),
      reason: 'Away',
    });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.equal(res.body.data.leave.days, 2, 'both weekdays count even though one is a holiday');
    await agents.bob.delete(`/api/leaves/${res.body.data.leave.id}`);
    await agents.admin.delete(`/api/events/${holiday.body.data.event.id}`);
  });

  test('a weekend-only request is rejected', async () => {
    const saturday = nextSaturday();
    const res = await agents.bob.post('/api/leaves').send({ type: 'casual', startDate: saturday, endDate: saturday, reason: 'Weekend' });
    assert.equal(res.status, 400);
    assert.match(res.body.error.message, /weekend/i);
  });

  test('a half day is half a day however long the range', async () => {
    const day = workday(40);
    const res = await agents.bob.post('/api/leaves').send({
      type: 'casual',
      startDate: day,
      endDate: day,
      reason: 'Appointment',
      isHalfDay: true,
      halfDaySession: 'first_half',
    });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.equal(res.body.data.leave.days, 0.5);
    await agents.bob.delete(`/api/leaves/${res.body.data.leave.id}`);
  });

  test('overlapping requests are rejected', async () => {
    const res = await agents.alice.post('/api/leaves').send({
      type: 'sick',
      startDate: aliceLeave.startDate,
      endDate: aliceLeave.endDate,
      reason: 'Overlap',
    });
    assert.equal(res.status, 409);
  });

  test("an employee cannot list, read, edit or cancel another employee's leave", async () => {
    // Asking for Alice's leave returns Bob's own records, never hers.
    const list = await agents.bob.get('/api/leaves').query({ employee: ids.alice });
    assert.equal(list.status, 200);
    assert.ok(
      list.body.data.items.every((l) => String(l.employee?.id ?? l.employee) === String(ids.bob)),
      'employee filter must not widen scope',
    );

    assert.equal((await agents.bob.get(`/api/leaves/${aliceLeave.id}`)).status, 404);
    const edit = await agents.bob.put(`/api/leaves/${aliceLeave.id}`).send({
      type: 'casual',
      startDate: aliceLeave.startDate,
      endDate: aliceLeave.endDate,
      reason: 'hijack',
    });
    assert.equal(edit.status, 404);
    assert.equal((await agents.bob.patch(`/api/leaves/${aliceLeave.id}/cancel`)).status, 404);
  });

  test('employees cannot approve leave; admins see everything and can', async () => {
    const denied = await agents.alice.patch(`/api/leaves/${aliceLeave.id}/review`).send({ status: 'approved' });
    assert.equal(denied.status, 403);

    const all = await agents.admin.get('/api/leaves');
    assert.ok(all.body.data.items.some((l) => l.id === aliceLeave.id));

    const approved = await agents.admin.patch(`/api/leaves/${aliceLeave.id}/review`).send({ status: 'approved', reviewNote: 'Enjoy' });
    assert.equal(approved.status, 200);
    assert.equal(approved.body.data.leave.status, 'approved');
  });

  test('approval notifies the employee', async () => {
    const res = await agents.alice.get('/api/notifications');
    assert.ok(res.body.data.items.some((n) => n.type === 'leave_approved'));
    const bob = await agents.bob.get('/api/notifications');
    assert.equal(bob.body.data.items.length, 0);
  });

  test('employees can no longer edit an approved leave, but can cancel it before it starts', async () => {
    const edit = await agents.alice.put(`/api/leaves/${aliceLeave.id}`).send({
      type: 'sick',
      startDate: aliceLeave.startDate,
      endDate: aliceLeave.endDate,
      reason: 'Changed my mind',
    });
    assert.equal(edit.status, 409);

    const cancel = await agents.alice.patch(`/api/leaves/${aliceLeave.id}/cancel`);
    assert.equal(cancel.status, 200);
    assert.equal(cancel.body.data.leave.status, 'cancelled');
  });
});

describe('leave entitlements and balances', () => {
  const year = new Date().getFullYear();
  let carol;
  let carolAgent;

  const balanceFor = async (agent, type, employee) => {
    const res = await agent.get('/api/leaves/balances').query(employee ? { employee } : {});
    assert.equal(res.status, 200, JSON.stringify(res.body));
    return res.body.data.types.find((t) => t.type === type);
  };

  test('an admin sets each leave type when adding an employee', async () => {
    const res = await agents.admin.post('/api/employees').send({
      firstName: 'Carol',
      lastName: 'Ng',
      email: 'carol@quedesk.test',
      password: PASSWORD,
      role: 'employee',
      leaveEntitlements: { casual: 10, sick: 3, wfh: 5, earned: 0, unpaid: null, other: null },
    });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    carol = res.body.data.user.id;
    assert.equal(res.body.data.user.leaveEntitlements.casual, 10);
    assert.equal(res.body.data.user.leaveEntitlements.sick, 3);
    assert.equal(res.body.data.user.leaveEntitlements.wfh, 5);
    carolAgent = await signIn('carol@quedesk.test');
  });

  test('WFH is a leave type like any other', async () => {
    const res = await carolAgent.post('/api/leaves').send({
      type: 'wfh',
      startDate: workday(100),
      endDate: workday(100),
      reason: 'Plumber visiting',
    });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.equal(res.body.data.leave.type, 'wfh');
    await carolAgent.delete(`/api/leaves/${res.body.data.leave.id}`);
  });

  test('a fresh employee has spent nothing', async () => {
    const casual = await balanceFor(carolAgent, 'casual');
    assert.deepEqual(casual, { type: 'casual', allowed: 10, used: 0, pending: 0, remaining: 10 });
  });

  test('a pending request is not deducted; approving it is', async () => {
    const apply = await carolAgent.post('/api/leaves').send({
      type: 'casual',
      startDate: `${year}-11-02`,
      endDate: `${year}-11-04`,
      reason: 'Family function',
    });
    assert.equal(apply.status, 201, JSON.stringify(apply.body));
    const leaveId = apply.body.data.leave.id;
    assert.equal(apply.body.data.leave.days, 3);

    const whilePending = await balanceFor(carolAgent, 'casual');
    assert.equal(whilePending.used, 0, 'pending leave must not spend the allowance');
    assert.equal(whilePending.pending, 3);
    assert.equal(whilePending.remaining, 10);

    await agents.admin.patch(`/api/leaves/${leaveId}/review`).send({ status: 'approved' });
    const afterApproval = await balanceFor(carolAgent, 'casual');
    assert.equal(afterApproval.used, 3);
    assert.equal(afterApproval.remaining, 7, '10 - 3 = 7');
    assert.equal(afterApproval.pending, 0);
  });

  test('rejecting leaves the balance untouched', async () => {
    const apply = await carolAgent.post('/api/leaves').send({
      type: 'sick',
      startDate: `${year}-11-10`,
      endDate: `${year}-11-11`,
      reason: 'Flu',
    });
    const leaveId = apply.body.data.leave.id;

    await agents.admin.patch(`/api/leaves/${leaveId}/review`).send({ status: 'rejected', reviewNote: 'Send a certificate' });
    const sick = await balanceFor(carolAgent, 'sick');
    assert.equal(sick.used, 0, 'a rejected request spends nothing');
    assert.equal(sick.remaining, 3, 'the full allowance is still there');
  });

  test('an approval that is later reversed gives the days back', async () => {
    const apply = await carolAgent.post('/api/leaves').send({
      type: 'wfh',
      startDate: `${year}-11-16`,
      endDate: `${year}-11-17`,
      reason: 'Working from home',
    });
    const leaveId = apply.body.data.leave.id;

    await agents.admin.patch(`/api/leaves/${leaveId}/review`).send({ status: 'approved' });
    assert.equal((await balanceFor(carolAgent, 'wfh')).remaining, 3, '5 - 2 = 3');

    await agents.admin.patch(`/api/leaves/${leaveId}/review`).send({ status: 'rejected' });
    assert.equal((await balanceFor(carolAgent, 'wfh')).remaining, 5, 'reversing the approval restores the balance');
  });

  test('uncapped types are tracked but never run out', async () => {
    const unpaid = await balanceFor(carolAgent, 'unpaid');
    assert.equal(unpaid.allowed, null);
    assert.equal(unpaid.remaining, null);
  });

  test('an employee sees only their own balance', async () => {
    assert.equal((await carolAgent.get('/api/leaves/balances').query({ employee: ids.alice })).status, 403);

    // An approver may look at anyone's.
    const mine = await balanceFor(agents.admin, 'casual', carol);
    assert.equal(mine.allowed, 10);
    assert.equal(mine.used, 3);
  });

  test('entitlements can be changed later without touching what was taken', async () => {
    const res = await agents.admin.patch(`/api/employees/${carol}`).send({ leaveEntitlements: { casual: 15 } });
    assert.equal(res.status, 200, JSON.stringify(res.body));

    const casual = await balanceFor(carolAgent, 'casual');
    assert.equal(casual.allowed, 15);
    assert.equal(casual.used, 3, 'days already taken are unchanged');
    assert.equal(casual.remaining, 12);
  });
});

describe('daily status privacy', () => {
  let report;

  test('one report per employee per day', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const first = await agents.alice.post('/api/daily-status').send({ date: today, workDone: 'Built the API' });
    assert.equal(first.status, 201);
    report = first.body.data.report;

    const dup = await agents.alice.post('/api/daily-status').send({ date: today, workDone: 'Again' });
    assert.equal(dup.status, 409);
  });

  test('future dates are rejected', async () => {
    const res = await agents.alice.post('/api/daily-status').send({ date: workday(3), workDone: 'Time travel' });
    assert.equal(res.status, 400);
  });

  test("another employee cannot see or edit the report; the team board is admin-only", async () => {
    const list = await agents.bob.get('/api/daily-status');
    assert.equal(list.body.data.items.length, 0);
    assert.equal((await agents.bob.get(`/api/daily-status/${report.id}`)).status, 404);
    assert.equal((await agents.bob.put(`/api/daily-status/${report.id}`).send({ workDone: 'hijack' })).status, 404);
    assert.equal((await agents.bob.get('/api/daily-status/team')).status, 403);
  });

  test('admins can read and edit any report', async () => {
    const edit = await agents.admin.put(`/api/daily-status/${report.id}`).send({ workDone: 'Built the API (edited)' });
    assert.equal(edit.status, 200);
    const board = await agents.admin.get('/api/daily-status/team');
    assert.equal(board.body.data.stats.submitted, 1);
  });
});

describe('calendar permissions', () => {
  const event = { title: 'Town hall', type: 'meeting', startDate: workday(5), endDate: workday(5), isAllDay: true };

  test('employees can read but not change the calendar', async () => {
    assert.equal((await agents.alice.post('/api/events').send(event)).status, 403);
    const created = await agents.admin.post('/api/events').send(event);
    assert.equal(created.status, 201);

    const list = await agents.alice.get('/api/events').query({ from: event.startDate, to: event.endDate });
    assert.equal(list.body.data.items.length, 1);
    assert.equal((await agents.alice.delete(`/api/events/${created.body.data.event.id}`)).status, 403);
  });
});

describe('employee management', () => {
  test('employees cannot manage employees; the shared directory hides contact details', async () => {
    assert.equal((await agents.alice.get('/api/employees')).status, 403);
    const directory = await agents.alice.get('/api/employees/directory');
    assert.equal(directory.status, 200);
    for (const person of directory.body.data.items) {
      assert.equal(person.email, undefined);
      assert.equal(person.phone, undefined);
    }
  });

  test('employees with history cannot be hard-deleted', async () => {
    const res = await agents.admin.delete(`/api/employees/${ids.alice}`);
    assert.equal(res.status, 409);
    assert.equal(res.body.error.code, 'HAS_HISTORY');
  });

  test('admins cannot deactivate themselves', async () => {
    const res = await agents.admin.patch(`/api/employees/${ids.admin}/status`).send({ status: 'inactive' });
    assert.equal(res.status, 409);
  });

  test('deactivating an employee revokes their session immediately', async () => {
    const carl = await agents.admin.post('/api/employees').send({ firstName: 'Carl', email: 'carl@test.io', password: PASSWORD });
    assert.equal(carl.status, 201);
    assert.match(carl.body.data.user.employeeId, /^EMP-\d{4}$/);

    const carlAgent = await signIn('carl@test.io');
    assert.equal((await carlAgent.get('/api/auth/me')).status, 200);

    await agents.admin.patch(`/api/employees/${carl.body.data.user.id}/status`).send({ status: 'inactive' });
    assert.equal((await carlAgent.get('/api/auth/me')).status, 401);

    const relogin = await request(app).post('/api/auth/login').send({ email: 'carl@test.io', password: PASSWORD });
    assert.equal(relogin.status, 403);

    // No history, so permanent deletion is allowed.
    assert.equal((await agents.admin.delete(`/api/employees/${carl.body.data.user.id}`)).status, 204);
  });
});

describe('sales: shared records and configurable form', () => {
  let lead;

  test('leads are validated against the configured fields', async () => {
    const missing = await agents.alice.post('/api/sales/leads').send({ data: { company: 'ABC' } });
    assert.equal(missing.status, 400);
    assert.equal(missing.body.error.details[0].path, 'data.leadName');

    const badEmail = await agents.alice.post('/api/sales/leads').send({ data: { leadName: 'X', email: 'not-an-email' } });
    assert.equal(badEmail.status, 400);

    const ok = await agents.alice.post('/api/sales/leads').send({ data: { leadName: 'Lead A', expectedValue: '1,500', leadStatus: 'bogus' } });
    assert.equal(ok.status, 400, 'unknown dropdown option must be rejected');

    const created = await agents.alice.post('/api/sales/leads').send({ data: { leadName: 'Lead A', expectedValue: '1,500' } });
    assert.equal(created.status, 201);
    assert.equal(created.body.data.lead.data.expectedValue, 1500);
    assert.equal(created.body.data.lead.data.leadStatus, 'new', 'default value applied');
    lead = created.body.data.lead;
  });

  test('leads are shared: another employee can see and edit them', async () => {
    const list = await agents.bob.get('/api/sales/leads');
    assert.ok(list.body.data.items.some((l) => l.id === lead.id));

    const moved = await agents.bob.patch(`/api/sales/leads/${lead.id}/move`).send({ value: 'won', position: 10 });
    assert.equal(moved.status, 200);
    assert.equal(moved.body.data.lead.data.leadStatus, 'won');
    assert.equal(moved.body.data.lead.data.leadName, 'Lead A', 'other values untouched');
  });

  test('only admins can configure fields, and new required fields apply immediately', async () => {
    assert.equal((await agents.alice.post('/api/sales/fields').send({ label: 'Industry', type: 'text' })).status, 403);

    const field = await agents.admin.post('/api/sales/fields').send({
      label: 'Industry',
      type: 'dropdown',
      required: true,
      options: [
        { value: 'tech', label: 'Technology' },
        { value: 'health', label: 'Healthcare' },
      ],
    });
    assert.equal(field.status, 201);
    assert.equal(field.body.data.field.key, 'industry');

    const config = await agents.alice.get('/api/sales/config');
    assert.ok(config.body.data.fields.some((f) => f.key === 'industry'), 'employees receive the new field');

    const without = await agents.alice.post('/api/sales/leads').send({ data: { leadName: 'Lead B' } });
    assert.equal(without.status, 400);
    const withIt = await agents.alice.post('/api/sales/leads').send({ data: { leadName: 'Lead B', industry: 'tech' } });
    assert.equal(withIt.status, 201);

    // Archiving keeps data but removes it from the form; a field with data cannot be deleted.
    assert.equal((await agents.admin.delete(`/api/sales/fields/${field.body.data.field.id}`)).status, 409);
    assert.equal((await agents.admin.patch(`/api/sales/fields/${field.body.data.field.id}/archive`)).status, 200);
    const afterArchive = await agents.alice.post('/api/sales/leads').send({ data: { leadName: 'Lead C' } });
    assert.equal(afterArchive.status, 201);
  });

  test('system fields cannot be archived and only admins delete leads', async () => {
    const { body } = await agents.admin.get('/api/sales/config');
    const status = body.data.fields.find((f) => f.key === 'leadStatus');
    assert.equal((await agents.admin.patch(`/api/sales/fields/${status.id}/archive`)).status, 409);

    assert.equal((await agents.alice.delete(`/api/sales/leads/${lead.id}`)).status, 403);
    assert.equal((await agents.admin.delete(`/api/sales/leads/${lead.id}`)).status, 204);
  });
});

describe('dashboards', () => {
  test('each role receives its own dashboard shape', async () => {
    const admin = await agents.admin.get('/api/dashboard');
    assert.equal(admin.body.data.role, 'admin');
    assert.ok('employees' in admin.body.data);

    const employee = await agents.bob.get('/api/dashboard');
    assert.equal(employee.body.data.role, 'employee');
    assert.equal(employee.body.data.employees, undefined, 'no organisation-wide people data for employees');
  });
});
