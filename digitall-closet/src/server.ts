import "dotenv/config";
import cors from "cors";
import express from "express";
import mongoose from "mongoose";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { ClosetItemModel, CLOSET_ITEM_TYPES } from "./models/ClosetItem.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadRoot = path.join(__dirname, "..", "uploads");

if (!fs.existsSync(uploadRoot)) {
  fs.mkdirSync(uploadRoot, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadRoot),
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, `${Date.now()}_${safe}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
});

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use("/uploads", express.static(uploadRoot));

const PORT = Number(process.env.PORT) || 3004;

function requireUserId(req: express.Request): string | null {
  const q = req.query.userId as string | undefined;
  const h = req.headers["x-user-id"] as string | undefined;
  return q?.trim() || h?.trim() || null;
}

app.get("/api/closet/items", async (req, res) => {
  const userId = requireUserId(req);
  if (!userId) {
    res.status(400).json({ error: "Provide userId query or x-user-id header." });
    return;
  }
  const type = req.query.type as string | undefined;
  const filter: Record<string, unknown> = { userId };
  if (type && CLOSET_ITEM_TYPES.includes(type as (typeof CLOSET_ITEM_TYPES)[number])) {
    filter.type = type;
  }
  const items = await ClosetItemModel.find(filter).sort({ updatedAt: -1 }).lean();
  res.json({ items });
});

app.post("/api/closet/items", upload.single("image"), async (req, res) => {
  const userId = requireUserId(req);
  if (!userId) {
    res.status(400).json({ error: "Provide userId query or x-user-id header." });
    return;
  }
  const name = (req.body.name as string)?.trim();
  const itemType = req.body.type as string;
  if (!name || !itemType) {
    res.status(400).json({ error: "name and type are required." });
    return;
  }
  if (!CLOSET_ITEM_TYPES.includes(itemType as (typeof CLOSET_ITEM_TYPES)[number])) {
    res.status(400).json({ error: `type must be one of: ${CLOSET_ITEM_TYPES.join(", ")}` });
    return;
  }

  const colors = parseStringArray(req.body.colors);
  const occasions = parseStringArray(req.body.occasions);
  const brand = (req.body.brand as string | undefined)?.trim();

  let imageUrl: string | undefined;
  if (req.file) {
    imageUrl = `/uploads/${req.file.filename}`;
  } else if (req.body.imageUrl) {
    imageUrl = String(req.body.imageUrl).trim();
  }

  const doc = await ClosetItemModel.create({
    userId,
    name,
    type: itemType,
    colors,
    occasions,
    brand: brand || undefined,
    imageUrl,
    notes: (req.body.notes as string | undefined)?.trim(),
  });

  res.status(201).json({ item: doc.toObject() });
});

app.patch("/api/closet/items/:id", upload.single("image"), async (req, res) => {
  const userId = requireUserId(req);
  if (!userId) {
    res.status(400).json({ error: "Provide userId query or x-user-id header." });
    return;
  }
  const item = await ClosetItemModel.findOne({ _id: req.params.id, userId });
  if (!item) {
    res.status(404).json({ error: "Not found." });
    return;
  }

  if (req.body.name != null) item.name = String(req.body.name).trim();
  if (req.body.type != null) {
    const t = String(req.body.type);
    if (!CLOSET_ITEM_TYPES.includes(t as (typeof CLOSET_ITEM_TYPES)[number])) {
      res.status(400).json({ error: "Invalid type." });
      return;
    }
    item.type = t as (typeof CLOSET_ITEM_TYPES)[number];
  }
  if (req.body.colors != null) item.colors = parseStringArray(req.body.colors);
  if (req.body.occasions != null) item.occasions = parseStringArray(req.body.occasions);
  if (req.body.brand != null) item.brand = String(req.body.brand).trim() || undefined;
  if (req.body.notes != null) item.notes = String(req.body.notes).trim() || undefined;

  if (req.file) {
    item.imageUrl = `/uploads/${req.file.filename}`;
  } else if (req.body.imageUrl != null) {
    const u = String(req.body.imageUrl).trim();
    item.imageUrl = u || undefined;
  }

  await item.save();
  res.json({ item: item.toObject() });
});

app.delete("/api/closet/items/:id", async (req, res) => {
  const userId = requireUserId(req);
  if (!userId) {
    res.status(400).json({ error: "Provide userId query or x-user-id header." });
    return;
  }
  const result = await ClosetItemModel.deleteOne({ _id: req.params.id, userId });
  if (result.deletedCount === 0) {
    res.status(404).json({ error: "Not found." });
    return;
  }
  res.status(204).send();
});

app.get("/health", (_req, res) => {
  res.json({ ok: true, feature: "digital-closet", mongo: mongoose.connection.readyState });
});

function parseStringArray(raw: unknown): string[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) return raw.map((x) => String(x).trim()).filter(Boolean);
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.map((x) => String(x).trim()).filter(Boolean);
      }
    } catch {
      /* fallthrough */
    }
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("Set MONGODB_URI for digital-closet.");
    process.exit(1);
  }
  await mongoose.connect(uri);
  app.listen(PORT, () => {
    console.log(`[digital-closet] http://localhost:${PORT}`);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
