import axios from 'axios';

// Backend default (see `HelioTrope/server.js`: PORT defaults to 1224).
// In dev/prod you can override with VITE_API_URL, e.g. http://localhost:1224
export const API_ORIGIN =
  import.meta.env.VITE_API_URL || 'http://localhost:1224';
const API_BASE = `${API_ORIGIN}/api/closet`;

export const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'x-user-id': 'demo_user_123', // Default for demo, should be dynamic in real app
  },
});

export type ClosetItemType = 'clothes' | 'accessories' | 'bags' | 'glasses' | 'shoes' | 'makeup';

export interface ClosetItem {
  _id: string;
  name: string;
  type: ClosetItemType;
  colors: string[];
  brand?: string;
  occasions: string[];
  imageUrl?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export const getImageUrl = (imageUrl?: string) => {
  if (!imageUrl) return '';
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    return imageUrl;
  }
  return `${API_ORIGIN}${imageUrl}`;
};

export const getItems = async (type?: string) => {
  const response = await api.get<{ items: ClosetItem[] }>('/items', {
    params: { type },
  });
  return response.data.items;
};

export const createItem = async (formData: FormData) => {
  const response = await api.post<{ item: ClosetItem }>('/items', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data.item;
};

export const updateItem = async (id: string, formData: FormData) => {
  const response = await api.patch<{ item: ClosetItem }>(`/items/${id}`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data.item;
};

export const deleteItem = async (id: string) => {
  await api.delete(`/items/${id}`);
};
