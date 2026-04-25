import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

const ResetPassword: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      await api.post('/auth/reset-password', { email, otp, newPassword });
      navigate('/auth');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Reset failed');
    } finally { setLoading(false); }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h2 style={{ marginBottom: '1rem' }}>Reset Password</h2>
        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-field"><label>Email</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
          <div className="auth-field"><label>OTP</label><input type="text" value={otp} onChange={(e) => setOtp(e.target.value)} required /></div>
          <div className="auth-field"><label>New Password</label><input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={6} /></div>
          {error && <div className="auth-error">{error}</div>}
          <button type="submit" className="auth-submit" disabled={loading}>{loading ? 'Resetting...' : 'Reset Password'}</button>
        </form>
      </div>
    </div>
  );
};

export default ResetPassword;
