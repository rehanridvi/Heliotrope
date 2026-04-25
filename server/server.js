import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import dns from "dns";
import helmet from "helmet";
import morgan from "morgan";
import path from "path";
import http from "http";
import { Server as SocketIOServer } from "socket.io";
import { fileURLToPath } from "url";

import connectDB from "./config/db.js";

// Route imports
import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import searchRoutes from "./routes/searchRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import reviewRoutes from "./routes/reviewRoutes.js";
import reportRoutes from "./routes/reportRoutes.js";
import closetRoutes from "./routes/closetRoutes.js";
import liveRoutes from "./routes/liveRoutes.js";
import auctionRoutes from "./routes/auctionRoutes.js";
import marketplaceRoutes from "./routes/marketplaceRoutes.js";
import socialRoutes from "./routes/socialRoutes.js";
import aiRoutes from "./routes/aiRoutes.js";

import { LiveSessionModel } from "./models/LiveSession.js";
import Auction from "./models/Auction.js";
import User from "./models/User.js";
import { setAuctionIO, startAuctionTimer, finalizeAuction } from "./utils/auctionRealtime.js";

dotenv.config();
dns.setServers(["8.8.8.8", "1.1.1.1"]);

// Connect DB
connectDB();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 5000;
const CLIENT_URL = process.env.CLIENT_URL?.trim() || "http://localhost:5173";

// ---- Security & Logging ----
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(morgan("combined"));

// ---- CORS ----
const allowedOrigins = [
  CLIENT_URL,
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175",
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const localhostDevOrigin = /^http:\/\/localhost:\d+$/.test(origin);
      if (allowedOrigins.includes(origin) || localhostDevOrigin) return callback(null, true);
      return callback(new Error(`CORS blocked: ${origin}`), false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-user-id", "x-seller-id"],
  })
);

app.options("*", cors());

// ---- Body parser ----
app.use(express.json());

// ---- Static uploads ----
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Health check
app.get("/", (req, res) => res.send("Heliotrope API running"));

// ---- API Routes ----
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/closet", closetRoutes);
app.use("/api/live", liveRoutes);
app.use("/api/auctions", auctionRoutes);
app.use("/api/marketplace", marketplaceRoutes);
app.use("/api/social", socialRoutes);
app.use("/api", aiRoutes);

// ---- Socket.io Setup ----
const httpServer = http.createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
  },
  transports: ["websocket"],
  pingInterval: 5000,
  pingTimeout: 3000,
  maxHttpBufferSize: 1e6,
});
app.set("io", io);
setAuctionIO(io);

