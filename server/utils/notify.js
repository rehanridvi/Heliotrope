import User from '../models/User.js';
import { sendEmail } from './email.js';

const keepLatest = (arr, max = 50) => (arr.length > max ? arr.slice(0, max) : arr);

const shouldSendForType = (prefs, type) => {
  if (!prefs) return true;
  if (type === 'order') return prefs.orderUpdates !== false;
  if (type === 'review') return prefs.reviews !== false;
  if (type === 'offer') return prefs.promotions !== false;
  return prefs.system !== false;
};

export const notifyUser = async ({
  userId,
  type = 'system',
  title = '',
  body = '',
  link = '',
  meta = {},
  emailSubject,
  emailHtml,
  sendEmail: shouldSendEmail = true,
}) => {
  try {
    const user = await User.findById(userId).select('email notifications notificationPreferences');
    if (!user) return;

    const prefs = user.notificationPreferences || {};

    if (prefs.inApp !== false && shouldSendForType(prefs, type)) {
      user.notifications.unshift({
        title,
        body,
        read: false,
        meta: { ...meta, type, link },
        createdAt: new Date(),
      });

      user.notifications = keepLatest(user.notifications, 50);
      await user.save();
    }

    if (shouldSendEmail && prefs.email !== false && shouldSendForType(prefs, type) && emailSubject && emailHtml) {
      sendEmail({ to: user.email, subject: emailSubject, html: emailHtml })
        .catch((e) => console.error('Email failed:', e?.message || e));
    }
  } catch (e) {
    console.error('notifyUser failed:', e?.message || e);
  }
};

export const notifyMany = async (userIds, payload) => {
  await Promise.allSettled(userIds.map((id) => notifyUser({ userId: id, ...payload })));
};

