import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export const protect = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Not authorized, no token' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.userId).select('-password -sellerSocial.fbAccessToken -sellerSocial.igAccessToken');
    if (!req.user) return res.status(401).json({ message: 'User not found' });
    if (req.user.isBlocked) {
      return res.status(403).json({ message: 'Account is blocked. Contact support.' });
    }
    next();
  } catch {
    return res.status(401).json({ message: 'Token invalid or expired' });
  }
};

