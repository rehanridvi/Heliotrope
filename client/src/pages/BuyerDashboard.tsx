import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ShoppingBag, Heart, MessageSquare, Sparkles, Radio } from 'lucide-react';

const BuyerDashboard: React.FC = () => {
  const { user } = useAuth();

  return (
    <div className="dash-wrap">
      <div className="dash-header">
        <h1>Buyer Dashboard</h1>
        <p className="muted">Welcome back, {user?.name}</p>
      </div>
      <div className="dash-grid">
        <div className="dash-card">
          <h2><ShoppingBag size={18} /> My Orders</h2>
          <p className="muted">Track and manage your purchases</p>
          <button className="btn-primary" style={{ marginTop: '0.75rem' }}>View Orders</button>
        </div>
        <div className="dash-card">
          <h2><Heart size={18} /> Wishlist</h2>
          <p className="muted">Saved items you love</p>
          <button className="btn-primary" style={{ marginTop: '0.75rem' }}>View Wishlist</button>
        </div>
        <Link to="/my-closet" className="dash-card" style={{ textDecoration: 'none', color: 'inherit' }}>
          <h2><Sparkles size={18} /> Digital Closet</h2>
          <p className="muted">Manage your wardrobe and get AI outfit suggestions</p>
          <span className="btn-primary" style={{ marginTop: '0.75rem', display: 'inline-block' }}>Open Closet</span>
        </Link>
        <Link to="/fashion-assistant" className="dash-card" style={{ textDecoration: 'none', color: 'inherit' }}>
          <h2><MessageSquare size={18} /> AI Fashion Assistant</h2>
          <p className="muted">Get personalized styling advice</p>
          <span className="btn-primary" style={{ marginTop: '0.75rem', display: 'inline-block' }}>Chat Now</span>
        </Link>
        <Link to="/live" className="dash-card" style={{ textDecoration: 'none', color: 'inherit' }}>
          <h2><Radio size={18} /> Live Sessions & Auctions</h2>
          <p className="muted">Watch live seller streams and join live auctions in real time</p>
          <span className="btn-primary" style={{ marginTop: '0.75rem', display: 'inline-block' }}>Watch Live</span>
        </Link>
      </div>
    </div>
  );
};

export default BuyerDashboard;

