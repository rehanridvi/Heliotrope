import api from './api';

export type SearchParams = {
  q?: string;
  category?: string;
  district?: string;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  verifiedOnly?: boolean;
  inStockOnly?: boolean;
  sort?: 'relevance' | 'newest' | 'priceAsc' | 'priceDesc' | 'highestRated' | 'mostPopular';
  page?: number;
  limit?: number;
  fallback?: boolean;
};

export const searchProducts = async (params: SearchParams = {}) => {
  const res = await api.get('/search', { params });
  return res.data;
};