import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import dns from "dns";
import http from "http";
import { Server as SocketIOServer } from "socket.io";
import closetRoutes from "./routes/closetRoutes.js";
import marketplaceRoutes from "./routes/marketplaceRoutes.js";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();
dns.setServers(["8.8.8.8", "1.1.1.1"]);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** Default local DB when `MONGO_URI` is unset — server still needs a running MongoDB instance. */
const DEFAULT_MONGO_URI = "mongodb://127.0.0.1:27017/heliotrope";
const mongoUri = process.env.MONGO_URI?.trim() || DEFAULT_MONGO_URI;
if (!process.env.MONGO_URI?.trim()) {
  console.warn(
    `[startup] MONGO_URI is not set; using ${DEFAULT_MONGO_URI}. Create a .env file with MONGO_URI=... for MongoDB Atlas or another host.`
  );
}

const app = express();
const PORT = Number(process.env.PORT) || 5000;

app.use(
  cors({
    origin: true,
    allowedHeaders: ["Content-Type", "Authorization", "x-user-id", "x-seller-id"],
  })
);
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/api/closet", closetRoutes);
app.use("/api/marketplace", marketplaceRoutes);

const httpServer = http.createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: true,
    credentials: true,
  },
});

function safeTrim(v, maxLen) {
  if (v == null) return "";
  const s = String(v).trim();
  if (!s) return "";
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

io.on("connection", (socket) => {
  socket.on("stream:join", ({ streamId, name }) => {
    const room = safeTrim(streamId, 120);
    if (!room) return;
    socket.data.streamId = room;
    socket.data.name = safeTrim(name, 40) || "Guest";
    socket.join(room);
    socket.emit("stream:joined", { streamId: room });
  });

  socket.on("stream:comment", ({ streamId, text }) => {
    const room = safeTrim(streamId ?? socket.data.streamId, 120);
    const message = safeTrim(text, 400);
    if (!room || !message) return;
    const payload = {
      id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
      streamId: room,
      name: socket.data.name || "Guest",
      text: message,
      ts: Date.now(),
    };
    io.to(room).emit("stream:comment", payload);
  });

  socket.on("stream:reaction", ({ streamId, reaction }) => {
    const room = safeTrim(streamId ?? socket.data.streamId, 120);
    const r = safeTrim(reaction, 16);
    if (!room || !r) return;
    const payload = {
      id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
      streamId: room,
      name: socket.data.name || "Guest",
      reaction: r,
      ts: Date.now(),
    };
    io.to(room).emit("stream:reaction", payload);
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
      "Fix: install/start MongoDB locally, or set MONGO_URI in HelioTrope/.env to your Atlas connection string."
    );
    process.exit(1);
  });
