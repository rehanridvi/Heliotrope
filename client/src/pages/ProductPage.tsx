import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { fetchProduct } from '../services/productService';

const ProductPage: React.FC = () => {
  const { id } = useParams();
  const [product, setProduct] = useState<any>(null);

  useEffect(() => {
    if (id) fetchProduct(id).then((data) => setProduct(data.product));
  }, [id]);

  if (!product) return <div className="dash-wrap"><p className="muted">Loading...</p></div>;

  return (
    <div className="dash-wrap">
      <div className="dash-card">
        <h1>{product.name}</h1>
        <p className="muted">{product.description}</p>
        <div className="price" style={{ marginTop: '1rem' }}>৳{product.price}</div>
      <Link to={`/products/${id}/review`} className="btn-primary" style={{ marginTop: '1rem', display: 'inline-block' }}>Write a Review</Link>
      </div>
    </div>
  );
};

export default ProductPage;
