import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, Heart, ShoppingBag, User, Radio, LayoutGrid, LogOut, ChevronDown } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showDropdown, setShowDropdown] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <header className="navbar">
      <div className="navbar-inner">
        <Link to="/" className="navbar-logo">
          <div className="navbar-logo-icon">H</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1rem' }}>Heliotrope</div>
            <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.18em', color: '#9ca3af' }}>
              Artisan Marketplace
            </div>
          </div>
        </Link>

        <nav className="navbar-links">
          <Link to="/" className="navbar-link">Discover</Link>
          <Link to="/search" className="navbar-link">Shop</Link>
          <Link to="/storefronts" className="navbar-link">Sellers</Link>
          <Link to="/live" className="navbar-link">
            <Radio size={16} color="#ef4444" style={{ marginRight: 4 }} />
            Live
          </Link>
        </nav>

        <div className="navbar-actions">
          <button type="button" className="navbar-icon-btn" onClick={() => navigate('/search')}><Bell size={18} /></button>
          <button type="button" className="navbar-icon-btn"><Heart size={18} /></button>
          <button type="button" className="navbar-icon-btn" onClick={() => navigate('/cart')}><ShoppingBag size={18} /></button>

          {!user ? (
            <Link to="/auth" className="navbar-pill-btn">
              <User size={16} /> Login
            </Link>
          ) : (
            <div className="navbar-dropdown" style={{ position: 'relative' }}>
              <button
                type="button"
                className="navbar-pill-btn"
                onClick={() => setShowDropdown(!showDropdown)}
              >
                <User size={16} /> {user.name} <ChevronDown size={14} />
              </button>
              {showDropdown && (
                <div className="navbar-dropdown-menu">
                  <Link to="/dashboard" className="dropdown-item" onClick={() => setShowDropdown(false)}>Dashboard</Link>
                  {user.role === 'buyer' && (
                    <>
                      <Link to="/my-closet" className="dropdown-item" onClick={() => setShowDropdown(false)}>
                        <LayoutGrid size={14} style={{ marginRight: 6, display: 'inline' }} /> My Closet
                      </Link>
                      <Link to="/fashion-assistant" className="dropdown-item" onClick={() => setShowDropdown(false)}>
                        Fashion Assistant
                      </Link>
                    </>
                  )}
                  {user.role === 'seller' && (
                    <>
                      <Link to="/seller/dashboard" className="dropdown-item" onClick={() => setShowDropdown(false)}>Seller Dashboard</Link>
                      <Link to="/seller/live" className="dropdown-item" onClick={() => setShowDropdown(false)}>
                        <Radio size={14} style={{ marginRight: 6, display: 'inline' }} /> Go Live
                      </Link>
                    </>
                  )}
                  {user.role === 'admin' && (
                    <Link to="/admin/dashboard" className="dropdown-item" onClick={() => setShowDropdown(false)}>
                      Admin Dashboard
                    </Link>
                  )}
                  <hr style={{ border: 'none', borderTop: '1px solid #1f2937', margin: '0.5rem 0' }} />
                  <button type="button" className="dropdown-item" onClick={handleLogout} style={{ color: '#ef4444' }}>
                    <LogOut size={14} style={{ marginRight: 6, display: 'inline' }} /> Logout
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Navbar;

