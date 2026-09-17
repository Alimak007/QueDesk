/**
 * Tests for the QueDesk modules added on top of the original portal:
 * companies, customers (including lead conversion), payslips, invoices,
 * module permissions and the audit log.
 */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

process.env.NODE_ENV = 'test';

const { default: request } = await import('supertest');
const { startTestDatabase, stopTestDatabase } = await import('./helpers.js');
const { createApp } = await import('../src/app.js');
const { runMigrations } = await import('../src/config/migrations.js');
await import('../src/models.js');
const { createUser } = await import('../src/modules/users/user.service.js');
const { Company } = await import('../src/modules/companies/company.model.js');
const { DEFAULT_COMPANIES } = await import('../src/scripts/defaultCompanies.js');

const PASSWORD = 'Passw0rd!';
const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489', 'hex');

let app;
const agents = {};
const ids = {};

async function signIn(email) {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/login').send({ email, password: PASSWORD });
  assert.equal(res.status, 200, `login failed for ${email}: ${JSON.stringify(res.body)}`);
  return agent;
}

/** Grants exactly these permissions to an employee (everything else removed). */
async function setPermissions(userId, permissions) {
  const res = await agents.admin.put(`/api/permissions/users/${userId}`).send({ permissions });
  assert.equal(res.status, 200, JSON.stringify(res.body));
}

before(async () => {
  await startTestDatabase();
  await runMigrations();
  app = createApp();

  const [uae, india] = await Company.insertMany(DEFAULT_COMPANIES);
  Object.assign(ids, { uae: uae.id, india: india.id });

  const admin = await createUser({ firstName: 'Ada', lastName: 'Admin', email: 'admin@test.io', password: PASSWORD, role: 'admin' });
  const emma = await createUser({ firstName: 'Emma', email: 'emma@test.io', password: PASSWORD, designation: 'Engineer' });
  Object.assign(ids, { admin: admin.id, emma: emma.id });

  agents.admin = await signIn('admin@test.io');
  agents.emma = await signIn('emma@test.io');
});

after(async () => {
  await stopTestDatabase();
});

describe('companies', () => {
  test('are admin-only to change and readable by document creators', async () => {
    const denied = await agents.emma.post('/api/companies').send({ name: 'Rogue Co' });
    assert.equal(denied.status, 403);

    // An employee with no document permissions cannot even read them.
    assert.equal((await agents.emma.get('/api/companies')).status, 403);

    await setPermissions(ids.emma, { invoices: ['view', 'create'] });
    const readable = await agents.emma.get('/api/companies');
    assert.equal(readable.status, 200);
    assert.equal(readable.body.data.items.length, 2);
  });

  test('reject uploads that are not really images', async () => {
    const bad = await agents.admin
      .post(`/api/companies/${ids.uae}/logo`)
      .attach('file', Buffer.from('this is not a png at all'), { filename: 'logo.png', contentType: 'image/png' });
    assert.equal(bad.status, 400);

    // A real image of an unsupported type is named in the message, not just refused.
    const webp = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBPVP8 '), Buffer.alloc(16)]);
    const wrongType = await agents.admin
      .post(`/api/companies/${ids.uae}/logo`)
      .attach('file', webp, { filename: 'logo.png', contentType: 'image/png' });
    assert.equal(wrongType.status, 400);
    assert.match(wrongType.body.error.message, /WEBP/);

    const good = await agents.admin
      .post(`/api/companies/${ids.uae}/logo`)
      .attach('file', PNG, { filename: 'logo.png', contentType: 'image/png' });
    assert.equal(good.status, 200);
    assert.equal(good.body.data.company.logo.format, 'png');
    assert.equal(good.body.data.company.logo.provider, 'database');

    const image = await agents.admin.get(`/api/companies/${ids.uae}/logo`);
    assert.equal(image.status, 200);
    assert.equal(image.headers['content-type'], 'image/png');
  });
});

