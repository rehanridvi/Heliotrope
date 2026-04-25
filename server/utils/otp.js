import crypto from 'crypto';

export const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

export const hashOTP = (otp) => {
  return crypto.createHash('sha256').update(otp).digest('hex');
};

export const verifyOTP = (plainOTP, hashedOTP) => {
  const hash = crypto.createHash('sha256').update(plainOTP).digest('hex');
  return hash === hashedOTP;
};

