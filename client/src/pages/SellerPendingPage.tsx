import React from 'react';

const SellerPendingPage: React.FC = () => {
  return (
    <div className="auth-page">
      <div className="auth-card" style={{ textAlign: 'center' }}>
        <h2 style={{ marginBottom: '1rem' }}>Application Submitted</h2>
        <p className="muted">Your seller account is pending admin approval. You will be notified via email once verified.</p>
        <p className="muted" style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>
          Admin approval location: Admin Dashboard - Seller Verifications (`/admin/dashboard`).
        </p>
      </div>
    </div>
  );
};

export default SellerPendingPage;

