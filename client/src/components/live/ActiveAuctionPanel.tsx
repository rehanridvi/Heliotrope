import React, { useMemo, useState } from 'react';
import { AuctionPayload, cancelAuction } from '../../services/auctionService';

type Props = {
  auction: AuctionPayload;
  secondsRemaining: number | null;
};

const formatTime = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

const ActiveAuctionPanel: React.FC<Props> = ({ auction, secondsRemaining }) => {
  const [isCancelling, setIsCancelling] = useState(false);

  const timerClass = useMemo(() => {
    const s = secondsRemaining ?? 0;
    if (s <= 10) return 'auction-timer auction-timer-critical pulse-red';
    if (s <= 30) return 'auction-timer auction-timer-critical';
    if (s <= 60) return 'auction-timer auction-timer-warn';
    return 'auction-timer auction-timer-safe';
  }, [secondsRemaining]);

  const handleCancel = async () => {
    const confirmed = window.confirm('Cancel this auction? This action cannot be undone.');
    if (!confirmed) return;
    setIsCancelling(true);
    try {
      await cancelAuction(auction._id);
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <div className="dash-card active-auction-panel">
      <div className="active-auction-header">
        <h3>LIVE AUCTION <span className="live-badge-dot" /></h3>
        <div className={timerClass}>{formatTime(Math.max(secondsRemaining ?? 0, 0))}</div>
      </div>
      <div className="active-auction-product">
        {auction.productSnapshot.images?.[0] ? <img src={auction.productSnapshot.images[0]} alt={auction.productSnapshot.name} /> : <div className="product-image-placeholder">No image</div>}
        <div>
          <h4>{auction.productSnapshot.name}</h4>
          <p className="muted">{auction.productSnapshot.description || 'No description provided.'}</p>
          <p>Base price: ৳{auction.basePrice}</p>
          <p>Current highest bid: ৳{auction.currentBid}</p>
          <p>Current leader: {auction.bids.length ? auction.bids[auction.bids.length - 1].bidderName : 'No bids yet'}</p>
        </div>
      </div>

      <div className="auction-history">
        <strong>Bid history</strong>
        <div className="auction-history-list">
          {auction.bids.length === 0 ? (
            <p className="muted">No bids placed yet.</p>
          ) : (
            auction.bids.map((bid, idx) => (
              <div className="auction-bid-row" key={`${bid.bidderId}_${idx}`}>
                <span>{bid.bidderName}</span>
                <span>৳{bid.amount}</span>
                <span className="muted">{new Date(bid.placedAt).toLocaleTimeString()}</span>
              </div>
            ))
          )}
        </div>
      </div>

      <button className="btn-danger" type="button" onClick={handleCancel} disabled={isCancelling}>
        {isCancelling ? 'Cancelling...' : 'Cancel Auction'}
      </button>
    </div>
  );
};

export default ActiveAuctionPanel;
