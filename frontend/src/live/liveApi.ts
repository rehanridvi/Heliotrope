import axios from 'axios';
import { API_ORIGIN } from '../api';

export type LiveSession = {
  _id: string;
  sellerId: string;
  sellerName: string;
  channelName: string;
  title: string;
  isActive: boolean;
  viewerCount: number;
  pinnedProduct: null | {
    productId: string;
    name: string;
    price: number;
    image?: string | null;
    link?: string | null;
  };
  startedAt: string;
  endedAt: string | null;
  storefrontThumbnail?: string | null;
  storefrontName?: string | null;
  storefront?: null | { _id: string; slug: string; storeName: string };
};

const liveApi = axios.create({
  baseURL: `${API_ORIGIN}/api/live`,
  withCredentials: true,
});

export async function startLiveSession(payload: {
  sellerId: string;
  sellerName: string;
  title: string;
}) {
  const res = await liveApi.post<{ session: LiveSession }>('/start', payload);
  return res.data.session;
}

export async function endLiveSession(channelName: string) {
  const res = await liveApi.post<{ session: LiveSession }>(
    `/end/${encodeURIComponent(channelName)}`
  );
  return res.data.session;
}

export async function listActiveLiveSessions() {
  const res = await liveApi.get<{ sessions: LiveSession[] }>('/active');
  return res.data.sessions;
}

export async function getLiveSession(channelName: string) {
  const res = await liveApi.get<{ session: LiveSession }>(
    `/${encodeURIComponent(channelName)}`
  );
  return res.data.session;
}

