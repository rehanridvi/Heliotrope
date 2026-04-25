export const requireVerifiedSeller = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Not authorized' });
  }
  if (req.user.role !== 'seller') {
    return res.status(403).json({ message: 'Seller access required' });
  }
  if (!req.user.isVerifiedSeller) {
    return res.status(403).json({ message: 'Seller account pending admin approval' });
  }
  next();
};

