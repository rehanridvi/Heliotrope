import { io, type Socket } from 'socket.io-client';
import { API_ORIGIN } from '../api';

export type StreamComment = {
  id: string;
  streamId: string;
  name: string;
  text: string;
  ts: number;
};

export type StreamReaction = {
  id: string;
  streamId: string;
  name: string;
  reaction: string;
  ts: number;
};

export type RealtimeEvents = {
  'stream:joined': (payload: { streamId: string }) => void;
  'stream:comment': (payload: StreamComment) => void;
  'stream:reaction': (payload: StreamReaction) => void;
};

export type RealtimeClientEvents = {
  'stream:join': (payload: { streamId: string; name: string }) => void;
  'stream:comment': (payload: { streamId: string; text: string }) => void;
  'stream:reaction': (payload: { streamId: string; reaction: string }) => void;
};

export function createRealtimeSocket(): Socket<RealtimeEvents, RealtimeClientEvents> {
  return io(API_ORIGIN, {
    withCredentials: true,
    transports: ['websocket'],
    reconnection: true,
    reconnectionDelay: 100,
    reconnectionDelayMax: 500,
    reconnectionAttempts: Infinity,
  });
}

