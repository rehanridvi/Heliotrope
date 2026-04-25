import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { sendEmail, emailTemplates } from '../utils/email.js';
import { generateOTP, hashOTP, verifyOTP as verifyOTPUtil } from '../utils/otp.js';

const generateToken = (user) =>
  jwt.sign({ userId: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });

const createUserWithOtp = async ({ name, email, password, role }) => {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const existing = await User.findOne({ email: normalizedEmail });

  const otp = generateOTP();
  const hashedOTP = hashOTP(otp);
  const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

  let user;

  if (existing) {
    if (existing.isEmailVerified) {
      const err = new Error('Email already in use');
      err.statusCode = 400;
      throw err;
    }

    // Recover stuck unverified accounts by refreshing credentials and OTP.
    existing.name = name;
    existing.password = password;
    existing.role = role;
    existing.emailVerificationOTP = hashedOTP;
    existing.emailVerificationOTPExpires = otpExpires;
    user = await existing.save();
  } else {
    user = await User.create({
      name,
      email: normalizedEmail,
      // Password is hashed by the User model pre-save hook.
      password,
      role,
      isEmailVerified: false,
      emailVerificationOTP: hashedOTP,
      emailVerificationOTPExpires: otpExpires,
      ...(role === 'seller' ? { isVerifiedSeller: false } : {}),
    });
  }

  await sendEmail({
    to: user.email,
    subject: 'Verify Your Email - Heliotrope',
    html: emailTemplates.verifyOTP(user.name, otp),
  });

  return user;
};

export const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const user = await createUserWithOtp({ name, email, password, role: 'buyer' });

    res.status(201).json({
      message: 'Registration successful! Please check your email for OTP.',
      email: user.email,
      requiresVerification: true,
    });
  } catch (err) {
    console.error('Register buyer error:', err);
    res.status(err.statusCode || 500).json({ message: err.message || 'Server error' });
  }
};

export const registerSeller = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const user = await createUserWithOtp({ name, email, password, role: 'seller' });

    res.status(201).json({
      message: 'Seller registration started! Please check your email for OTP.',
      email: user.email,
      requiresVerification: true,
    });
  } catch (err) {
    console.error('Register seller error:', err);
    res.status(err.statusCode || 500).json({ message: err.message || 'Server error' });
  }
};

