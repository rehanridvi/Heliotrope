import { LayoutGrid, Radio, Store } from 'lucide-react';
import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import ClosetView from './ClosetView';
import Marketplace from './Marketplace';
import LiveDiscoveryPage from './live/LiveDiscoveryPage';
import BuyerLivePage from './live/BuyerLivePage';
import SellerLivePage from './live/SellerLivePage';
import './App.css';

export default function App() {
  return (
    <div className="app-container">
      <header className="glass app-global-nav">
        <div className="header-content">
          <div className="app-nav-pills">
            <NavLink
              to="/closet"
              className={({ isActive }) => (isActive ? 'nav-pill active' : 'nav-pill')}
            >
              <LayoutGrid size={18} /> Digital Closet
            </NavLink>
            <NavLink
              to="/marketplace"
              className={({ isActive }) => (isActive ? 'nav-pill active' : 'nav-pill')}
            >
              <Store size={18} /> Marketplace
            </NavLink>
            <NavLink
              to="/live"
              className={({ isActive }) => (isActive ? 'nav-pill active' : 'nav-pill')}
            >
              <Radio size={18} /> Live
            </NavLink>
          </div>
        </div>
      </header>
      <Routes>
        <Route path="/" element={<Navigate to="/closet" replace />} />
        <Route path="/closet" element={<ClosetView />} />
        <Route path="/marketplace" element={<Marketplace />} />
        <Route path="/live" element={<LiveDiscoveryPage />} />
        <Route path="/live/:channelName" element={<BuyerLivePage />} />
        <Route path="/seller/live" element={<SellerLivePage />} />
        <Route path="*" element={<Navigate to="/closet" replace />} />
      </Routes>
    </div>
  );
}
