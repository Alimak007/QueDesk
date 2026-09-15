/**
 * Usage:
 *   npm run seed         Creates the first admin account and the default Sales form.
 *   npm run seed:demo    Additionally loads demo employees, leaves, reports, events and leads.
 *
 * Both modes are idempotent: existing data is never overwritten.
 */
import { env } from '../config/env.js';
import { connectDatabase, disconnectDatabase } from '../config/db.js';
import { LEAVE_STATUS, ROLES } from '../constants/index.js';
import { addDays, isWeekend, todayDateOnly } from '../utils/dates.js';
import { logger } from '../utils/logger.js';
import { DailyStatus } from '../modules/daily-status/dailyStatus.model.js';
import { Event } from '../modules/events/event.model.js';
import { Leave } from '../modules/leaves/leave.model.js';
import { calculateLeaveDays } from '../modules/leaves/leave.service.js';
import { Lead } from '../modules/sales/lead.model.js';
import { buildSearchText } from '../modules/sales/leadData.js';
import { ensureDefaultSalesFields, listActiveFields } from '../modules/sales/salesField.service.js';
import { User } from '../modules/users/user.model.js';
import { createUser } from '../modules/users/user.service.js';
import { passwordSchema } from '../utils/validators.js';

const DEMO_PASSWORD = 'Welcome@123';

async function nextAdminEmployeeId() {
  for (let n = 1; ; n += 1) {
    const id = `ADM-${String(n).padStart(4, '0')}`;
    if (!(await User.exists({ employeeId: id }))) return id;
  }
}

/**
 * Ensures the account in SEED_ADMIN_EMAIL exists as an active admin.
 * An existing account keeps its password and details; it is only promoted/reactivated if needed.
 */
async function ensureAdmin() {
  const existing = await User.findOne({ email: env.SEED_ADMIN_EMAIL });
  if (existing) {
    if (existing.role !== ROLES.ADMIN || existing.status !== 'active') {
      existing.role = ROLES.ADMIN;
      existing.status = 'active';
      existing.deactivatedAt = null;
      existing.tokenVersion += 1;
      await existing.save();
      logger.info(`Promoted existing account to active admin: ${existing.email}`);
    } else {
      logger.info(`Admin already exists: ${existing.email}`);
    }
    return existing;
  }

  if (!passwordSchema.safeParse(env.SEED_ADMIN_PASSWORD).success) {
    logger.warn('SEED_ADMIN_PASSWORD is weaker than the portal password policy (8+ characters with a letter and a number). Change it after signing in.');
  }

  const [firstName, ...rest] = env.SEED_ADMIN_NAME.split(/s+/);
  const admin = await createUser({
    firstName,
    lastName: rest.join(' '),
    email: env.SEED_ADMIN_EMAIL,
    password: env.SEED_ADMIN_PASSWORD,
    role: ROLES.ADMIN,
    designation: 'Administrator',
    employeeId: await nextAdminEmployeeId(),
  });
  logger.info(`Created admin: ${admin.email} (${admin.employeeId})`);
  return admin;
}

const DEMO_EMPLOYEES = [
  { firstName: 'Aarav', lastName: 'Sharma', email: 'aarav@myportal.com', department: 'Engineering', designation: 'Senior Software Engineer', phone: '+91 98200 11001', joiningDate: '2022-04-11' },
  { firstName: 'Priya', lastName: 'Nair', email: 'priya@myportal.com', department: 'Engineering', designation: 'Frontend Developer', phone: '+91 98200 11002', joiningDate: '2023-01-16' },
  { firstName: 'Rohan', lastName: 'Mehta', email: 'rohan@myportal.com', department: 'Sales', designation: 'Business Development Manager', phone: '+91 98200 11003', joiningDate: '2021-08-02' },
  { firstName: 'Sara', lastName: 'Khan', email: 'sara@myportal.com', department: 'Sales', designation: 'Account Executive', phone: '+91 98200 11004', joiningDate: '2024-02-19' },
  { firstName: 'Vikram', lastName: 'Iyer', email: 'vikram@myportal.com', department: 'Design', designation: 'Product Designer', phone: '+91 98200 11005', joiningDate: '2023-06-05' },
  { firstName: 'Neha', lastName: 'Gupta', email: 'neha@myportal.com', department: 'Operations', designation: 'HR & Operations Lead', phone: '+91 98200 11006', joiningDate: '2022-10-03' },
];

