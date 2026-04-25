import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../services/api';

const StorefrontPage: React.FC = () => {
  const { slug } = useParams();
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    if (slug) api.get(`/marketplace/storefronts/${slug}`).then((res) => setData(res.data));
  }, [slug]);

  if (!data) return <div className="dash-wrap"><p className="muted">Loading...</p></div>;

  return (
    <div className="dash-wrap">
      <div className="dash-header">
        <h1>{data.storefront?.storeName}</h1>
        <p className="muted">{data.storefront?.description}</p>
      </div>
      <div className="products-grid">
        {(data.products || []).map((p: any) => (
          <div key={p._id} className="product-card">
            <div className="product-image-placeholder">👜</div>
            <div className="product-body">
              <h3 className="product-title">{p.name}</h3>
              <div className="product-price-row"><span className="product-new-price">৳{p.price}</span></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default StorefrontPage;
