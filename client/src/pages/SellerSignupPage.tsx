import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const SellerSignupPage: React.FC = () => {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('http://localhost:5000/api/auth/register-seller', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message || 'Registration failed'); setLoading(false); return; }
      navigate('/verify-otp', { state: { email } });
    } catch { setError('Network error'); setLoading(false); }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h2 style={{ marginBottom: '1rem' }}>Become a Seller</h2>
        <form onSubmit={handleSubmit} className="auth-form">
          <div className="auth-field"><label>Name</label><input value={name} onChange={(e) => setName(e.target.value)} required /></div>
          <div className="auth-field"><label>Email</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
          <div className="auth-field"><label>Password</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} /></div>
          {error && <div className="auth-error">{error}</div>}
          <button type="submit" className="auth-submit" disabled={loading}>{loading ? 'Registering...' : 'Register as Seller'}</button>
        </form>
      </div>
    </div>
  );
};

export default SellerSignupPage;

