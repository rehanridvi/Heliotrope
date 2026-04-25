import React, { useCallback, useEffect, useState } from 'react';
import api from '../services/api';

type PendingSeller = {
  _id: string;
  name: string;
  email: string;
  isEmailVerified: boolean;
  isVerifiedSeller: boolean;
  createdAt: string;
};

const AdminDashboard: React.FC = () => {
  const [pendingSellers, setPendingSellers] = useState<PendingSeller[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  const loadPendingSellers = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await api.get('/admin/pending-sellers');
      setPendingSellers(res.data?.sellers || []);
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to load pending sellers';
      setError(message);
      setPendingSellers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleApproveSeller = async (sellerId: string) => {
    setApprovingId(sellerId);
    setError(null);
    try {
      await api.put(`/admin/approve-seller/${sellerId}`);
      setPendingSellers((prev) => prev.filter((seller) => seller._id !== sellerId));
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to approve seller';
      setError(message);
    } finally {
      setApprovingId(null);
    }
  };

  useEffect(() => {
    loadPendingSellers();
  }, [loadPendingSellers]);

  return (
    <div className="dash-wrap">
      <div className="dash-header"><h1>Admin Dashboard</h1><p className="muted">Manage the Heliotrope platform</p></div>
      <div className="dash-grid">
        <div className="dash-card">
          <h2>Seller Verifications</h2>
          <p className="muted">Review and approve seller applications requiring verification.</p>
          {loading ? (
            <p className="muted" style={{ marginTop: '0.75rem' }}>Loading pending sellers...</p>
          ) : pendingSellers.length === 0 ? (
            <p className="muted" style={{ marginTop: '0.75rem' }}>No pending seller approvals right now.</p>
          ) : (
            <div style={{ marginTop: '0.75rem', display: 'grid', gap: '0.75rem' }}>
              {pendingSellers.map((seller) => (
                <div key={seller._id} style={{ border: '1px solid #1f2937', borderRadius: 10, padding: '0.75rem' }}>
                  <strong>{seller.name}</strong>
                  <p className="muted" style={{ marginTop: 4 }}>{seller.email}</p>
                  <p className="muted" style={{ marginTop: 4, fontSize: '0.8rem' }}>
                    Joined: {new Date(seller.createdAt).toLocaleString()}
                  </p>
                  <button
                    className="btn-primary"
                    style={{ marginTop: '0.5rem' }}
                    type="button"
                    onClick={() => handleApproveSeller(seller._id)}
                    disabled={approvingId === seller._id}
                  >
                    {approvingId === seller._id ? 'Approving...' : 'Approve Seller'}
                  </button>
                </div>
              ))}
            </div>
          )}
          {error && <p className="auth-error" style={{ marginTop: '0.75rem' }}>{error}</p>}
          <button className="btn-secondary" type="button" style={{ marginTop: '0.75rem' }} onClick={loadPendingSellers}>
            Refresh
          </button>
        </div>
        <div className="dash-card"><h2>Reports</h2><p className="muted">View and resolve user reports</p></div>
        <div className="dash-card"><h2>Platform Stats</h2><p className="muted">Active users, orders, revenue</p></div>
      </div>
    </div>
  );
};

export default AdminDashboard;

