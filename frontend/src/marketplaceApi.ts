import axios from 'axios';
import { API_ORIGIN } from './api';

const SELLER_ID = 'demo_seller_123';

export const marketplaceApi = axios.create({
  baseURL: `${API_ORIGIN}/api/marketplace`,
  headers: {
    'x-seller-id': SELLER_ID,
  },
});

/** Server accepts `sellerId` query as well as `x-seller-id` — query survives strict CORS/proxies. */
marketplaceApi.interceptors.request.use((config) => {
  config.params = {
    ...(typeof config.params === 'object' && config.params !== null
      ? config.params
      : {}),
    sellerId: SELLER_ID,
  };
  return config;
});

export interface SellerStorefront {
  _id: string;
  sellerId: string;
  storeName: string;
  slug: string;
  logoUrl?: string;
  bannerUrl?: string;
  description: string;
  categoryTags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface StorefrontProduct {
  _id: string;
  sellerId: string;
  storefrontId: string;
  name: string;
  description: string;
  price: number;
  imageUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export const listStorefrontSummaries = async (q?: string) => {
  const res = await marketplaceApi.get<{ storefronts: SellerStorefront[] }>(
    '/storefronts',
    { params: q ? { q } : undefined }
  );
  return res.data.storefronts;
};

export const getStorefrontPublic = async (slugOrId: string) => {
  const res = await marketplaceApi.get<{
    storefront: SellerStorefront;
    products: StorefrontProduct[];
  }>(`/storefronts/${encodeURIComponent(slugOrId)}`);
  return res.data;
};

export const getMyStorefront = async () => {
  const res = await marketplaceApi.get<{
    storefront: SellerStorefront | null;
    products: StorefrontProduct[];
  }>('/my-storefront');
  return res.data;
};

/** Redundant with query/header; ensures seller id survives strict proxies that strip query or headers on multipart. */
function ensureSellerIdOnFormData(formData: FormData) {
  if (!formData.get('sellerId')) {
    formData.append('sellerId', SELLER_ID);
  }
}

/** Do not set Content-Type for FormData — the runtime must add the multipart boundary. */
export const createStorefront = async (formData: FormData) => {
  ensureSellerIdOnFormData(formData);
  const res = await marketplaceApi.post<{ storefront: SellerStorefront }>(
    '/storefronts',
    formData
  );
  return res.data.storefront;
};

export const updateStorefront = async (id: string, formData: FormData) => {
  ensureSellerIdOnFormData(formData);
  const res = await marketplaceApi.patch<{ storefront: SellerStorefront }>(
    `/storefronts/${id}`,
    formData
  );
  return res.data.storefront;
};

export const createStoreProduct = async (
  storefrontId: string,
  formData: FormData
) => {
  ensureSellerIdOnFormData(formData);
  const res = await marketplaceApi.post<{ product: StorefrontProduct }>(
    `/storefronts/${storefrontId}/products`,
    formData
  );
  return res.data.product;
};

export const updateStoreProduct = async (
  productId: string,
  formData: FormData
) => {
  ensureSellerIdOnFormData(formData);
  const res = await marketplaceApi.patch<{ product: StorefrontProduct }>(
    `/products/${productId}`,
    formData
  );
  return res.data.product;
};

export const deleteStoreProduct = async (productId: string) => {
  await marketplaceApi.delete(`/products/${productId}`);
};
