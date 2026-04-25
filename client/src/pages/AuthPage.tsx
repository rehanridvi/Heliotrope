import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const AuthPage: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('buyer');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const endpoint = isLogin
        ? '/api/auth/login'
        : role === 'seller'
          ? '/api/auth/register-seller'
          : '/api/auth/register';
      const body = isLogin ? { email, password } : { name, email, password, role };
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));

      if (data.requiresVerification) {
        navigate('/verify-otp', { state: { email: data.email || email } });
        setLoading(false);
        return;
      }

      if (data.requiresSellerApproval) {
        navigate('/seller-pending');
        setLoading(false);
        return;
      }

      if (!res.ok) {
        setError(data.message || 'Auth failed');
        setLoading(false);
        return;
      }

      if (data.token && data.user) {
        login(data.token, data.user);
        navigate('/dashboard');
      }
    } catch { setError('Network error'); }
    setLoading(false);
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-tabs">
          <button className={`auth-tab ${isLogin ? 'active' : ''}`} onClick={() => setIsLogin(true)}>Login</button>
          <button className={`auth-tab ${!isLogin ? 'active' : ''}`} onClick={() => setIsLogin(false)}>Register</button>
        </div>
        <form onSubmit={handleSubmit} className="auth-form">
          {!isLogin && (
            <div className="auth-field">
              <label>Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
          )}
          <div className="auth-field">
            <label>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="auth-field">
            <label>Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
          </div>
          {!isLogin && (
            <div className="auth-field">
              <label>Role</label>
              <select value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="buyer">Buyer</option>
                <option value="seller">Seller</option>
              </select>
            </div>
          )}
          {error && <div className="auth-error">{error}</div>}
          <button type="submit" className="auth-submit" disabled={loading}>{loading ? 'Please wait...' : isLogin ? 'Login' : 'Register'}</button>
        </form>
        {isLogin && (
          <div className="auth-footer-row">
            <Link to="/reset-password"><button className="auth-link-button">Forgot password?</button></Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default AuthPage;

