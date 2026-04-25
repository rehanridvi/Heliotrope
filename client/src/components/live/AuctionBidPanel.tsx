import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AuctionPayload } from '../../services/auctionService';
import { useSocket } from '../../context/SocketContext';
import { useAuth } from '../../context/AuthContext';
import { useAuction } from '../../context/AuctionContext';

type Props = {
  auction: AuctionPayload;
  secondsRemaining: number | null;
};

const formatTime = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

const AuctionBidPanel: React.FC<Props> = ({ auction, secondsRemaining }) => {
  const socket = useSocket();
  const { user } = useAuth();
  const { outbidMessage, clearOutbidMessage, bidError, clearBidError, endState, clearEndState } = useAuction();
  const [bidAmount, setBidAmount] = useState<number>(auction.currentBid + 1);
  const [isPlacing, setIsPlacing] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);

  const lastBid = auction.bids[auction.bids.length - 1];
  const isHighestBidder = lastBid?.bidderId === user?.id;

  const timerClass = useMemo(() => {
    const s = secondsRemaining ?? 0;
    if (s <= 10) return 'auction-timer auction-timer-critical pulse-red';
    if (s <= 30) return 'auction-timer auction-timer-critical';
    if (s <= 60) return 'auction-timer auction-timer-warn';
    return 'auction-timer auction-timer-safe';
  }, [secondsRemaining]);

  useEffect(() => {
    setBidAmount(auction.currentBid + 1);
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [auction.bids.length, auction.currentBid]);

  const placeBid = () => {
    clearBidError();
    if (!socket || !user?.id) return;
    if (Number(bidAmount) <= Number(auction.currentBid)) return;
    setIsPlacing(true);
    socket.emit('auction:place_bid', { auctionId: auction._id, bidAmount: Number(bidAmount), bidderId: user.id });
    window.setTimeout(() => setIsPlacing(false), 400);
  };

  return (
    <aside className="auction-bid-panel">
      <div className="auction-bid-header">
        <span className="live-badge">LIVE AUCTION <span className="live-badge-dot" /></span>
        <div className={timerClass}>{formatTime(Math.max(secondsRemaining ?? 0, 0))}</div>
      </div>

      <div className="auction-product-row">
        {auction.productSnapshot.images?.[0] ? <img src={auction.productSnapshot.images[0]} alt={auction.productSnapshot.name} /> : <div className="product-image-placeholder">No image</div>}
        <div>
          <strong>{auction.productSnapshot.name}</strong>
          <p>Current Bid: ৳{auction.currentBid}</p>
          <p>Current Leader: {lastBid?.bidderName || 'No bids yet'}</p>
        </div>
      </div>

      {outbidMessage && (
        <div className="auction-alert">
          {outbidMessage}
          <button type="button" onClick={clearOutbidMessage}>x</button>
        </div>
      )}

      <div className="auction-bid-input-wrap">
        <input
          type="number"
          min={auction.currentBid + 1}
          value={bidAmount}
          onChange={(e) => setBidAmount(Number(e.target.value))}
          disabled={isHighestBidder || isPlacing}
        />
        <button
          className="btn-primary"
          type="button"
          disabled={isHighestBidder || isPlacing || Number(bidAmount) <= Number(auction.currentBid)}
          onClick={placeBid}
        >
          {isPlacing ? 'Placing...' : 'Place Bid'}
        </button>
      </div>
      {bidError && <p className="auth-error">{bidError}</p>}

      <div className="auction-history">
        <strong>Latest bids</strong>
        <div className="auction-history-list" ref={listRef}>
          {(auction.bids || []).slice(-5).map((bid, idx) => (
            <div className="auction-bid-row" key={`${bid.bidderId}_${idx}`}>
              <span>{bid.bidderName}</span>
              <span>৳{bid.amount}</span>
              <span className="muted">{new Date(bid.placedAt).toLocaleTimeString()}</span>
            </div>
          ))}
          {auction.bids.length === 0 && <p className="muted">No bids yet.</p>}
        </div>
      </div>

      {endState?.isOpen && (
        <div className="modal-overlay">
          <div className="modal-card">
            {endState.winnerId === user?.id ? (
              <>
                <h3>Congratulations! You won {auction.productSnapshot.name}</h3>
                <p>Final bid: ৳{endState.finalBid}</p>
                <button className="btn-primary" type="button">Contact Seller</button>
              </>
            ) : (
              <>
                <h3>Auction ended</h3>
                <p>{endState.message || `Winner: ${endState.winnerName || 'N/A'} — ৳${endState.finalBid}`}</p>
              </>
            )}
            <button className="btn-secondary" type="button" onClick={clearEndState}>Close</button>
          </div>
        </div>
      )}
    </aside>
  );
};

export default AuctionBidPanel;
