import React from 'react';

const DeliveryDashboard: React.FC = () => {
  return (
    <div className="dash-wrap">
      <div className="dash-header"><h1>Delivery Dashboard</h1><p className="muted">Manage your deliveries</p></div>
      <div className="dash-card"><h2>Assigned Orders</h2><p className="muted">No pending deliveries</p></div>
    </div>
  );
};

export default DeliveryDashboard;

