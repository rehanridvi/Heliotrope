import React from 'react';

const SocialConnectPage: React.FC = () => {
  return (
    <div className="dash-wrap">
      <div className="dash-header"><h1>Social Media Connect</h1><p className="muted">Link your Facebook and Instagram pages</p></div>
      <div className="dash-grid">
        <div className="dash-card">
          <h2>Facebook</h2>
          <p className="muted">Connect your Facebook business page</p>
          <button className="btn-primary" style={{ marginTop: '0.75rem' }}>Connect Facebook</button>
        </div>
        <div className="dash-card">
          <h2>Instagram</h2>
          <p className="muted">Connect your Instagram business account</p>
          <button className="btn-primary" style={{ marginTop: '0.75rem' }}>Connect Instagram</button>
        </div>
      </div>
    </div>
  );
};

export default SocialConnectPage;