describe('customers and lead conversion', () => {
  let leadId;
  let customerId;

  test('the customer form is configured separately from leads', async () => {
    const res = await agents.admin.get('/api/sales/config').query({ entity: 'customer' });
    assert.equal(res.status, 200);
    const keys = res.body.data.fields.map((f) => f.key);
    assert.ok(keys.includes('customerName') && keys.includes('billingAddress'));

    // The same key may exist for both entities without clashing.
    const leadKeys = (await agents.admin.get('/api/sales/config').query({ entity: 'lead' })).body.data.fields.map((f) => f.key);
    assert.ok(leadKeys.includes('leadName'));
    assert.ok(leadKeys.includes('company') && keys.includes('company'));
  });

  test('the Lead Status field has no Customer column', async () => {
    const res = await agents.admin.get('/api/sales/config').query({ entity: 'lead' });
    const status = res.body.data.fields.find((f) => f.key === 'leadStatus');
    assert.ok(status, 'Lead Status should exist');
    assert.equal(
      status.options.some((o) => o.value === 'customer'),
      false,
    );
  });

  test('converting a lead copies its details and is idempotent', async () => {
    const lead = await agents.admin.post('/api/sales/leads').send({
      data: { leadName: 'Website build', company: 'ABC Ltd', email: 'ops@abc.test', expectedValue: 5000 },
    });
    assert.equal(lead.status, 201);
    leadId = lead.body.data.lead.id;

    const first = await agents.admin.post(`/api/sales/leads/${leadId}/convert`);
    assert.equal(first.status, 201);
    assert.equal(first.body.data.created, true);
    customerId = first.body.data.customer.id;
    assert.equal(first.body.data.customer.data.customerName, 'Website build');
    assert.equal(first.body.data.customer.data.company, 'ABC Ltd');
    assert.equal(first.body.data.customer.source, 'lead');

    // Converting again returns the same customer rather than making a second one.
    const second = await agents.admin.post(`/api/sales/leads/${leadId}/convert`);
    assert.equal(second.status, 200);
    assert.equal(second.body.data.created, false);
    assert.equal(second.body.data.customer.id, customerId);

    const customers = await agents.admin.get('/api/customers');
    assert.equal(customers.body.data.items.filter((c) => c.lead?.id === leadId || c.lead === leadId).length, 1);
  });

  test('a converted lead leaves the board but stays in the list', async () => {
    const board = await agents.admin.get('/api/sales/leads/board');
    assert.equal(board.status, 200);
    assert.equal(
      board.body.data.leads.some((l) => l.id === leadId),
      false,
      'converted lead should be off the board',
    );

    const list = await agents.admin.get('/api/sales/leads');
    const row = list.body.data.items.find((l) => l.id === leadId);
    assert.ok(row, 'converted lead should still be listed');
    assert.ok(row.customer, 'the list row carries the customer link that marks it converted');
    assert.ok(row.convertedAt);

    // Conversion no longer rewrites the lead's stage.
    assert.equal(row.data.leadStatus, 'new');
  });

  test('the list can be filtered by active or converted', async () => {
    const active = await agents.admin.get('/api/sales/leads').query({ state: 'active' });
    assert.equal(active.status, 200);
    assert.equal(
      active.body.data.items.some((l) => l.id === leadId),
      false,
    );
    assert.ok(active.body.data.items.every((l) => !l.customer));

    const converted = await agents.admin.get('/api/sales/leads').query({ state: 'converted' });
    assert.equal(
      converted.body.data.items.some((l) => l.id === leadId),
      true,
    );
    assert.ok(converted.body.data.items.every((l) => l.customer));
  });

  test('the pipeline summary counts only active leads', async () => {
    const summary = await agents.admin.get('/api/sales/leads/summary');
    const active = await agents.admin.get('/api/sales/leads').query({ state: 'active', limit: 100 });
    assert.equal(summary.body.data.totalLeads, active.body.data.pagination.total);
  });

  test('a converted lead is read-only', async () => {
    const edit = await agents.admin.patch(`/api/sales/leads/${leadId}`).send({ data: { leadName: 'Renamed' } });
    assert.equal(edit.status, 409);
    assert.equal(edit.body.error.code, 'LEAD_CONVERTED');

    const move = await agents.admin.patch(`/api/sales/leads/${leadId}/move`).send({ value: 'won' });
    assert.equal(move.status, 409);

    const unchanged = await agents.admin.get(`/api/sales/leads/${leadId}`);
    assert.equal(unchanged.body.data.lead.data.leadName, 'Website build');
  });

  test('an active lead is still fully editable', async () => {
    const lead = await agents.admin.post('/api/sales/leads').send({ data: { leadName: 'Still open' } });
    const id = lead.body.data.lead.id;

    const edit = await agents.admin.patch(`/api/sales/leads/${id}`).send({ data: { leadName: 'Still open, renamed' } });
    assert.equal(edit.status, 200);
    assert.equal(edit.body.data.lead.data.leadName, 'Still open, renamed');

    const move = await agents.admin.patch(`/api/sales/leads/${id}/move`).send({ value: 'won' });
    assert.equal(move.status, 200);
    assert.equal(move.body.data.lead.data.leadStatus, 'won');

    // And unlike a converted lead, it is on the board.
    const board = await agents.admin.get('/api/sales/leads/board');
    assert.equal(
      board.body.data.leads.some((l) => l.id === id),
      true,
    );
  });

  test('conversion requires permission to create customers', async () => {
    await setPermissions(ids.emma, { leads: ['view', 'create', 'edit'] });
    const lead = await agents.emma.post('/api/sales/leads').send({ data: { leadName: 'Emma lead' } });
    assert.equal(lead.status, 201);

    const convert = await agents.emma.post(`/api/sales/leads/${lead.body.data.lead.id}/convert`);
    assert.equal(convert.status, 403);
  });

  test('deleting a customer frees the lead to be converted again', async () => {
    await setPermissions(ids.emma, { customers: ['view'] });
    assert.equal((await agents.emma.delete(`/api/customers/${customerId}`)).status, 403);

    assert.equal((await agents.admin.delete(`/api/customers/${customerId}`)).status, 204);

    // The lead becomes active again: back on the board and editable.
    const board = await agents.admin.get('/api/sales/leads/board');
    assert.equal(
      board.body.data.leads.some((l) => l.id === leadId),
      true,
    );
    assert.equal((await agents.admin.patch(`/api/sales/leads/${leadId}`).send({ data: { leadName: 'Website build' } })).status, 200);

    const again = await agents.admin.post(`/api/sales/leads/${leadId}/convert`);
    assert.equal(again.status, 201);
    assert.equal(again.body.data.created, true);
  });
});

