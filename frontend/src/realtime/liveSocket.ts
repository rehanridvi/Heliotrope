import { io, type Socket } from 'socket.io-client';
import { API_ORIGIN } from '../api';

export const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    // Primary STUN servers
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    // Cloudflare STUN
    { urls: 'stun:stun.cloudflare.com:3478' },
    // Fallback public STUN servers
    { urls: 'stun:stun.stunprotocol.org:3478' },
    { urls: 'stun:stun.nextcloud.com:443' },
  ],
  iceCandidatePoolSize: 10,
};

export type LiveComment = {
  id: string;
  username: string;
  text: string;
  timestamp: number;
  avatar: string | null;
};

export type LiveReaction = {
  id: string;
  emoji: string;
  username: string;
  ts: number;
};

export type LiveServerToClientEvents = {
  'stream-started': (payload: { channelName: string }) => void;
  'stream-ended': (payload: { channelName: string }) => void;
  'new-viewer': (payload: {
    viewerId: string;
    viewerSocketId: string;
    viewerName?: string;
  }) => void;
  'seller-offer': (payload: {
    offer: RTCSessionDescriptionInit;
    sellerSocketId: string;
    channelName: string;
  }) => void;
  'viewer-answer': (payload: {
    answer: RTCSessionDescriptionInit;
    viewerSocketId: string;
    channelName: string;
  }) => void;
  'ice-candidate': (payload: {
    candidate: RTCIceCandidateInit;
    fromSocketId: string;
    channelName: string;
  }) => void;
  'viewer-left': (payload: { viewerSocketId: string; channelName: string }) => void;
  'viewer-count-update': (payload: { channelName: string; count: number }) => void;
  'new-comment': (payload: LiveComment) => void;
  'new-reaction': (payload: LiveReaction) => void;
  'product-pinned': (payload: {
    productId: string;
    name: string;
    price: number;
    image: string | null;
    link: string | null;
  }) => void;
  'product-unpinned': (payload: { channelName: string }) => void;
};

export type LiveClientToServerEvents = {
  'seller-start-stream': (payload: { channelName: string }) => void;
  'viewer-join': (payload: {
    channelName: string;
    viewerName: string;
    viewerSocketId: string;
  }) => void;
  'seller-offer': (payload: {
    offer: RTCSessionDescriptionInit;
    targetSocketId: string;
    channelName: string;
  }) => void;
  'viewer-answer': (payload: {
    answer: RTCSessionDescriptionInit;
    sellerSocketId: string;
    channelName: string;
  }) => void;
  'ice-candidate': (payload: {
    targetSocketId: string;
    candidate: RTCIceCandidateInit;
    channelName: string;
  }) => void;
  'viewer-leave': (payload: { channelName: string }) => void;
  'seller-end-stream': (payload: { channelName: string }) => void;
  'send-comment': (payload: {
    channelName: string;
    username: string;
    text: string;
    timestamp: number;
    avatar?: string | null;
  }) => void;
  'send-reaction': (payload: { channelName: string; emoji: string; username: string }) => void;
  'pin-product': (payload: {
    channelName: string;
    productId: string;
    name: string;
    price: number;
    image?: string | null;
    link?: string | null;
  }) => void;
  'unpin-product': (payload: { channelName: string }) => void;
};

export function createLiveSocket(): Socket<
  LiveServerToClientEvents,
  LiveClientToServerEvents
> {
  return io(API_ORIGIN, {
    withCredentials: true,
    transports: ['websocket'],
    reconnection: true,
    reconnectionDelay: 100,
    reconnectionDelayMax: 500,
    reconnectionAttempts: Infinity,
  });
}

