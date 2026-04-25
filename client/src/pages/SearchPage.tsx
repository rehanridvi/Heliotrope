// client/src/pages/SearchPage.tsx
import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Navbar from '../components/layout/Navbar';
import { searchProducts, SearchParams } from '../services/searchService';

const categories = ['All', 'Fashion', 'Jewelry', 'Handmade', 'Home', 'Beauty', 'Art', 'Food', 'Other'];

const SearchPage: React.FC = () => {
  const [sp, setSp] = useSearchParams();

  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);

  const q = sp.get('q') || '';
  const category = sp.get('category') || 'All';
  const minPrice = Number(sp.get('minPrice') || 0);
  const maxPrice = Number(sp.get('maxPrice') || 100000);
  const minRating = Number(sp.get('minRating') || 0);
  const verifiedOnly = sp.get('verifiedOnly') === 'true';
  const inStockOnly = sp.get('inStockOnly') === 'true';
  const sort = (sp.get('sort') || 'relevance') as SearchParams['sort'];
  const page = Number(sp.get('page') || 1);

  const [priceMinInput, setPriceMinInput] = useState(String(minPrice));
  const [priceMaxInput, setPriceMaxInput] = useState(String(maxPrice));
  const [qInput, setQInput] = useState(q);

  useEffect(() => {
    setQInput(q);
    setPriceMinInput(String(minPrice));
    setPriceMaxInput(String(maxPrice));
  }, [q, minPrice, maxPrice]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const data = await searchProducts({
        q,
        category: category === 'All' ? undefined : category,
        minPrice: minPrice > 0 ? minPrice : undefined,
        maxPrice: maxPrice < 100000 ? maxPrice : undefined,
        minRating: minRating > 0 ? minRating : undefined,
        verifiedOnly,
        inStockOnly,
        sort,
        page,
        limit: 12,
      });
      setItems(data.products.items || []);
      setTotal(data.products.total || 0);
      setPages(data.products.pages || 1);
    } catch (error) {
      console.error('Search failed:', error);
      setItems([]);
      setTotal(0);
      setPages(1);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, category, minPrice, maxPrice, minRating, verifiedOnly, inStockOnly, sort, page]);

  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(sp);
    if (!value || value === 'All') next.delete(key);
    else next.set(key, value);
    next.set('page', '1');
    setSp(next);
  };

  const setBool = (key: string, val: boolean) => {
    const next = new URLSearchParams(sp);
    if (!val) next.delete(key);
    else next.set(key, 'true');
    next.set('page', '1');
    setSp(next);
  };

  const doSearch = () => {
    const next = new URLSearchParams(sp);
    if (!qInput.trim()) next.delete('q');
    else next.set('q', qInput.trim());
    next.set('page', '1');
    setSp(next);
  };

  const applyPrice = () => {
    const next = new URLSearchParams(sp);
    const min = Math.max(0, Number(priceMinInput) || 0);
    const max = Math.max(min, Number(priceMaxInput) || 0);
    if (min > 0) next.set('minPrice', String(min));
    else next.delete('minPrice');
    if (max > 0 && max < 100000) next.set('maxPrice', String(max));
    else next.delete('maxPrice');
    next.set('page', '1');
    setSp(next);
  };

  const resetAll = () => {
    setSp(new URLSearchParams({}));
    setQInput('');
    setPriceMinInput('0');
    setPriceMaxInput('100000');
  };

  const gotoPage = (p: number) => {
    const next = new URLSearchParams(sp);
    next.set('page', String(p));
    setSp(next);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f4f4f5' }}>
      <Navbar />

      <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '16px 24px' }}>
        <div style={{ display: 'flex', gap: 12, maxWidth: '100%', alignItems: 'center' }}>
          <span style={{ color: '#9ca3af', fontSize: 18 }}>🔎</span>
          <input
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            placeholder="Search products..."
            onKeyDown={(e) => e.key === 'Enter' && doSearch()}
            style={{ flex: 1, padding: '10px 14px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 15 }}
          />
          <button
            onClick={doSearch}
            style={{ padding: '10px 22px', borderRadius: 8, background: '#6d28d9', color: '#fff', border: 'none', fontWeight: 600, cursor: 'pointer' }}
          >
            Search
          </button>
          {sp.toString() && (
            <button
              onClick={resetAll}
              style={{ padding: '10px 16px', borderRadius: 8, background: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', fontWeight: 500, cursor: 'pointer' }}
            >
              Reset
            </button>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', maxWidth: '100%', minHeight: 'calc(100vh - 140px)' }}>
        {/* Sidebar */}
        <aside style={{ width: '25%', minWidth: 220, maxWidth: 320, background: '#fff', borderRight: '1px solid #e5e7eb', padding: '20px 16px', overflowY: 'auto' }}>
          <h3 style={{ margin: '0 0 14px', fontSize: 16, color: '#111827' }}>Filters</h3>

          {/* Category */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Category</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {categories.map((c) => (
                <button
                  key={c}
                  onClick={() => updateParam('category', c)}
                  style={{
                    textAlign: 'left', padding: '6px 10px', borderRadius: 6, border: 'none',
                    background: category === c ? '#f5f3ff' : 'transparent',
                    color: category === c ? '#6d28d9' : '#374151',
                    fontWeight: category === c ? 600 : 400,
                    cursor: 'pointer', fontSize: 14,
                  }}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Price */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Price Range</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="number" min={0} value={priceMinInput} onChange={(e) => setPriceMinInput(e.target.value)}
                style={{ width: '45%', padding: '6px 8px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 14 }} />
              <span style={{ color: '#9ca3af' }}>—</span>
              <input type="number" min={0} value={priceMaxInput} onChange={(e) => setPriceMaxInput(e.target.value)}
                style={{ width: '45%', padding: '6px 8px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 14 }} />
            </div>
            <button onClick={applyPrice}
              style={{ marginTop: 8, width: '100%', padding: '6px 0', borderRadius: 6, background: '#f5f3ff', color: '#6d28d9', border: '1px solid #ddd6fe', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
              Apply Price
            </button>
          </div>

          {/* Rating */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Min Rating</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[0, 1, 2, 3, 4, 5].map((r) => (
                <button key={r} onClick={() => updateParam('minRating', String(r))}
                  style={{
                    padding: '5px 10px', borderRadius: 6, border: '1px solid #e5e7eb',
                    background: minRating === r ? '#fefce8' : '#fff',
                    color: minRating === r ? '#a16207' : '#374151',
                    fontWeight: minRating === r ? 600 : 400, cursor: 'pointer', fontSize: 13,
                  }}>
                  {r === 0 ? 'Any' : `${r}★`}
                </button>
              ))}
            </div>
          </div>

          {/* Options */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Options</div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#374151', cursor: 'pointer', marginBottom: 6 }}>
              <input type="checkbox" checked={verifiedOnly} onChange={(e) => setBool('verifiedOnly', e.target.checked)} />
              Verified sellers only
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#374151', cursor: 'pointer' }}>
              <input type="checkbox" checked={inStockOnly} onChange={(e) => setBool('inStockOnly', e.target.checked)} />
              In stock only
            </label>
          </div>

          {/* Sort */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Sort By</div>
            <select value={sort} onChange={(e) => updateParam('sort', e.target.value)}
              style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 14, background: '#fff' }}>
              <option value="relevance">Most Relevant</option>
              <option value="newest">Newest</option>
              <option value="priceAsc">Price: Low to High</option>
              <option value="priceDesc">Price: High to Low</option>
              <option value="highestRated">Highest Rated</option>
              <option value="mostPopular">Most Popular</option>
            </select>
          </div>
        </aside>

        {/* Products */}
        <main style={{ flex: 1, padding: '20px 24px', minWidth: 0 }}>
          <div style={{ marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 14, color: '#6b7280' }}>
              {loading ? 'Loading...' : `${total} result(s)`}
            </div>
          </div>

          {!loading && items.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', background: '#fff', borderRadius: 12, border: '1px dashed #d1d5db' }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#111827', marginBottom: 8 }}>No results found</div>
              <div style={{ color: '#6b7280', marginBottom: 18 }}>Try different keywords or adjust filters</div>
              <button onClick={resetAll}
                style={{ padding: '10px 22px', borderRadius: 8, background: '#6d28d9', color: '#fff', border: 'none', fontWeight: 600, cursor: 'pointer' }}>
                Clear Filters
              </button>
            </div>
          ) : (
            <>
              <div className="products-grid">
                {items.map((p) => (
                  <Link to={`/products/${p._id}`} key={p._id} style={{ textDecoration: 'none', color: 'inherit' }}>
                    <article className="product-card">
                      <div className="product-image-placeholder">
                        {p.images?.[0] ? (
                          <img src={p.images[0]} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : '👜'}
                      </div>
                      <div className="product-body">
                        <h3 className="product-title">{p.name}</h3>
                        <p style={{ fontSize: 13, color: '#6b7280', margin: '2px 0' }}>
                          {p.seller?.name}{p.seller?.district ? ` • ${p.seller.district}` : ''}
                          {p.seller?.isVerifiedSeller ? ' ✓' : ''}
                        </p>
                        <div className="product-price-row">
                          <span className="product-new-price">৳{p.price}</span>
                          <span style={{ fontSize: 13, color: '#6b7280' }}>⭐ {p.ratingAverage ?? 0} ({p.ratingCount ?? 0})</span>
                        </div>
                      </div>
                    </article>
                  </Link>
                ))}
              </div>

              {!loading && pages > 1 && (
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 24, flexWrap: 'wrap' }}>
                  <button disabled={page <= 1} onClick={() => gotoPage(page - 1)}
                    style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid #d1d5db', background: page <= 1 ? '#f3f4f6' : '#fff', cursor: page <= 1 ? 'not-allowed' : 'pointer' }}>
                    Prev
                  </button>
                  <span style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#f9fafb' }}>
                    Page {page} / {pages}
                  </span>
                  <button disabled={page >= pages} onClick={() => gotoPage(page + 1)}
                    style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid #d1d5db', background: page >= pages ? '#f3f4f6' : '#fff', cursor: page >= pages ? 'not-allowed' : 'pointer' }}>
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
};

export default SearchPage;