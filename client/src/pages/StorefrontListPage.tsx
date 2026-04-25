import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Store } from 'lucide-react';
import api from '../services/api';

const StorefrontListPage: React.FC = () => {
  const [storefronts, setStorefronts] = useState<any[]>([]);

  useEffect(() => {
    api.get('/marketplace/storefronts').then((res) => setStorefronts(res.data.storefronts || []));
  }, []);

  return (
    <div className="dash-wrap">
      <div className="dash-header"><h1>Seller Storefronts</h1><p className="muted">Discover trusted artisans</p></div>
      <div className="products-grid">
        {storefronts.map((sf) => (
          <Link to={`/storefronts/${sf.slug}`} key={sf._id} style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="product-card">
              <div className="product-image-placeholder"><Store size={48} /></div>
              <div className="product-body">
                <h3 className="product-title">{sf.storeName}</h3>
                <p className="product-store">{sf.description?.slice(0, 60) || 'No description'}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default StorefrontListPage;

