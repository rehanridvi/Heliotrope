import React, { useEffect, useMemo, useState } from 'react';
import { fetchMyProducts } from '../../services/productService';
import { startAuction } from '../../services/auctionService';

type ProductOption = {
  _id: string;
  name: string;
};

type Props = {
  liveSessionId: string;
  hasActiveAuction: boolean;
};

const durationOptions = [
  { label: '1 min', value: 60 },
  { label: '2 min', value: 120 },
  { label: '5 min', value: 300 },
  { label: '10 min', value: 600 },
];

const AuctionLauncher: React.FC<Props> = ({ liveSessionId, hasActiveAuction }) => {
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [productId, setProductId] = useState('');
  const [basePrice, setBasePrice] = useState(1);
  const [durationSeconds, setDurationSeconds] = useState(60);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [productsLoading, setProductsLoading] = useState(true);

  useEffect(() => {
    setProductsLoading(true);
    fetchMyProducts()
      .then((items) => {
        const list = (items || []).map((p: { _id: string; name: string }) => ({ _id: p._id, name: p.name }));
        setProducts(list);
        if (list.length > 0 && !productId) {
          setProductId(list[0]._id);
        }
      })
      .catch((err) => {
        console.error('Failed to fetch products:', err);
        setProducts([]);
      })
      .finally(() => {
        setProductsLoading(false);
      });
  }, []);

  const disabled = useMemo(() => {
    return isLoading || hasActiveAuction || !productId || basePrice < 1 || productsLoading || products.length === 0;
  }, [basePrice, hasActiveAuction, isLoading, productId, productsLoading, products.length]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productId) {
      setError('Please select a product');
      return;
    }
    setError(null);
    setIsLoading(true);
    try {
      const result = await startAuction({ liveSessionId, productId, basePrice: Number(basePrice), durationSeconds });
      console.log('Auction started successfully:', result);
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to start auction';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  if (productsLoading) {
    return (
      <div className="dash-card auction-launcher">
        <h3>Launch Live Auction</h3>
        <p className="muted">Loading products...</p>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="dash-card auction-launcher">
        <h3>Launch Live Auction</h3>
        <p className="auth-error">No products available. Please create a product first.</p>
      </div>
    );
  }

  return (
    <form className="dash-card auction-launcher" onSubmit={onSubmit}>
      <h3>Launch Live Auction</h3>
      <p className="muted">You can only run one auction at a time per live session.</p>
      <div className="auction-grid">
        <label className="auth-field">
          <span>Product</span>
          <select value={productId} onChange={(e) => setProductId(e.target.value)} disabled={isLoading || hasActiveAuction || productsLoading}>
            <option value="">Select a product</option>
            {products.map((p) => (
              <option key={p._id} value={p._id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="auth-field">
          <span>Base Price (BDT)</span>
          <input type="number" min={1} value={basePrice} onChange={(e) => setBasePrice(Number(e.target.value))} disabled={isLoading || hasActiveAuction} />
        </label>
        <label className="auth-field">
          <span>Auction Duration</span>
          <select value={durationSeconds} onChange={(e) => setDurationSeconds(Number(e.target.value))} disabled={isLoading || hasActiveAuction}>
            {durationOptions.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {error && <p className="auth-error">{error}</p>}
      <button className="btn-primary" type="submit" disabled={disabled}>
        {isLoading ? 'Starting...' : 'Start Auction'}
      </button>
    </form>
  );
};

export default AuctionLauncher;
