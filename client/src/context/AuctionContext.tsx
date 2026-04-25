import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useSocket } from './SocketContext';
import { AuctionPayload, getAuctionBySession } from '../services/auctionService';
import { useAuth } from './AuthContext';

type AuctionEndState = {
  isOpen: boolean;
  winnerId: string | null;
  winnerName: string | null;
  finalBid: number;
  message?: string;
};

type AuctionContextValue = {
  auction: AuctionPayload | null;
  secondsRemaining: number | null;
  outbidMessage: string | null;
  endState: AuctionEndState | null;
  bidError: string | null;
  setLiveSessionId: (liveSessionId: string | null) => void;
  clearOutbidMessage: () => void;
  clearBidError: () => void;
  clearEndState: () => void;
};

const AuctionContext = createContext<AuctionContextValue | undefined>(undefined);

const emptyEndState: AuctionEndState | null = null;

export const AuctionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const socket = useSocket();
  const { user } = useAuth();
  const [liveSessionId, setLiveSessionIdState] = useState<string | null>(null);
  const [auction, setAuction] = useState<AuctionPayload | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null);
  const [outbidMessage, setOutbidMessage] = useState<string | null>(null);
  const [endState, setEndState] = useState<AuctionEndState | null>(emptyEndState);
  const [bidError, setBidError] = useState<string | null>(null);
  const clearTimerRef = useRef<number | null>(null);

  const setLiveSessionId = (nextLiveSessionId: string | null) => {
    setLiveSessionIdState(nextLiveSessionId);
  };

  useEffect(() => {
    if (!socket || !liveSessionId) return;
    socket.emit('auction:join_session', { liveSessionId });

    getAuctionBySession(liveSessionId)
      .then((activeAuction) => {
        if (!activeAuction) return;
        setAuction(activeAuction);
        const nextRemaining = Math.max(0, Math.ceil((new Date(activeAuction.endTime).getTime() - Date.now()) / 1000));
        setSecondsRemaining(nextRemaining);
      })
      .catch(() => {});

    return () => {
      socket.emit('auction:leave_session', { liveSessionId });
    };
  }, [socket, liveSessionId]);

  useEffect(() => {
    if (!socket) return;

    const onStarted = (payload: { auction: AuctionPayload }) => {
      setAuction(payload.auction);
      setEndState(emptyEndState);
      setBidError(null);
      const nextRemaining = Math.max(0, Math.ceil((new Date(payload.auction.endTime).getTime() - Date.now()) / 1000));
      setSecondsRemaining(nextRemaining);
    };

    const onTick = (payload: { auctionId: string; secondsRemaining: number }) => {
      setSecondsRemaining(payload.secondsRemaining);
      setAuction((prev) => (prev && prev._id === payload.auctionId ? prev : prev));
    };

    const onBidPlaced = (payload: {
      auctionId: string;
      currentBid: number;
      bidderId: string;
      bidderName: string;
      placedAt: string;
    }) => {
      setBidError(null);
      setAuction((prev) => {
        if (!prev || prev._id !== payload.auctionId) return prev;
        const nextBids = [
          ...prev.bids,
          {
            bidderId: payload.bidderId,
            bidderName: payload.bidderName,
            amount: payload.currentBid,
            placedAt: payload.placedAt,
          },
        ];
        return {
          ...prev,
          currentBid: payload.currentBid,
          currentWinnerId: payload.bidderId,
          bids: nextBids,
        };
      });
    };

    const onOutbid = (payload: { outbidUserId: string; newBid: number }) => {
      if (payload.outbidUserId === user?.id) {
        setOutbidMessage(`You've been outbid! Current bid: ৳${payload.newBid}`);
      }
    };

    const onEnded = (payload: {
      auctionId: string;
      winnerId: string | null;
      winnerName: string | null;
      finalBid: number;
      message?: string;
    }) => {
      setAuction((prev) => {
        if (!prev || prev._id !== payload.auctionId) return prev;
        return { ...prev, status: 'ended', winnerId: payload.winnerId };
      });
      setSecondsRemaining(0);
      setEndState({
        isOpen: true,
        winnerId: payload.winnerId,
        winnerName: payload.winnerName,
        finalBid: payload.finalBid,
        message: payload.message,
      });
      if (clearTimerRef.current) window.clearTimeout(clearTimerRef.current);
      clearTimerRef.current = window.setTimeout(() => {
        setAuction(null);
        setEndState(emptyEndState);
        setSecondsRemaining(null);
      }, 10000);
    };

    const onCancelled = () => {
      setAuction(null);
      setSecondsRemaining(null);
      setEndState({ isOpen: true, winnerId: null, winnerName: null, finalBid: 0, message: 'Auction was cancelled by seller' });
      if (clearTimerRef.current) window.clearTimeout(clearTimerRef.current);
      clearTimerRef.current = window.setTimeout(() => {
        setEndState(emptyEndState);
      }, 5000);
    };

    const onBidError = (payload: { message: string }) => {
      setBidError(payload.message || 'Bid failed');
    };

    socket.on('auction:started', onStarted);
    socket.on('auction:tick', onTick);
    socket.on('auction:bid_placed', onBidPlaced);
    socket.on('auction:outbid', onOutbid);
    socket.on('auction:ended', onEnded);
    socket.on('auction:cancelled', onCancelled);
    socket.on('auction:bid_error', onBidError);

    return () => {
      socket.off('auction:started', onStarted);
      socket.off('auction:tick', onTick);
      socket.off('auction:bid_placed', onBidPlaced);
      socket.off('auction:outbid', onOutbid);
      socket.off('auction:ended', onEnded);
      socket.off('auction:cancelled', onCancelled);
      socket.off('auction:bid_error', onBidError);
      if (clearTimerRef.current) window.clearTimeout(clearTimerRef.current);
    };
  }, [socket, user?.id]);

  const value = useMemo(
    () => ({
      auction,
      secondsRemaining,
      outbidMessage,
      endState,
      bidError,
      setLiveSessionId,
      clearOutbidMessage: () => setOutbidMessage(null),
      clearBidError: () => setBidError(null),
      clearEndState: () => setEndState(emptyEndState),
    }),
    [auction, bidError, endState, outbidMessage, secondsRemaining]
  );

  return <AuctionContext.Provider value={value}>{children}</AuctionContext.Provider>;
};

export const useAuction = () => {
  const ctx = useContext(AuctionContext);
  if (!ctx) throw new Error('useAuction must be used inside AuctionProvider');
  return ctx;
};
