import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import dns from "dns";
import http from "http";
import { Server as SocketIOServer } from "socket.io";
import closetRoutes from "./routes/closetRoutes.js";
import marketplaceRoutes from "./routes/marketplaceRoutes.js";
import liveRoutes from "./routes/live.js";
import path from "path";
import { fileURLToPath } from "url";
import { LiveSessionModel } from "./models/LiveSession.js";

dotenv.config();
dns.setServers(["8.8.8.8", "1.1.1.1"]);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** Default local DB when `MONGODB_URI` is unset — server still needs a running MongoDB instance. */
const DEFAULT_MONGODB_URI = "mongodb://127.0.0.1:27017/heliotrope";
const mongoUri =
  process.env.MONGODB_URI?.trim() ||
  process.env.MONGO_URI?.trim() ||
  DEFAULT_MONGODB_URI;
if (!process.env.MONGODB_URI?.trim() && !process.env.MONGO_URI?.trim()) {
  console.warn(
    `[startup] MONGODB_URI is not set; using ${DEFAULT_MONGODB_URI}. Create a .env file with MONGODB_URI=... for MongoDB Atlas or another host.`
  );
}

const app = express();
const PORT = Number(process.env.PORT) || 1224;
const CLIENT_URL = process.env.CLIENT_URL?.trim() || "http://localhost:5173";

app.use(
  cors({
    origin: CLIENT_URL,
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization", "x-user-id", "x-seller-id"],
  })
);
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/api/closet", closetRoutes);
app.use("/api/marketplace", marketplaceRoutes);
app.use("/api/live", liveRoutes);

const httpServer = http.createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: CLIENT_URL,
    credentials: true,
  },
  transports: ['websocket'],
  pingInterval: 5000,
  pingTimeout: 3000,
  maxHttpBufferSize: 1e6,
});

function safeTrim(v, maxLen) {
  if (v == null) return "";
  const s = String(v).trim();
  if (!s) return "";
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

// Viewer count (in-memory). Key: channelName, Value: count
const viewersByChannel = new Map();
// Track viewer sockets in each channel. Key: channelName, Value: Set<socketId>
const viewerSocketsByChannel = new Map();
// Track the seller socket for each channel. Key: channelName, Value: socketId
const sellerSocketByChannel = new Map();
// Reverse lookup: seller socketId -> channelName
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
    if (!session) return;
    if (!session.isActive) return;
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

    // If viewers joined before seller signaling was ready, backfill their offer requests now.
    const waitingViewers = viewerSocketsByChannel.get(room);
    if (waitingViewers?.size) {
      console.log(`[live] notifying seller of ${waitingViewers.size} waiting viewers in ${room}`);
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
    if (isNewViewerInRoom) {
      viewers.add(socket.id);
    }

    const sellerSocketId = sellerSocketByChannel.get(room);
    if (sellerSocketId && isNewViewerInRoom) {
      console.log(`[live] notifying seller of new viewer in ${room}`);
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
    console.log(`[webrtc] relaying seller offer in ${room} to viewer ${target.slice(0, 8)}`);
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
    console.log(`[webrtc] relaying viewer answer in ${room} to seller ${target.slice(0, 8)}`);
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

mongoose
  .connect(mongoUri, { serverSelectionTimeoutMS: 8000 })
  .then(() => {
    console.log("MongoDB connected");
    app.get("/", (req, res) => {
      res.send("API working");
    });
    const server = httpServer.listen(PORT, () =>
      console.log(`Server running on port ${PORT}`)
    );
    server.on("error", (err) => {
      if (err.code === "EADDRINUSE") {
        console.error(
          `Port ${PORT} is already in use. Close the other server, or use another port (PowerShell: $env:PORT=5001; npm start).`
        );
      } else {
        console.error(err);
      }
      process.exit(1);
    });
  })
  .catch((err) => {
    console.error("MongoDB connection failed:", err.message);
    console.error(
      "Fix: install/start MongoDB locally, or set MONGODB_URI in HelioTrope/.env to your Atlas connection string."
    );
    process.exit(1);
  });