describe('payslips', () => {
  let payslipId;

  test('totals are calculated on the server', async () => {
    const res = await agents.admin.post('/api/payslips').send({
      employee: ids.emma,
      company: ids.india,
      periodStart: '2026-03-01',
      periodEnd: '2026-03-31',
      payDate: '2026-03-31',
      earnings: [
        { label: 'Basic Pay', amount: 5000 },
        { label: 'House Rent Allowance (HRA)', amount: 2500 },
        { label: 'Transportation Allowance', amount: 1000 },
        { label: 'Food Allowance', amount: 1500 },
      ],
      deductions: [{ label: 'Advance', amount: 500 }],
    });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    const payslip = res.body.data.payslip;
    payslipId = payslip.id;

    assert.equal(payslip.grossEarnings, 10000);
    assert.equal(payslip.totalDeductions, 500);
    assert.equal(payslip.netPay, 9500);
    assert.equal(payslip.currency, 'INR');
    assert.match(payslip.payslipNumber, /^PS-202603-\d{4}$/);
    assert.equal(payslip.employeeSnapshot.name, 'Emma');
  });

  test('one payslip per employee per period, and deductions cannot exceed earnings', async () => {
    const duplicate = await agents.admin.post('/api/payslips').send({
      employee: ids.emma,
      company: ids.india,
      periodStart: '2026-03-01',
      periodEnd: '2026-03-31',
      payDate: '2026-03-31',
      earnings: [{ label: 'Basic', amount: 1 }],
    });
    assert.equal(duplicate.status, 409);

    const negative = await agents.admin.post('/api/payslips').send({
      employee: ids.emma,
      company: ids.india,
      periodStart: '2026-04-01',
      periodEnd: '2026-04-30',
      payDate: '2026-04-30',
      earnings: [{ label: 'Basic', amount: 100 }],
      deductions: [{ label: 'Loan', amount: 900 }],
    });
    assert.equal(negative.status, 400);
  });

  test('defaults come from the previous payslip', async () => {
    const res = await agents.admin.get('/api/payslips/defaults').query({ employee: ids.emma, company: ids.india });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.earnings.length, 4);
    assert.equal(res.body.data.copiedFrom.payslipNumber.startsWith('PS-'), true);
  });

  test('the currency can be typed per payslip', async () => {
    const res = await agents.admin.post('/api/payslips').send({
      company: ids.uae,
      employee: ids.emma,
      periodStart: '2026-07-01',
      periodEnd: '2026-07-31',
      payDate: '2026-07-31',
      currency: 'usd',
      earnings: [{ label: 'Basic Pay', amount: 1000 }],
    });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.equal(res.body.data.payslip.currency, 'USD', 'a typed code is stored uppercase');

    // Left out, it falls back to the company's own currency.
    const fallback = await agents.admin.post('/api/payslips').send({
      company: ids.uae,
      employee: ids.emma,
      periodStart: '2026-08-01',
      periodEnd: '2026-08-31',
      payDate: '2026-08-31',
      earnings: [{ label: 'Basic Pay', amount: 1000 }],
    });
    assert.equal(fallback.status, 201, JSON.stringify(fallback.body));
    assert.equal(fallback.body.data.payslip.currency, 'AED');

    const bad = await agents.admin.post('/api/payslips').send({
      company: ids.uae,
      employee: ids.emma,
      periodStart: '2026-06-01',
      periodEnd: '2026-06-30',
      payDate: '2026-06-30',
      currency: 'dollars',
      earnings: [{ label: 'Basic Pay', amount: 1000 }],
    });
    assert.equal(bad.status, 400);
    assert.equal(bad.body.error.details[0].path, 'currency');

    await agents.admin.delete(`/api/payslips/${res.body.data.payslip.id}`);
    await agents.admin.delete(`/api/payslips/${fallback.body.data.payslip.id}`);
  });

  test('the PDF is generated and downloads are permission-gated', async () => {
    await setPermissions(ids.emma, { payslips: ['view'] });
    assert.equal((await agents.emma.get(`/api/payslips/${payslipId}/pdf`)).status, 403);

    await setPermissions(ids.emma, { payslips: ['view', 'download'] });
    const pdf = await agents.emma.get(`/api/payslips/${payslipId}/pdf`);
    assert.equal(pdf.status, 200);
    assert.equal(pdf.headers['content-type'], 'application/pdf');
    assert.equal(pdf.body.subarray(0, 4).toString(), '%PDF');
  });
});