function safeTrim(v, maxLen) {
  if (v == null) return "";
  const s = String(v).trim();
  if (!s) return "";
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

// In-memory live session tracking
const viewersByChannel = new Map();
const viewerSocketsByChannel = new Map();
const sellerSocketByChannel = new Map();
const channelBySellerSocket = new Map();

function getViewerSet(channelName) {
  if (!viewerSocketsByChannel.has(channelName)) {
    viewerSocketsByChannel.set(channelName, new Set());
  }
  return viewerSocketsByChannel.get(channelName);
}

function getViewerCount(channelName) {
  return viewersByChannel.get(channelName) || 0;
}

function setViewerCount(channelName, count) {
  const next = Math.max(0, Number(count) || 0);
  viewersByChannel.set(channelName, next);
  io.to(channelName).emit("viewer-count-update", { channelName, count: next });
}

async function endLiveSession(channelName, reason) {
  try {
    const session = await LiveSessionModel.findOne({ channelName });
    if (!session || !session.isActive) return;
    session.isActive = false;
    session.endedAt = new Date();
    await session.save();
  } catch (error) {
    console.error("[live] endLiveSession failed:", reason, error);
  }
}

io.on("connection", (socket) => {
  console.log(`[socket] client connected: ${socket.id}`);

  socket.on("seller-start-stream", async ({ channelName }) => {
    const room = safeTrim(channelName, 200);
    if (!room) return;

    socket.data.role = "seller";
    socket.data.channelName = room;

    sellerSocketByChannel.set(room, socket.id);
    channelBySellerSocket.set(socket.id, room);

    socket.join(room);
    console.log(`[live] seller started stream: ${room}`);
    io.to(room).emit("stream-started", { channelName: room });

    const waitingViewers = viewerSocketsByChannel.get(room);
    if (waitingViewers?.size) {
      for (const viewerSocketId of waitingViewers) {
        if (viewerSocketId === socket.id) continue;
        io.to(socket.id).emit("new-viewer", {
          viewerId: viewerSocketId,
          viewerSocketId,
          viewerName: "Viewer",
        });
      }
    }
  });

  socket.on("viewer-join", async ({ channelName, viewerName, viewerSocketId }) => {
    const room = safeTrim(channelName, 200);
    if (!room) return;
    socket.data.role = "viewer";
    socket.data.channelName = room;
    socket.data.viewerName = safeTrim(viewerName, 60) || "Viewer";
    socket.join(room);
    const viewers = getViewerSet(room);
    const isNewViewerInRoom = !viewers.has(socket.id);
    if (isNewViewerInRoom) viewers.add(socket.id);

    const sellerSocketId = sellerSocketByChannel.get(room);
    if (sellerSocketId && isNewViewerInRoom) {
      io.to(sellerSocketId).emit("new-viewer", {
        viewerId: safeTrim(viewerSocketId || socket.id, 120) || socket.id,
        viewerSocketId: socket.id,
        viewerName: socket.data.viewerName,
      });
    }

    if (isNewViewerInRoom) {
      setViewerCount(room, getViewerCount(room) + 1);
      await LiveSessionModel.updateOne(
        { channelName: room, isActive: true },
        { $set: { viewerCount: getViewerCount(room) } }
      ).catch(() => {});
    }
  });

  socket.on("auction:join_session", ({ liveSessionId }) => {
    const room = safeTrim(liveSessionId, 120);
    if (!room) return;
    socket.join(room);
  });

  socket.on("auction:leave_session", ({ liveSessionId }) => {
    const room = safeTrim(liveSessionId, 120);
    if (!room) return;
    socket.leave(room);
  });

  socket.on("auction:place_bid", async ({ auctionId, bidAmount, bidderId }) => {
    try {
      const normalizedAuctionId = safeTrim(auctionId, 120);
      const normalizedBidderId = safeTrim(bidderId, 120);
      const normalizedAmount = Number(bidAmount);
      if (!normalizedAuctionId || !normalizedBidderId || !Number.isFinite(normalizedAmount)) {
        socket.emit("auction:bid_error", { message: "Invalid bid payload" });
        return;
      }

      const auction = await Auction.findById(normalizedAuctionId);
      if (!auction) {
        socket.emit("auction:bid_error", { message: "Auction not found" });
        return;
      }
      if (auction.status !== "active" || Date.now() >= new Date(auction.endTime).getTime()) {
        socket.emit("auction:bid_error", { message: "Auction is no longer active" });
        await finalizeAuction(auction._id);
        return;
      }
      if (String(auction.currentWinnerId || "") === normalizedBidderId) {
        socket.emit("auction:bid_error", { message: "You are already the highest bidder" });
        return;
      }
      if (normalizedAmount <= Number(auction.currentBid)) {
        socket.emit("auction:bid_error", { message: "Bid must be higher than current bid" });
        return;
      }

      const bidder = await User.findById(normalizedBidderId).select("name");
      if (!bidder) {
        socket.emit("auction:bid_error", { message: "Bidder not found" });
        return;
      }

      const previousWinnerId = auction.currentWinnerId ? String(auction.currentWinnerId) : null;
      auction.currentBid = normalizedAmount;
      auction.currentWinnerId = bidder._id;
      auction.bids.push({
        bidderId: bidder._id,
        bidderName: bidder.name || "Bidder",
        amount: normalizedAmount,
        placedAt: new Date(),
      });
      await auction.save();

      io.to(String(auction.liveSessionId)).emit("auction:bid_placed", {
        auctionId: String(auction._id),
        currentBid: auction.currentBid,
        bidderId: String(bidder._id),
        bidderName: bidder.name || "Bidder",
        placedAt: new Date(),
      });

      if (previousWinnerId && previousWinnerId !== String(bidder._id)) {
        io.to(String(auction.liveSessionId)).emit("auction:outbid", {
          auctionId: String(auction._id),
          outbidUserId: previousWinnerId,
          newBid: auction.currentBid,
          newBidderId: String(bidder._id),
        });
      }
    } catch (error) {
      console.error("auction:place_bid failed:", error);
      socket.emit("auction:bid_error", { message: "Failed to place bid" });
    }
  });

  socket.on("viewer-request-offer", ({ channelName }) => {
    const room = safeTrim(channelName ?? socket.data.channelName, 200);
    if (!room) return;
    const sellerSocketId = sellerSocketByChannel.get(room);
    if (!sellerSocketId) return;
    const payload = {
      viewerId: socket.id,
      viewerSocketId: socket.id,
      viewerName: socket.data?.viewerName || "Viewer",
    };
    io.to(sellerSocketId).emit("new-viewer", payload);
    io.to(sellerSocketId).emit("viewer-request-offer", payload);
  });

  socket.on("seller-offer", ({ offer, targetSocketId, channelName }) => {
    const target = safeTrim(targetSocketId, 120);
    const room = safeTrim(channelName ?? socket.data.channelName, 200);
    if (!target || !room) return;
    io.to(target).emit("seller-offer", {
      offer,
      sellerSocketId: socket.id,
      channelName: room,
    });
  });

  socket.on("viewer-answer", ({ answer, sellerSocketId, channelName }) => {
    const target = safeTrim(sellerSocketId, 120);
    const room = safeTrim(channelName ?? socket.data.channelName, 200);
    if (!target || !room) return;
    io.to(target).emit("viewer-answer", {
      answer,
      viewerSocketId: socket.id,
      channelName: room,
    });
  });

  socket.on("ice-candidate", ({ targetSocketId, candidate, channelName }) => {
    const target = safeTrim(targetSocketId, 120);
    const room = safeTrim(channelName ?? socket.data.channelName, 200);
    if (!target || !room || !candidate) return;
    io.to(target).emit("ice-candidate", {
      candidate,
      fromSocketId: socket.id,
      channelName: room,
    });
  });

  socket.on("viewer-leave", async ({ channelName }) => {
    const room = safeTrim(channelName ?? socket.data.channelName, 200);
    if (!room) return;
    socket.leave(room);
    getViewerSet(room).delete(socket.id);

    const sellerSocketId = sellerSocketByChannel.get(room);
    if (sellerSocketId) {
      io.to(sellerSocketId).emit("viewer-left", {
        viewerSocketId: socket.id,
        channelName: room,
      });
    }

    setViewerCount(room, getViewerCount(room) - 1);
    await LiveSessionModel.updateOne(
      { channelName: room, isActive: true },
      { $set: { viewerCount: getViewerCount(room) } }
    ).catch(() => {});
  });

  socket.on("seller-end-stream", async ({ channelName }) => {
    const room = safeTrim(channelName ?? socket.data.channelName, 200);
    if (!room) return;

    io.to(room).emit("stream-ended", { channelName: room });
    await endLiveSession(room, "seller-end-stream");

    sellerSocketByChannel.delete(room);
    if (channelBySellerSocket.get(socket.id) === room) {
      channelBySellerSocket.delete(socket.id);
    }
    viewersByChannel.delete(room);
    viewerSocketsByChannel.delete(room);
  });

  socket.on("send-comment", ({ channelName, username, text, timestamp, avatar }) => {
    const room = safeTrim(channelName ?? socket.data.channelName, 200);
    const u = safeTrim(username, 60) || "Guest";
    const t = safeTrim(text, 500);
    if (!room || !t) return;
    io.to(room).emit("new-comment", {
      id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
      username: u,
      text: t,
      timestamp: Number(timestamp) || Date.now(),
      avatar: safeTrim(avatar, 400) || null,
    });
  });

  socket.on("send-reaction", ({ channelName, emoji, username }) => {
    const room = safeTrim(channelName ?? socket.data.channelName, 200);
    const e = safeTrim(emoji, 8);
    if (!room || !e) return;
    io.to(room).emit("new-reaction", {
      id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
      emoji: e,
      username: safeTrim(username, 60) || "Guest",
      ts: Date.now(),
    });
  });

  socket.on("pin-product", async ({ channelName, productId, name, price, image, link }) => {
    const room = safeTrim(channelName ?? socket.data.channelName, 200);
    if (!room) return;
    const payload = {
      productId: safeTrim(productId, 120),
      name: safeTrim(name, 120),
      price: Number(price) || 0,
      image: safeTrim(image, 400) || null,
      link: safeTrim(link, 400) || null,
    };
    if (!payload.productId || !payload.name) return;
    io.to(room).emit("product-pinned", payload);
    await LiveSessionModel.updateOne(
      { channelName: room, isActive: true },
      { $set: { pinnedProduct: payload } }
    ).catch(() => {});
  });

  socket.on("unpin-product", async ({ channelName }) => {
    const room = safeTrim(channelName ?? socket.data.channelName, 200);
    if (!room) return;
    io.to(room).emit("product-unpinned", { channelName: room });
    await LiveSessionModel.updateOne(
      { channelName: room, isActive: true },
      { $set: { pinnedProduct: null } }
    ).catch(() => {});
  });

  socket.on("disconnect", async () => {
    const role = socket.data.role;
    const channelName = safeTrim(socket.data.channelName, 200);

    console.log(`[socket] client disconnected: ${socket.id} (role: ${role}, channel: ${channelName})`);

    if (role === "viewer" && channelName) {
      getViewerSet(channelName).delete(socket.id);
      const sellerSocketId = sellerSocketByChannel.get(channelName);
      if (sellerSocketId) {
        io.to(sellerSocketId).emit("viewer-left", {
          viewerSocketId: socket.id,
          channelName,
        });
      }
      setViewerCount(channelName, getViewerCount(channelName) - 1);
      await LiveSessionModel.updateOne(
        { channelName, isActive: true },
        { $set: { viewerCount: getViewerCount(channelName) } }
      ).catch(() => {});
      return;
    }

    if (role === "seller") {
      const room = channelName || channelBySellerSocket.get(socket.id);
      if (!room) return;

      console.log(`[live] seller disconnected from stream: ${room}`);
      io.to(room).emit("stream-ended", { channelName: room });
      await endLiveSession(room, "seller-disconnect");

      sellerSocketByChannel.delete(room);
      channelBySellerSocket.delete(socket.id);
      viewersByChannel.delete(room);
      viewerSocketsByChannel.delete(room);
    }
  });
});

// Start server
httpServer.listen(PORT, () => {
  console.log(`Heliotrope server running on port ${PORT}`);
});

Auction.find({ status: "active" })
  .then((auctions) => {
    auctions.forEach((auction) => startAuctionTimer(auction));
    if (auctions.length > 0) {
      console.log(`[auction] restored ${auctions.length} active auction timers`);
    }
  })
  .catch((err) => {
    console.error("[auction] failed to restore active timers:", err?.message || err);
  });

httpServer.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`Port ${PORT} is already in use.`);
  } else {
    console.error(err);
  }
  process.exit(1);
});

