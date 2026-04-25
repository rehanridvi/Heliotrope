import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Store, Radio, Share2, Package } from 'lucide-react';

const SellerDashboard: React.FC = () => {
  const { user } = useAuth();

  return (
    <div className="dash-wrap">
      <div className="dash-header">
        <h1>Seller Dashboard</h1>
        <p className="muted">Welcome back, {user?.name}</p>
      </div>
      <div className="dash-grid">
        <Link to="/storefronts/manage" className="dash-card" style={{ textDecoration: 'none', color: 'inherit' }}>
          <h2><Store size={18} /> My Storefront</h2>
          <p className="muted">Manage your shop page, logo, and products</p>
          <span className="btn-primary" style={{ marginTop: '0.75rem', display: 'inline-block' }}>Manage</span>
        </Link>
        <Link to="/seller/live" className="dash-card" style={{ textDecoration: 'none', color: 'inherit' }}>
          <h2><Radio size={18} /> Go Live</h2>
          <p className="muted">Start a live selling session</p>
          <span className="btn-primary" style={{ marginTop: '0.75rem', display: 'inline-block' }}>Start Stream</span>
        </Link>
        <Link to="/social-connect" className="dash-card" style={{ textDecoration: 'none', color: 'inherit' }}>
          <h2><Share2 size={18} /> Social Connect</h2>
          <p className="muted">Link Facebook and Instagram pages</p>
          <span className="btn-primary" style={{ marginTop: '0.75rem', display: 'inline-block' }}>Connect</span>
        </Link>
        <div className="dash-card">
          <h2><Package size={18} /> Orders</h2>
          <p className="muted">View and fulfill buyer orders</p>
          <button className="btn-primary" style={{ marginTop: '0.75rem' }}>View Orders</button>
        </div>
      </div>
    </div>
  );
};

export default SellerDashboard;