async function seedDemo(admin) {
  if (await User.exists({ email: DEMO_EMPLOYEES[0].email })) {
    logger.info('Demo data already present — skipping');
    return;
  }

  const today = todayDateOnly();
  const year = today.slice(0, 4);

  const employees = [];
  for (const e of DEMO_EMPLOYEES) {
    employees.push(await createUser({ ...e, password: DEMO_PASSWORD, role: ROLES.EMPLOYEE }));
  }
  logger.info(`Created ${employees.length} demo employees (password: ${DEMO_PASSWORD})`);

  /* Calendar */
  const events = [
    { title: "New Year's Day", type: 'holiday', startDate: `${year}-01-01`, endDate: `${year}-01-01` },
    { title: 'Republic Day', type: 'holiday', startDate: `${year}-01-26`, endDate: `${year}-01-26` },
    { title: 'Independence Day', type: 'holiday', startDate: `${year}-08-15`, endDate: `${year}-08-15` },
    { title: 'Gandhi Jayanti', type: 'holiday', startDate: `${year}-10-02`, endDate: `${year}-10-02` },
    { title: 'Diwali Break', type: 'holiday', startDate: `${year}-11-09`, endDate: `${year}-11-10`, description: 'Office closed for Diwali celebrations.' },
    { title: 'Christmas', type: 'holiday', startDate: `${year}-12-25`, endDate: `${year}-12-25` },
    { title: 'Quarterly Town Hall', type: 'meeting', startDate: addDays(today, 3), endDate: addDays(today, 3), isAllDay: false, startTime: '16:00', endTime: '17:30', location: 'Main Conference Room', description: 'Q3 results, roadmap and open Q&A with leadership.' },
    { title: 'Sales Pipeline Review', type: 'meeting', startDate: addDays(today, 1), endDate: addDays(today, 1), isAllDay: false, startTime: '11:00', endTime: '12:00', location: 'Zoom', description: 'Weekly review of open opportunities.' },
    { title: 'Team Offsite', type: 'event', startDate: addDays(today, 12), endDate: addDays(today, 13), location: 'Lonavala', description: 'Two-day team offsite: workshops, planning and team building.', additionalInfo: 'Transport leaves the office at 7:30 AM.' },
    { title: 'Tech Talk: Scaling MongoDB', type: 'event', startDate: addDays(today, 6), endDate: addDays(today, 6), isAllDay: false, startTime: '15:00', endTime: '16:00', location: 'Cafeteria' },
    { title: 'Payroll Processing', type: 'other', startDate: `${today.slice(0, 7)}-28`, endDate: `${today.slice(0, 7)}-28` },
  ];
  await Event.insertMany(events.map((e) => ({ isAllDay: true, ...e, createdBy: admin._id })));
  logger.info(`Created ${events.length} calendar events`);

  /* Leaves */
  const [aarav, priya, rohan, sara, vikram, neha] = employees;
  const leaveSpecs = [
    { employee: aarav, type: 'casual', startDate: addDays(today, 8), endDate: addDays(today, 10), reason: 'Personal work — family function out of town.', status: LEAVE_STATUS.PENDING },
    { employee: priya, type: 'sick', startDate: addDays(today, -1), endDate: addDays(today, 1), reason: 'Fever and doctor advised rest.', status: LEAVE_STATUS.APPROVED },
    { employee: rohan, type: 'earned', startDate: addDays(today, 20), endDate: addDays(today, 27), reason: 'Annual vacation with family.', status: LEAVE_STATUS.PENDING },
    { employee: sara, type: 'casual', startDate: addDays(today, -30), endDate: addDays(today, -30), reason: 'Bank and passport appointment.', status: LEAVE_STATUS.APPROVED },
    { employee: vikram, type: 'casual', startDate: addDays(today, 4), endDate: addDays(today, 4), isHalfDay: true, halfDaySession: 'second_half', reason: 'Parent-teacher meeting.', status: LEAVE_STATUS.PENDING },
    { employee: neha, type: 'unpaid', startDate: addDays(today, -60), endDate: addDays(today, -56), reason: 'Extended personal leave.', status: LEAVE_STATUS.REJECTED, reviewNote: 'Quarter-end close; please reschedule.' },
    { employee: aarav, type: 'sick', startDate: addDays(today, -45), endDate: addDays(today, -44), reason: 'Migraine.', status: LEAVE_STATUS.APPROVED },
  ];
  for (const { employee, status, reviewNote, ...spec } of leaveSpecs) {
    const days = await calculateLeaveDays(spec).catch(() => 1);
    const reviewed = status !== LEAVE_STATUS.PENDING;
    await Leave.create({
      ...spec,
      days,
      employee: employee._id,
      status,
      reviewNote: reviewNote ?? '',
      reviewedBy: reviewed ? admin._id : null,
      reviewedAt: reviewed ? new Date() : null,
    });
  }
  logger.info(`Created ${leaveSpecs.length} leave requests`);

  /* Daily status — last 8 working days for most employees */
  const samples = {
    Engineering: [
      ['Implemented pagination and filters for the leave API.\nReviewed 2 PRs.', 'Write integration tests for leave privacy rules.', ''],
      ['Fixed race condition in report submission.\nPaired with Priya on form validation.', 'Refactor notification service.', 'Waiting on staging DB credentials.'],
      ['Built the Kanban drag-and-drop interaction.', 'Polish empty states and loading skeletons.', ''],
    ],
    Sales: [
      ['Called 12 prospects, booked 3 demos.\nUpdated pipeline for ABC Ltd.', 'Send proposals to XYZ Ltd and Nova Retail.', ''],
      ['Demo with Orbit Logistics — positive, requested pricing.', 'Prepare pricing sheet and follow up.', 'Need approval for 15% discount.'],
    ],
    Design: [['Finalised dashboard wireframes and handed off to engineering.', 'Design system tokens for dark mode.', '']],
    Operations: [['Processed onboarding for 2 new joiners.\nUpdated holiday calendar.', 'Draft the offsite agenda.', '']],
  };
  const reports = [];
  let workday = today;
  let collected = 0;
  while (collected < 8) {
    if (!isWeekend(workday)) {
      employees.forEach((emp, i) => {
        if (emp.id === priya.id && workday >= addDays(today, -1)) return; // on sick leave
        if ((collected + i) % 5 === 4) return; // a few missed days for realism
        if (workday === today && i % 2 === 1) return; // some have not reported yet today
        const pool = samples[emp.department] ?? samples.Operations;
        const [workDone, planNext, blockers] = pool[(collected + i) % pool.length];
        reports.push({ employee: emp._id, date: workday, workDone, planNext, blockers, hoursWorked: 8 - ((collected + i) % 3) * 0.5 });
      });
      collected += 1;
    }
    workday = addDays(workday, -1);
  }
  await DailyStatus.insertMany(reports);
  logger.info(`Created ${reports.length} daily status reports`);

  /* Sales leads */
  const fields = await listActiveFields();
  const leads = [
    ['Website Redesign', 'ABC Ltd', 'John Mathews', 'john@abcltd.com', 'new', 450000, rohan],
    ['ERP Integration', 'XYZ Ltd', 'Sarah Thomas', 'sarah@xyz.co', 'follow_up', 1200000, sara],
    ['Mobile App MVP', 'Nova Retail', 'Karan Desai', 'karan@novaretail.in', 'negotiation', 850000, rohan],
    ['Annual Support Contract', 'Orbit Logistics', 'Meera Pillai', 'meera@orbitlogistics.com', 'won', 600000, sara],
    ['Data Analytics Dashboard', 'Zenith Health', 'Dr. Arjun Rao', 'arjun@zenithhealth.org', 'contacted', 380000, rohan],
    ['Cloud Migration', 'BlueStone Finance', 'Ananya Kapoor', 'ananya@bluestone.finance', 'new', 2200000, aarav],
    ['E-commerce Revamp', 'UrbanKart', 'Rahul Verma', 'rahul@urbankart.in', 'lost', 540000, sara],
    ['HR Portal', 'Greenfield Schools', 'Lakshmi Menon', 'lakshmi@greenfield.edu', 'follow_up', 300000, neha],
    ['Brand Identity Refresh', 'Pixel & Co', 'Isha Bose', 'isha@pixelco.design', 'contacted', 180000, vikram],
    ['IoT Fleet Tracking', 'Orbit Logistics', 'Meera Pillai', 'meera@orbitlogistics.com', 'negotiation', 1500000, rohan],
    ['Customer Support Chatbot', 'TeleOne', 'Farhan Ali', 'farhan@teleone.com', 'new', 420000, sara],
  ];
  const now = Date.now();
  await Lead.insertMany(
    leads.map(([leadName, company, contactPerson, email, leadStatus, expectedValue, owner], i) => {
      const data = { leadName, company, contactPerson, email, phone: null, leadStatus, expectedValue, notes: null };
      return {
        data,
        owner: owner._id,
        createdBy: owner._id,
        searchText: buildSearchText(data, fields),
        position: -(now - i * 1000),
      };
    }),
  );
  logger.info(`Created ${leads.length} sales leads`);
}

async function main() {
  await connectDatabase();
  await ensureDefaultSalesFields();
  const admin = await ensureAdmin();
  if (process.argv.includes('--demo')) await seedDemo(admin);
  logger.info('Seeding complete');
}

main()
  .catch((err) => {
    logger.error({ err }, 'Seeding failed');
    process.exitCode = 1;
  })
  .finally(() => disconnectDatabase());
