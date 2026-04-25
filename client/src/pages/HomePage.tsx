import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { fetchProducts } from '../services/productService';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/layout/Navbar';

type Product = { _id: string; name: string; price: number; ratingAverage: number; ratingCount: number; seller?: { name: string } };

const quickTags = ['Jamdani saree', 'Terracotta jewelry', 'Nakshi kantha', 'Muslin kurta', 'Rickshaw art', 'Pottery'];
const filterTabs = ['All', 'Featured', 'Fashion', 'Jewelry', 'Handmade', 'Home', 'Beauty'];

const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);

  const loadProducts = async () => {
    setLoadingProducts(true);
    const data = await fetchProducts();
    setProducts(data.products || []);
    setLoadingProducts(false);
  };

  useEffect(() => { loadProducts(); }, []);

  const visibleProducts = useMemo(() => products.slice(0, 12), [products]);
  const goSearch = (q: string) => { const term = q.trim(); if (!term) return navigate('/search'); navigate(`/search?q=${encodeURIComponent(term)}`); };

  return (
    <>
      <Navbar />
      <section className="hero">
        <div className="hero-badge">✦ Bangladesh&apos;s Cultural Marketplace ✦</div>
        <h1 className="hero-title">Discover <span>Artisan</span> Excellence</h1>
        <p className="hero-subtitle">Made with mastery</p>
        <p className="hero-text">
          Heliotrope brings together Bangladesh&apos;s finest home-based artisans into one curated marketplace.
        </p>
        <div className="hero-search">
          <span style={{ color: '#9ca3af' }}>🔎</span>
          <input type="text" placeholder="Search products..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && goSearch(searchQuery)} />
          <button className="hero-search-btn" type="button" onClick={() => goSearch(searchQuery)}>Search</button>
        </div>
        <div className="hero-tags">
          {quickTags.map((tag) => (
            <button key={tag} className="hero-tag" type="button" onClick={() => goSearch(tag)}>{tag}</button>
          ))}
        </div>
        <div className="hero-ctas">
          <button className="btn-primary" type="button" onClick={() => navigate('/search')}>Explore Marketplace</button>
          <button className="btn-secondary" type="button" onClick={() => navigate('/live')}>Watch Live Sessions</button>
          {!user && (
            <button className="btn-secondary" type="button" onClick={() => navigate('/seller-signup')}>Register as Seller</button>
          )}
        </div>
      </section>

      <section className="section">
        <div className="section-header">
          <div>
            <p className="section-kicker">Curated For You</p>
            <h2 className="section-title">Artisan Marketplace</h2>
          </div>
          <button className="section-link" type="button" onClick={loadProducts}>Refresh →</button>
        </div>
        <div className="tabs">
          {filterTabs.map((tab) => (
            <button key={tab} type="button" className={`tab ${activeTab === tab ? 'active' : ''}`} onClick={() => setActiveTab(tab)}>{tab}</button>
          ))}
        </div>
        {loadingProducts ? (
          <p className="muted">Loading products...</p>
        ) : visibleProducts.length === 0 ? (
          <p className="muted">No products found.</p>
        ) : (
          <div className="products-grid">
            {visibleProducts.map((p) => (
              <Link to={`/products/${p._id}`} key={p._id} style={{ textDecoration: 'none', color: 'inherit' }}>
                <article className="product-card">
                  <div className="product-image-placeholder">👜</div>
                  <div className="product-body">
                    <h3 className="product-title">{p.name}</h3>
                    <p className="product-store">{p.seller?.name || 'Seller'}</p>
                    <div className="product-price-row">
                      <div><span className="product-new-price">৳{p.price}</span></div>
                      <div className="muted">⭐ {p.ratingAverage} ({p.ratingCount})</div>
                    </div>
                  </div>
                </article>
              </Link>
            ))}
          </div>
        )}
      </section>
    </>
  );
};

export default HomePage;