export const verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ message: 'Email and OTP are required' });

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (user.isEmailVerified) {
      return res.status(400).json({ message: 'Email already verified' });
    }

    if (!user.emailVerificationOTP || !user.emailVerificationOTPExpires) {
      return res.status(400).json({ message: 'No OTP found. Please request a new one.' });
    }

    if (new Date() > user.emailVerificationOTPExpires) {
      return res.status(400).json({ message: 'OTP has expired. Please request a new one.' });
    }

    const isValid = verifyOTPUtil(otp, user.emailVerificationOTP);
    if (!isValid) return res.status(400).json({ message: 'Invalid OTP' });

    user.isEmailVerified = true;
    user.emailVerificationOTP = undefined;
    user.emailVerificationOTPExpires = undefined;
    await user.save();

    sendEmail({
      to: user.email,
      subject: 'Welcome to Heliotrope! 🎉',
      html: emailTemplates.welcomeVerified(user.name),
    }).catch(() => {});

    if (user.role === 'seller' && !user.isVerifiedSeller) {
      return res.json({
        message: 'Email verified! Your seller account is pending admin approval.',
        requiresSellerApproval: true,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          isEmailVerified: user.isEmailVerified,
          isVerifiedSeller: user.isVerifiedSeller,
        },
      });
    }

    const token = generateToken(user);

    res.json({
      message: 'Email verified successfully!',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isEmailVerified: user.isEmailVerified,
        isVerifiedSeller: user.isVerifiedSeller,
      },
    });
  } catch (err) {
    console.error('Verify OTP error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

export const resendOTP = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required' });

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.isEmailVerified) return res.status(400).json({ message: 'Email already verified' });

    const otp = generateOTP();
    user.emailVerificationOTP = hashOTP(otp);
    user.emailVerificationOTPExpires = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    await sendEmail({
      to: user.email,
      subject: 'New OTP - Heliotrope',
      html: emailTemplates.verifyOTP(user.name, otp),
    });

    res.json({ message: 'New OTP sent to your email' });
  } catch (err) {
    console.error('Resend OTP error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'All fields are required' });

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'Invalid credentials' });

    if (!user.password || typeof user.password !== 'string') {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    let ok = false;
    const looksHashed = user.password.startsWith('$2a$') || user.password.startsWith('$2b$') || user.password.startsWith('$2y$');

    if (looksHashed) {
      ok = await bcrypt.compare(password, user.password);
    } else {
      // Legacy fallback: support old plain-text records and transparently migrate.
      ok = password === user.password;
      if (ok) {
        user.password = password;
        await user.save();
      }
    }

    if (!ok) return res.status(400).json({ message: 'Invalid credentials' });

    if (!user.isEmailVerified) {
      return res.status(403).json({
        message: 'Please verify your email before logging in',
        requiresVerification: true,
        email: user.email,
      });
    }

    if (user.role === 'seller' && !user.isVerifiedSeller) {
      const hasAnyAdmin = await User.exists({ role: 'admin' });
      if (!hasAnyAdmin) {
        // Dev/bootstrap fallback: avoid permanent lock when no admin account exists yet.
        user.isVerifiedSeller = true;
        await user.save();
      } else {
        return res.status(403).json({
          message: 'Your seller account is pending admin approval',
          requiresSellerApproval: true,
          email: user.email,
        });
      }
    }

    const token = generateToken(user);

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isEmailVerified: user.isEmailVerified,
        isVerifiedSeller: user.isVerifiedSeller,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required' });

    const user = await User.findOne({ email });
    if (!user) return res.json({ message: 'If this email exists, we have sent a password reset OTP.' });

    const otp = generateOTP();
    user.passwordResetOTP = hashOTP(otp);
    user.passwordResetOTPExpires = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    await sendEmail({
      to: user.email,
      subject: 'Password Reset OTP - Heliotrope',
      html: emailTemplates.passwordResetOTP(user.name, otp),
    });

    res.json({ message: 'Password reset OTP sent to your email' });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

export const verifyResetOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ message: 'Email and OTP are required' });

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (!user.passwordResetOTP || !user.passwordResetOTPExpires) {
      return res.status(400).json({ message: 'No OTP found. Please request a new one.' });
    }

    if (new Date() > user.passwordResetOTPExpires) {
      return res.status(400).json({ message: 'OTP has expired. Please request a new one.' });
    }

    const isValid = verifyOTPUtil(otp, user.passwordResetOTP);
    if (!isValid) return res.status(400).json({ message: 'Invalid OTP' });

    res.json({ message: 'OTP verified successfully. You can now reset your password.' });
  } catch (err) {
    console.error('Verify reset OTP error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) return res.status(400).json({ message: 'All fields are required' });
    if (newPassword.length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters' });

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (!user.passwordResetOTP || !user.passwordResetOTPExpires) {
      return res.status(400).json({ message: 'No OTP found. Please request a new one.' });
    }

    if (new Date() > user.passwordResetOTPExpires) {
      return res.status(400).json({ message: 'OTP has expired. Please request a new one.' });
    }

    const isValid = verifyOTPUtil(otp, user.passwordResetOTP);
    if (!isValid) return res.status(400).json({ message: 'Invalid OTP' });

    // Password is hashed by the User model pre-save hook.
    user.password = newPassword;
    user.passwordResetOTP = undefined;
    user.passwordResetOTPExpires = undefined;
    await user.save();

    sendEmail({
      to: user.email,
      subject: 'Password Reset Successful - Heliotrope',
      html: emailTemplates.passwordResetSuccess(user.name),
    }).catch(() => {});

    res.json({ message: 'Password reset successfully. You can now login with your new password.' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

export const resendResetOTP = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required' });

    const user = await User.findOne({ email });
    if (!user) return res.json({ message: 'If this email exists, we have sent a new OTP.' });

    const otp = generateOTP();
    user.passwordResetOTP = hashOTP(otp);
    user.passwordResetOTPExpires = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    await sendEmail({
      to: user.email,
      subject: 'New Password Reset OTP - Heliotrope',
      html: emailTemplates.passwordResetOTP(user.name, otp),
    });

    res.json({ message: 'New OTP sent to your email' });
  } catch (err) {
    console.error('Resend reset OTP error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current password and new password are required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters' });
    }

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const ok = await bcrypt.compare(currentPassword, user.password);
    if (!ok) return res.status(400).json({ message: 'Current password is incorrect' });

    // Password is hashed by the User model pre-save hook.
    user.password = newPassword;
    await user.save();

    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

export const getMe = async (req, res) => {
  res.json({ user: req.user });
};
