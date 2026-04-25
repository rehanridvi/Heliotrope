import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Radio, Users } from 'lucide-react';
import { getActiveSessions } from '../services/liveService';

type Session = {
  channelName: string;
  sellerName: string;
  title: string;
  viewerCount: number;
  storefrontThumbnail?: string | null;
};

const LiveDiscoveryPage: React.FC = () => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getActiveSessions()
      .then((data) => setSessions(data || []))
      .catch(() => setSessions([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="dash-wrap">
      <div className="dash-header">
        <h1>Live Streams</h1>
        <p className="muted">Watch artisans showcase their products in real time</p>
      </div>

      {loading ? (
        <p className="muted">Loading live streams...</p>
      ) : sessions.length === 0 ? (
        <div className="dash-card" style={{ textAlign: 'center', padding: '3rem' }}>
          <Radio size={48} color="#1f2937" style={{ marginBottom: '1rem' }} />
          <h3>No live streams right now</h3>
          <p className="muted">Check back later or explore the marketplace</p>
          <Link to="/search" className="btn-primary" style={{ marginTop: '1rem', display: 'inline-block' }}>Explore Marketplace</Link>
        </div>
      ) : (
        <div className="products-grid">
          {sessions.map((s) => (
            <Link to={`/live/${s.channelName}`} key={s.channelName} style={{ textDecoration: 'none', color: 'inherit' }}>
              <div className="product-card">
                <div className="product-image-placeholder" style={{ position: 'relative' }}>
                  {s.storefrontThumbnail ? (
                    <img src={s.storefrontThumbnail} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <Radio size={48} />
                  )}
                  <div style={{ position: 'absolute', top: 12, left: 12, display: 'flex', alignItems: 'center', gap: 6, background: 'linear-gradient(135deg, #ef4444, #b91c1c)', padding: '4px 10px', borderRadius: 999, fontSize: '0.75rem', fontWeight: 700, color: 'white' }}>
                    <span style={{ width: 8, height: 8, borderRadius: 999, background: 'white' }} /> LIVE
                  </div>
                </div>
                <div className="product-body">
                  <h3 className="product-title">{s.title}</h3>
                  <p className="product-store">{s.sellerName}</p>
                  <div className="product-price-row">
                    <span className="muted" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Users size={14} /> {s.viewerCount} watching
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default LiveDiscoveryPage;
