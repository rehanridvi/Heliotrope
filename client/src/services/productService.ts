import api from './api';

export const fetchProducts = async () => {
  const res = await api.get('/products');
  return res.data;
};

export const fetchProduct = async (id: string) => {
  const res = await api.get(`/products/${id}`);
  return res.data;
};

export const createProduct = async (formData: FormData) => {
  const res = await api.post('/products', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
  return res.data;
};

export const fetchMyProducts = async () => {
  const res = await api.get('/products/my');
  return res.data.products || [];
};
