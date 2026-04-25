import React from 'react';
import { Star } from 'lucide-react';

interface StarRatingProps {
  rating: number;
  onRate?: (rating: number) => void;
  readonly?: boolean;
}

export const StarRating: React.FC<StarRatingProps> = ({ rating, onRate, readonly }) => {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {[1, 2, 3, 4, 5].map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => !readonly && onRate?.(s)}
          style={{ background: 'none', border: 'none', cursor: readonly ? 'default' : 'pointer', padding: 0 }}
        >
          <Star size={20} fill={s <= rating ? '#fbbf24' : 'transparent'} color={s <= rating ? '#fbbf24' : '#4b5563'} />
        </button>
      ))}
    </div>
  );
};

export default StarRating;