describe('invoices', () => {
  let invoiceId;

  test('line totals, tax and balance match the template maths', async () => {
    const res = await agents.admin.post('/api/invoices').send({
      company: ids.uae,
      status: 'sent',
      invoiceDate: '2026-05-06',
      dueDate: '2026-06-05',
      billTo: { name: 'Yosh Hospitality LLC', address: 'Abu Dhabi', taxNumber: '100279169500003' },
      items: [{ description: 'SharePoint AMC - April 2026', quantity: 78, rate: 158, taxRate: 5 }],
    });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    const invoice = res.body.data.invoice;
    invoiceId = invoice.id;

    assert.equal(invoice.subTotal, 12324);
    assert.equal(invoice.taxableAmount, 12324);
    assert.equal(invoice.taxTotal, 616.2);
    assert.equal(invoice.total, 12940.2);
    assert.equal(invoice.balanceDue, 12940.2);
    assert.equal(invoice.taxSummary[0].label, 'Standard Rate (5%)');
    // The seller details are frozen onto the invoice.
    assert.equal(invoice.seller.taxNumber, '105158954500003');
    assert.equal(invoice.seller.bank.bankName, 'Mashreq NEO BIZ');
  });

  test('a blank Ship To is accepted while it mirrors Bill To', async () => {
    // Exactly what the form submits with "Ship to the same address" ticked.
    const res = await agents.admin.post('/api/invoices').send({
      company: ids.uae,
      status: 'draft',
      invoiceDate: '2026-09-16',
      dueDate: '2026-10-16',
      billTo: { name: 'Noel Torres', address: 'Demo!!', taxNumber: '0987654321' },
      shipTo: { name: '', address: '', taxNumber: '' },
      shipToSameAsBillTo: true,
      items: [{ description: 'Toys', quantity: 1, rate: 100, discountPercent: 3, taxRate: 10 }],
    });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.deepEqual(
      { ...res.body.data.invoice.shipTo },
      { name: 'Noel Torres', address: 'Demo!!', taxNumber: '0987654321' },
    );

    // Once the addresses differ, a ship-to name is required...
    const missing = await agents.admin.post('/api/invoices').send({
      company: ids.uae,
      invoiceDate: '2026-09-16',
      dueDate: '2026-10-16',
      billTo: { name: 'Noel Torres', address: 'Demo!!' },
      shipTo: { name: '', address: 'Warehouse 4' },
      shipToSameAsBillTo: false,
      items: [{ description: 'Toys', quantity: 1, rate: 100 }],
    });
    assert.equal(missing.status, 400);
    assert.equal(missing.body.error.details[0].path, 'shipTo.name');

    // ...and the fields left blank inherit from Bill To rather than being wiped.
    const partial = await agents.admin.post('/api/invoices').send({
      company: ids.uae,
      invoiceDate: '2026-09-16',
      dueDate: '2026-10-16',
      billTo: { name: 'Noel Torres', address: 'Demo!!', taxNumber: '0987654321' },
      shipTo: { name: 'Moti Bakery Warehouse', address: '', taxNumber: '' },
      shipToSameAsBillTo: false,
      items: [{ description: 'Toys', quantity: 1, rate: 100 }],
    });
    assert.equal(partial.status, 201, JSON.stringify(partial.body));
    assert.equal(partial.body.data.invoice.shipTo.name, 'Moti Bakery Warehouse');
    assert.equal(partial.body.data.invoice.shipTo.address, 'Demo!!');
  });

  test('discounts reduce the taxable amount', async () => {
    const res = await agents.admin.post('/api/invoices').send({
      company: ids.uae,
      invoiceDate: '2026-05-06',
      dueDate: '2026-06-05',
      billTo: { name: 'Discount Co' },
      items: [{ description: 'Work', quantity: 10, rate: 100, discountPercent: 10, taxRate: 5 }],
      amountPaid: 100,
    });
    const invoice = res.body.data.invoice;
    assert.equal(invoice.subTotal, 1000);
    assert.equal(invoice.discountTotal, 100);
    assert.equal(invoice.taxableAmount, 900);
    assert.equal(invoice.taxTotal, 45);
    assert.equal(invoice.total, 945);
    assert.equal(invoice.balanceDue, 845);
  });

  test('numbers follow the company sequence and stay unique', async () => {
    const list = await agents.admin.get('/api/invoices').query({ sortBy: 'createdAt', sortOrder: 'asc' });
    const numbers = list.body.data.items.map((i) => i.invoiceNumber);
    assert.match(numbers[0], /^INV-\d{6}0000\d{2}$/);
    assert.equal(new Set(numbers).size, numbers.length);

    const clash = await agents.admin.post('/api/invoices').send({
      company: ids.uae,
      invoiceNumber: numbers[0],
      invoiceDate: '2026-05-06',
      dueDate: '2026-06-05',
      billTo: { name: 'Clash Co' },
      items: [{ description: 'Work', quantity: 1, rate: 1 }],
    });
    assert.equal(clash.status, 409);
  });

  test('marking as paid clears the balance', async () => {
    const res = await agents.admin.patch(`/api/invoices/${invoiceId}/status`).send({ status: 'paid' });
    assert.equal(res.body.data.invoice.balanceDue, 0);
    assert.equal(res.body.data.invoice.amountPaid, 12940.2);
  });

  test('the PDF renders and respects the download permission', async () => {
    await setPermissions(ids.emma, { invoices: ['view'] });
    assert.equal((await agents.emma.get(`/api/invoices/${invoiceId}/pdf`)).status, 403);

    const pdf = await agents.admin.get(`/api/invoices/${invoiceId}/pdf`);
    assert.equal(pdf.status, 200);
    assert.equal(pdf.body.subarray(0, 4).toString(), '%PDF');
  });
});

