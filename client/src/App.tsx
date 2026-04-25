import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

import HomePage from './pages/HomePage';
import AuthPage from './pages/AuthPage';
import ProductPage from './pages/ProductPage';
import SearchPage from './pages/SearchPage';

import DashboardRouter from './pages/DashboardRouter';
import BuyerDashboard from './pages/BuyerDashboard';
import SellerDashboard from './pages/SellerDashboard';
import DeliveryDashboard from './pages/DeliveryDashboard';
import AdminDashboard from './pages/AdminDashboard';
import VerifyOTP from './pages/VerifyOTP';
import ResetPassword from './pages/ResetPassword';

import SellerSignupPage from './pages/SellerSignupPage';
import SellerPendingPage from './pages/SellerPendingPage';
import ProductReviewPage from './pages/ProductReviewPage';

import DigitalClosetPage from './pages/DigitalClosetPage';
import FashionAssistantPage from './pages/FashionAssistantPage';
import LiveDiscoveryPage from './pages/LiveDiscoveryPage';
import LiveStreamPage from './pages/LiveStreamPage';
import SellerLiveStudio from './pages/SellerLiveStudio';
import StorefrontListPage from './pages/StorefrontListPage';
import StorefrontPage from './pages/StorefrontPage';
import SocialConnectPage from './pages/SocialConnectPage';

const App: React.FC = () => {
  return (
    <div className="app-root">
      <Router>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/products/:id" element={<ProductPage />} />

          <Route path="/seller-signup" element={<SellerSignupPage />} />
          <Route path="/seller-pending" element={<SellerPendingPage />} />

          <Route path="/dashboard" element={<DashboardRouter />} />
          <Route path="/buyer/dashboard" element={<BuyerDashboard />} />
          <Route path="/seller/dashboard" element={<SellerDashboard />} />
          <Route path="/delivery/dashboard" element={<DeliveryDashboard />} />
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          <Route path="/verify-otp" element={<VerifyOTP />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/products/:id/review" element={<ProductReviewPage />} />

          <Route path="/my-closet" element={<DigitalClosetPage />} />
          <Route path="/fashion-assistant" element={<FashionAssistantPage />} />
          <Route path="/live" element={<LiveDiscoveryPage />} />
          <Route path="/live/:channelName" element={<LiveStreamPage />} />
          <Route path="/seller/live" element={<SellerLiveStudio />} />
          <Route path="/storefronts" element={<StorefrontListPage />} />
          <Route path="/storefronts/:slug" element={<StorefrontPage />} />
          <Route path="/social-connect" element={<SocialConnectPage />} />
        </Routes>
      </Router>
    </div>
  );
};

export default App;

