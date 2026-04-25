import User from '../models/User.js';

export const getMyProfile = async (req, res) => {
  const user = await User.findById(req.user._id).select('-password');
  res.json({ user });
};

export const updateMyProfile = async (req, res) => {
  const { name, phone, address } = req.body;

  const user = await User.findById(req.user._id);
  if (!user) return res.status(404).json({ message: 'User not found' });

  if (name !== undefined) user.name = String(name).trim();
  if (phone !== undefined) user.phone = String(phone);

  if (address && typeof address === 'object') {
    user.address = {
      line1: address.line1 ?? user.address.line1,
      city: address.city ?? user.address.city,
      district: address.district ?? user.address.district,
      postalCode: address.postalCode ?? user.address.postalCode,
    };
  }

  await user.save();
  res.json({ user: await User.findById(req.user._id).select('-password') });
};

export const listDeliverymen = async (req, res) => {
  const deliverymen = await User.find({ role: 'delivery' }).select('_id name email lastAssignedAt');
  res.json({ deliverymen });
};

