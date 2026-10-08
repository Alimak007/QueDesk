import { env } from '../../config/env.js';
import { sendMail } from '../../utils/mailer.js';

const fullName = (u) => [u?.firstName, u?.lastName].filter(Boolean).join(' ');

/**
 * Sends a newly submitted report to the reviewers. The report itself is the
 * body of the email; optional sections the employee left empty are omitted.
 * Replies go straight to the employee.
 */
export function sendStatusReportEmail(report, employee, reviewers) {
  const name = fullName(employee);
  const section = (title, value) => (value ? [`${title}:`, value, ''] : []);

  return sendMail({
    to: reviewers.map((r) => r.email),
    replyTo: employee.email,
    subject: `Daily status from ${name}: ${report.date}`,
    text: [
      ...section('Work done', report.workDone),
      ...section('Next steps', report.planNext),
      ...section('Blockers', report.blockers),
      ...(report.hoursWorked == null ? [] : [`Hours worked: ${report.hoursWorked}`, '']),
      '',
      `Employee: ${[name, employee.employeeId && `(${employee.employeeId})`].filter(Boolean).join(' ')}`,
      `Date: ${report.date}`,
      '',
      `Open it in QueDesk: ${env.clientOrigins[0]}/daily-status`,
    ].join('\n'),
  });
}
