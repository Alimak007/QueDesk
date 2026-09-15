import { ROLES, USER_STATUS } from '../../constants/index.js';
import { ApiError } from '../../utils/ApiError.js';
import { logger } from '../../utils/logger.js';
import { User } from '../users/user.model.js';
import { Notification } from './notification.model.js';

/**
 * Notifications are a side effect: a failure to deliver one must never fail
 * the business operation that triggered it.
 */
export async function notify(recipients, payload) {
  const ids = [...new Set((Array.isArray(recipients) ? recipients : [recipients]).map(String))];
  if (!ids.length) return;
  try {
    await Notification.insertMany(ids.map((recipient) => ({ ...payload, recipient })));
  } catch (err) {
    logger.error({ err, type: payload.type }, 'Failed to create notification');
  }
}

export async function notifyAdmins(payload, { exclude } = {}) {
  const admins = await User.find({ role: ROLES.ADMIN, status: USER_STATUS.ACTIVE }).select('_id').lean();
  const recipients = admins.map((a) => a._id.toString()).filter((id) => id !== String(exclude));
  return notify(recipients, payload);
}

export async function listNotifications(userId, { limit, unreadOnly }) {
  const filter = { recipient: userId };
  if (unreadOnly) filter.readAt = null;

  const [items, unreadCount] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).limit(limit),
    Notification.countDocuments({ recipient: userId, readAt: null }),
  ]);
  return { items, unreadCount };
}

export async function markRead(userId, id) {
  const notification = await Notification.findOneAndUpdate(
    { _id: id, recipient: userId },
    { $set: { readAt: new Date() } },
    { returnDocument: 'after' },
  );
  if (!notification) throw ApiError.notFound('Notification not found');
  return notification;
}

export async function markAllRead(userId) {
  const result = await Notification.updateMany({ recipient: userId, readAt: null }, { $set: { readAt: new Date() } });
  return { updated: result.modifiedCount };
}
