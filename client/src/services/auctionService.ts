import api from './api';

export type AuctionPayload = {
  _id: string;
  liveSessionId: string;
  sellerId: string;
  productId: string;
  productSnapshot: { name: string; images: string[]; description: string };
  basePrice: number;
  currentBid: number;
  currentWinnerId: string | null;
  durationSeconds: number;
  startTime: string;
  endTime: string;
  status: 'pending' | 'active' | 'ended' | 'cancelled';
  bids: Array<{ bidderId: string; bidderName: string; amount: number; placedAt: string }>;
  winnerId: string | null;
  winnerConfirmed: boolean;
};

export const startAuction = async (payload: {
  liveSessionId: string;
  productId: string;
  basePrice: number;
  durationSeconds: number;
}) => {
  const res = await api.post('/auctions/start', payload);
  return res.data.auction as AuctionPayload;
};

export const getAuctionBySession = async (liveSessionId: string) => {
  const res = await api.get(`/auctions/session/${liveSessionId}`);
  return (res.data.auction || null) as AuctionPayload | null;
};

export const cancelAuction = async (auctionId: string) => {
  const res = await api.patch(`/auctions/${auctionId}/cancel`);
  return res.data;
};

export const getAuctionResult = async (auctionId: string) => {
  const res = await api.get(`/auctions/${auctionId}/result`);
  return res.data;
};