describe('module permissions', () => {
  test('the catalogue lists every module and its actions', async () => {
    const res = await agents.admin.get('/api/permissions/catalog');
    assert.equal(res.status, 200);
    const keys = res.body.data.modules.map((m) => m.key);
    for (const expected of ['leads', 'customers', 'employees', 'leave', 'dailyStatus', 'payslips', 'invoices', 'calendar']) {
      assert.ok(keys.includes(expected), `missing ${expected}`);
    }
  });

  test('employees cannot read or change permissions', async () => {
    assert.equal((await agents.emma.get('/api/permissions/catalog')).status, 403);
    assert.equal((await agents.emma.put(`/api/permissions/users/${ids.emma}`).send({ permissions: { invoices: ['view'] } })).status, 403);
  });

  test('granted permissions take effect immediately and reset restores defaults', async () => {
    await setPermissions(ids.emma, { invoices: [] });
    assert.equal((await agents.emma.get('/api/invoices')).status, 403);

    await setPermissions(ids.emma, { invoices: ['view'] });
    assert.equal((await agents.emma.get('/api/invoices')).status, 200);

    const reset = await agents.admin.post(`/api/permissions/users/${ids.emma}/reset`);
    assert.equal(reset.status, 200);
    assert.deepEqual(reset.body.data.permissions.invoices, []);
    // Defaults still include self-service leave and lead access.
    assert.deepEqual(reset.body.data.permissions.leave, ['view', 'create', 'edit', 'delete']);
    assert.equal((await agents.emma.get('/api/invoices')).status, 403);
    assert.equal((await agents.emma.get('/api/leaves')).status, 200);
  });

  test('admins always keep full access and cannot be limited', async () => {
    const res = await agents.admin.put(`/api/permissions/users/${ids.admin}`).send({ permissions: { invoices: [] } });
    assert.equal(res.status, 409);
    assert.equal((await agents.admin.get('/api/invoices')).status, 200);
  });

  test('leave approval unlocks the organisation-wide view without exposing it by default', async () => {
    const emmaLeave = await agents.emma.post('/api/leaves').send({
      type: 'casual',
      startDate: '2026-07-06',
      endDate: '2026-07-06',
      reason: 'Personal',
    });
    assert.equal(emmaLeave.status, 201);

    // Default employee: sees only their own.
    const own = await agents.emma.get('/api/leaves');
    assert.equal(own.body.data.items.length, 1);

    // With approve: sees everyone, and can review other people's requests.
    await setPermissions(ids.emma, { leave: ['view', 'create', 'edit', 'delete', 'approve'] });
    const adminLeaveOwner = await createUser({ firstName: 'Zoe', email: 'zoe@test.io', password: PASSWORD });
    const zoe = await signIn('zoe@test.io');
    const zoeLeave = await zoe.post('/api/leaves').send({ type: 'sick', startDate: '2026-07-07', endDate: '2026-07-07', reason: 'Flu' });
    assert.equal(zoeLeave.status, 201);

    const all = await agents.emma.get('/api/leaves');
    assert.ok(all.body.data.items.length >= 2);

    const review = await agents.emma.patch(`/api/leaves/${zoeLeave.body.data.leave.id}/review`).send({ status: 'approved' });
    assert.equal(review.status, 200);

    // Nobody may approve their own request.
    const self = await agents.emma.patch(`/api/leaves/${emmaLeave.body.data.leave.id}/review`).send({ status: 'approved' });
    assert.equal(self.status, 403);
    assert.ok(adminLeaveOwner.id);
  });
});

describe('audit log', () => {
  test('records document activity and is admin-only', async () => {
    assert.equal((await agents.emma.get('/api/audit-logs')).status, 403);

    const res = await agents.admin.get('/api/audit-logs').query({ limit: 50 });
    assert.equal(res.status, 200);
    const actions = res.body.data.items.map((i) => i.action);
    for (const expected of ['invoice.created', 'payslip.created', 'customer.converted', 'permission.updated']) {
      assert.ok(actions.includes(expected), `missing audit entry ${expected}`);
    }
  });
});
