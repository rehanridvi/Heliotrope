import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const api = axios.create({ baseURL: `${API_URL}/api/closet` });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const getClosetItems = async (type?: string) => {
  const res = await api.get('/items', { params: { type } });
  return res.data.items || [];
};

export const createClosetItem = async (formData: FormData) => {
  const res = await api.post('/items', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
  return res.data.item;
};

export const updateClosetItem = async (id: string, formData: FormData) => {
  const res = await api.patch(`/items/${id}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
  return res.data.item;
};

export const deleteClosetItem = async (id: string) => {
  await api.delete(`/items/${id}`);
};

