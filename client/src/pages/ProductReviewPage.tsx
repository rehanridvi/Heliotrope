import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { StarRating } from '../components/StarRating';

const ProductReviewPage: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [rating, setRating] = useState(0);
  const [text, setText] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`http://localhost:5000/api/reviews/product/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ rating, text }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message || 'Failed to submit review'); return; }
      navigate(`/products/${id}`);
    } catch { setError('Network error'); }
  };

  return (
    <div className="dash-wrap">
      <div className="dash-card">
        <h2>Write a Review</h2>
        <form onSubmit={handleSubmit} className="form" style={{ marginTop: '1rem' }}>
          <label>Rating<StarRating rating={rating} onRate={setRating} /></label>
          <label>Review<textarea value={text} onChange={(e) => setText(e.target.value)} required minLength={5} /></label>
          {error && <div className="auth-error">{error}</div>}
          <button type="submit" className="btn-primary">Submit Review</button>
        </form>
      </div>
    </div>
  );
};

export default ProductReviewPage;

