import { env } from '../../config/env.js';
import { sendMail } from '../../utils/mailer.js';

const fullName = (u) => [u?.firstName, u?.lastName].filter(Boolean).join(' ');
const capitalise = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const typeLabel = (type) => (type === 'wfh' ? 'WFH' : capitalise(type));
const appUrl = (path) => `${env.clientOrigins[0]}${path}`;

const formatDates = (leave) =>
  leave.startDate === leave.endDate ? leave.startDate : `${leave.startDate} to ${leave.endDate}`;

function formatDuration(leave) {
  if (leave.isHalfDay) return `Half day (${leave.halfDaySession === 'first_half' ? 'first half' : 'second half'})`;
  return `${leave.days} ${leave.days === 1 ? 'day' : 'days'}`;
}

/**
 * Tells the approvers about a new request. The employee's reason is the body
 * of the email; the details underneath only say whose request it is and where
 * to act on it. Replies go straight to the employee.
 */
export function sendLeaveRequestEmail(leave, employee, approvers) {
  const name = fullName(employee);
  return sendMail({
    to: approvers.map((a) => a.email),
    replyTo: employee.email,
    subject: `Leave request from ${name}: ${typeLabel(leave.type)}, ${formatDates(leave)}`,
    text: [
      leave.reason,
      '',
      '',
      `Employee: ${[name, employee.employeeId && `(${employee.employeeId})`].filter(Boolean).join(' ')}`,
      `Type: ${typeLabel(leave.type)}`,
      `Dates: ${formatDates(leave)}`,
      `Duration: ${formatDuration(leave)}`,
      '',
      `Review it in QueDesk: ${appUrl(`/leave?tab=team&leave=${leave.id}`)}`,
    ].join('\n'),
  });
}

const UPDATE_COPY = {
  approved: { subject: 'Your leave request was approved', headline: (who) => `${who} approved your leave request.` },
  rejected: { subject: 'Your leave request was rejected', headline: (who) => `${who} rejected your leave request.` },
  edited: { subject: 'Your leave request was edited', headline: (who) => `${who} edited your leave request.` },
  note: { subject: 'The note on your leave request was updated', headline: (who) => `${who} updated the note on your leave request.` },
};

/**
 * Sends the employee the current state of their request after an approver
 * approved, rejected, edited or annotated it. `leave.employee` must be populated.
 */
export function sendLeaveUpdateEmail(leave, actor, action) {
  const { subject, headline } = UPDATE_COPY[action];
  return sendMail({
    to: leave.employee.email,
    replyTo: actor.email,
    subject: `${subject}: ${typeLabel(leave.type)}, ${formatDates(leave)}`,
    text: [
      `Hi ${leave.employee.firstName},`,
      '',
      headline(fullName(actor)),
      '',
      `Status: ${capitalise(leave.status)}`,
      `Type: ${typeLabel(leave.type)}`,
      `Dates: ${formatDates(leave)}`,
      `Duration: ${formatDuration(leave)}`,
      `Reason: ${leave.reason}`,
      ...(leave.reviewNote ? [`Note: ${leave.reviewNote}`] : []),
      '',
      `View it in QueDesk: ${appUrl(`/leave?leave=${leave.id}`)}`,
    ].join('\n'),
  });
}
