import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const VerifyOTP: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const email = location.state?.email || '';
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message || 'Invalid OTP'); setLoading(false); return; }
      if (data.requiresSellerApproval) { navigate('/seller-pending'); return; }
      navigate('/auth');
    } catch { setError('Network error'); }
    setLoading(false);
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h2 style={{ marginBottom: '1rem' }}>Verify Email</h2>
        <p className="muted" style={{ marginBottom: '1rem' }}>Enter the OTP sent to {email}</p>
        <form onSubmit={handleSubmit} className="auth-form">
          <div className="auth-field">
            <label>OTP Code</label>
            <input value={otp} onChange={(e) => setOtp(e.target.value)} required maxLength={6} />
          </div>
          {error && <div className="auth-error">{error}</div>}
          <button type="submit" className="auth-submit" disabled={loading}>{loading ? 'Verifying...' : 'Verify'}</button>
        </form>
      </div>
    </div>
  );
};

export default VerifyOTP;

