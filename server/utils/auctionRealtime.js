import Auction from "../models/Auction.js";
import User from "../models/User.js";
import Product from "../models/Product.js";
import Order from "../models/Order.js";
import { notifyUser } from "./notify.js";

let ioInstance = null;
const auctionIntervals = new Map();

export const setAuctionIO = (io) => {
  ioInstance = io;
};

export const getAuctionIntervals = () => auctionIntervals;

const emitToSession = (liveSessionId, event, payload) => {
  if (!ioInstance || !liveSessionId) return;
  ioInstance.to(String(liveSessionId)).emit(event, payload);
};

const clearAuctionInterval = (auctionId) => {
  const existing = auctionIntervals.get(String(auctionId));
  if (existing) {
    clearInterval(existing);
    auctionIntervals.delete(String(auctionId));
  }
};

const sendWinnerNotification = async (auction) => {
  if (!auction.winnerId) return;

  const [winner, seller, product] = await Promise.all([
    User.findById(auction.winnerId).select("name email"),
    User.findById(auction.sellerId).select("name email"),
    Product.findById(auction.productId).select("name"),
  ]);

  if (!winner) return;

  const productName = auction.productSnapshot?.name || product?.name || "your auction product";
  const sellerName = seller?.name || "Seller";
  const finalBid = Number(auction.currentBid) || Number(auction.basePrice) || 0;
  const subject = "You won the auction on Heliotrope!";
  const body = `Product: ${productName}\nFinal bid: BDT ${finalBid}\nSeller: ${sellerName}`;
  const emailHtml = `
    <h2>You won the auction on Heliotrope!</h2>
    <p>Congratulations, ${winner.name || "there"}.</p>
    <p><strong>Product:</strong> ${productName}</p>
    <p><strong>Final bid:</strong> BDT ${finalBid}</p>
    <p><strong>Seller:</strong> ${sellerName}</p>
    <p>Next step: contact the seller in Heliotrope to complete the order.</p>
  `;

  await notifyUser({
    userId: auction.winnerId,
    type: "order",
    title: "You won an auction",
    body,
    link: `/live/${auction.liveSessionId}`,
    meta: { auctionId: String(auction._id), finalBid, sellerId: String(auction.sellerId) },
    emailSubject: subject,
    emailHtml,
    sendEmail: true,
  });

  await Order.create({
    buyer: auction.winnerId,
    seller: auction.sellerId,
    items: [
      {
        product: auction.productId,
        quantity: 1,
        priceAtPurchase: finalBid,
      },
    ],
    totalAmount: finalBid,
    status: "pending",
  }).catch((err) => {
    console.error("Failed to create post-auction order:", err?.message || err);
  });
};

export const finalizeAuction = async (auctionId) => {
  clearAuctionInterval(auctionId);

  const auction = await Auction.findById(auctionId);
  if (!auction || auction.status !== "active") return auction;

  auction.status = "ended";
  auction.winnerId = auction.currentWinnerId || null;
  await auction.save();

  if (!auction.winnerId) {
    emitToSession(auction.liveSessionId, "auction:ended", {
      auctionId: String(auction._id),
      winnerId: null,
      winnerName: null,
      finalBid: auction.currentBid,
      message: "No bids were placed",
    });
    return auction;
  }

  const winner = await User.findById(auction.winnerId).select("name");
  emitToSession(auction.liveSessionId, "auction:ended", {
    auctionId: String(auction._id),
    winnerId: String(auction.winnerId),
    winnerName: winner?.name || "Winner",
    finalBid: auction.currentBid,
  });

  await sendWinnerNotification(auction);
  return auction;
};

export const startAuctionTimer = (auctionDocOrObj) => {
  if (!auctionDocOrObj?._id) return;
  const auctionId = String(auctionDocOrObj._id);
  const liveSessionId = String(auctionDocOrObj.liveSessionId);
  const endTs = new Date(auctionDocOrObj.endTime).getTime();

  clearAuctionInterval(auctionId);

  const tick = async () => {
    const secondsRemaining = Math.max(0, Math.ceil((endTs - Date.now()) / 1000));
    emitToSession(liveSessionId, "auction:tick", { auctionId, secondsRemaining });
    if (secondsRemaining <= 0) {
      await finalizeAuction(auctionId);
    }
  };

  tick().catch(() => {});
  const intervalId = setInterval(() => {
    tick().catch((err) => {
      console.error("auction timer tick failed:", err?.message || err);
    });
  }, 1000);
  auctionIntervals.set(auctionId, intervalId);
};

export const cancelAuction = async (auctionId) => {
  clearAuctionInterval(auctionId);
  const auction = await Auction.findById(auctionId);
  if (!auction || auction.status !== "active") return auction;

  auction.status = "cancelled";
  await auction.save();

  emitToSession(auction.liveSessionId, "auction:cancelled", { auctionId: String(auction._id) });
  return auction;
};
