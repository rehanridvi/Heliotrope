import { Router } from "express";
import mongoose from "mongoose";
import Auction from "../models/Auction.js";
import Product from "../models/Product.js";
import LiveSession from "../models/LiveSession.js";
import User from "../models/User.js";
import { protect } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";
import { startAuctionTimer, cancelAuction } from "../utils/auctionRealtime.js";

const router = Router();

const serializeAuction = (auctionDoc) => {
  const auction = auctionDoc.toObject ? auctionDoc.toObject() : auctionDoc;
  return {
    ...auction,
    _id: String(auction._id),
    liveSessionId: String(auction.liveSessionId),
    sellerId: String(auction.sellerId),
    productId: String(auction.productId),
    currentWinnerId: auction.currentWinnerId ? String(auction.currentWinnerId) : null,
    winnerId: auction.winnerId ? String(auction.winnerId) : null,
    bids: (auction.bids || []).map((b) => ({
      bidderId: String(b.bidderId),
      bidderName: b.bidderName,
      amount: b.amount,
      placedAt: b.placedAt,
    })),
  };
};

router.post("/start", protect, authorizeRoles("seller"), async (req, res) => {
  try {
    const { liveSessionId, productId, basePrice, durationSeconds } = req.body || {};
    if (!liveSessionId || !productId || !basePrice || !durationSeconds) {
      return res.status(400).json({ message: "liveSessionId, productId, basePrice, durationSeconds are required" });
    }

    if (!mongoose.Types.ObjectId.isValid(String(liveSessionId))) {
      return res.status(400).json({ message: "Invalid liveSessionId" });
    }
    if (!mongoose.Types.ObjectId.isValid(String(productId))) {
      return res.status(400).json({ message: "Invalid productId" });
    }

    const [session, product, activeExisting] = await Promise.all([
      LiveSession.findById(liveSessionId).lean(),
      Product.findById(productId).lean(),
      Auction.findOne({ liveSessionId, status: "active" }).lean(),
    ]);

    if (!session) return res.status(404).json({ message: "Live session not found" });
    if (String(session.sellerId) !== String(req.user._id)) {
      return res.status(403).json({ message: "You do not own this live session" });
    }
    if (!product || String(product.seller) !== String(req.user._id)) {
      return res.status(403).json({ message: "You do not own this product" });
    }
    if (activeExisting) {
      return res.status(409).json({ message: "An auction is already active for this live session" });
    }

    const now = new Date();
    const parsedDuration = Number(durationSeconds);
    const parsedBase = Number(basePrice);
    const endTime = new Date(now.getTime() + parsedDuration * 1000);

    const auction = await Auction.create({
      liveSessionId,
      sellerId: req.user._id,
      productId,
      productSnapshot: {
        name: product.name || "Product",
        images: Array.isArray(product.images) ? product.images : [],
        description: product.description || "",
      },
      basePrice: parsedBase,
      currentBid: parsedBase,
      currentWinnerId: null,
      durationSeconds: parsedDuration,
      startTime: now,
      endTime,
      status: "active",
      bids: [],
    });

    startAuctionTimer(auction);
    req.app.get("io")?.to(String(liveSessionId)).emit("auction:started", {
      auction: serializeAuction(auction),
    });

    return res.status(201).json({ auction: serializeAuction(auction) });
  } catch (error) {
    console.error("POST /api/auctions/start failed:", error);
    return res.status(500).json({ message: "Failed to start auction" });
  }
});

router.get("/session/:liveSessionId", async (req, res) => {
  try {
    const { liveSessionId } = req.params;
    const activeAuction = await Auction.findOne({ liveSessionId, status: "active" })
      .sort({ createdAt: -1 })
      .lean();
    if (!activeAuction) return res.json({ auction: null });
    return res.json({ auction: serializeAuction(activeAuction) });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load live session auction" });
  }
});

router.get("/:auctionId", async (req, res) => {
  try {
    const auction = await Auction.findById(req.params.auctionId).lean();
    if (!auction) return res.status(404).json({ message: "Auction not found" });
    return res.json({ auction: serializeAuction(auction) });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load auction" });
  }
});

router.patch("/:auctionId/cancel", protect, authorizeRoles("seller"), async (req, res) => {
  try {
    const auction = await Auction.findById(req.params.auctionId);
    if (!auction) return res.status(404).json({ message: "Auction not found" });
    if (String(auction.sellerId) !== String(req.user._id)) {
      return res.status(403).json({ message: "You do not own this auction" });
    }
    if (auction.status !== "active") {
      return res.status(409).json({ message: "Auction is not active" });
    }

    await cancelAuction(auction._id);
    return res.json({ message: "Auction cancelled" });
  } catch (error) {
    return res.status(500).json({ message: "Failed to cancel auction" });
  }
});

router.get("/:auctionId/result", async (req, res) => {
  try {
    const auction = await Auction.findById(req.params.auctionId).lean();
    if (!auction) return res.status(404).json({ message: "Auction not found" });
    if (auction.status !== "ended") {
      return res.status(409).json({ message: "Auction has not ended yet" });
    }

    if (!auction.winnerId) {
      return res.json({
        winner: null,
        finalBid: auction.currentBid,
        product: auction.productSnapshot,
      });
    }

    const winner = await User.findById(auction.winnerId).select("name email").lean();
    return res.json({
      winner: winner ? { id: String(winner._id), name: winner.name, email: winner.email } : null,
      finalBid: auction.currentBid,
      product: auction.productSnapshot,
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load auction result" });
  }
});

export default router;
