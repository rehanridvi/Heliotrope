import User from '../models/User.js';

export const getMyNotifications = async (req, res) => {
  const limit = Math.min(50, Math.max(1, Number(req.query.limit || 20)));
  const user = await User.findById(req.user._id).select('notifications');
  const notifications = (user?.notifications || []).slice(0, limit);
  const unreadCount = (user?.notifications || []).filter((n) => !n.read).length;
  res.json({ notifications, unreadCount });
};

export const markAllRead = async (req, res) => {
  await User.updateOne({ _id: req.user._id }, { $set: { 'notifications.$[].read': true } });
  res.json({ message: 'All notifications marked as read' });
};

export const markOneRead = async (req, res) => {
  const { id } = req.params;
  await User.updateOne({ _id: req.user._id, 'notifications._id': id }, { $set: { 'notifications.$.read': true } });
  res.json({ message: 'Notification marked as read' });
};

export const clearAll = async (req, res) => {
  await User.updateOne({ _id: req.user._id }, { $set: { notifications: [] } });
  res.json({ message: 'Notifications cleared' });
};
