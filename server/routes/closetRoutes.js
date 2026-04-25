import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { ClosetItemModel, CLOSET_ITEM_TYPES } from '../models/ClosetItem.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadRoot = path.join(__dirname, '..', 'uploads');

if (!fs.existsSync(uploadRoot)) {
  fs.mkdirSync(uploadRoot, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadRoot),
  filename: (req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}_${safe}`);
  },
});

const upload = multer({ storage, limits: { fileSize: 8 * 1024 * 1024 } });

function parseStringArray(raw) {
  if (raw == null) return [];
  if (Array.isArray(raw)) return raw.map((x) => String(x).trim()).filter(Boolean);
  if (typeof raw === 'string') {
    try { const p = JSON.parse(raw); if (Array.isArray(p)) return p.map((x) => String(x).trim()).filter(Boolean); } catch {}
    return raw.split(',').map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

function normalizeValue(value) {
  return String(value || '').trim().toLowerCase();
}
function normalizeOptionalValue(value) {
  const n = normalizeValue(value);
  return n || null;
}
function isSameClosetItem(existing, candidate) {
  const sameSourceId = normalizeOptionalValue(existing.sourcePostId) && normalizeOptionalValue(candidate.sourcePostId)
    ? normalizeOptionalValue(existing.sourcePostId) === normalizeOptionalValue(candidate.sourcePostId) : false;
  const samePermalink = normalizeOptionalValue(existing.sourcePermalink) && normalizeOptionalValue(candidate.sourcePermalink)
    ? normalizeOptionalValue(existing.sourcePermalink) === normalizeOptionalValue(candidate.sourcePermalink) : false;
  const sameIdentity = normalizeValue(existing.name) === normalizeValue(candidate.name) &&
    normalizeValue(existing.type) === normalizeValue(candidate.type) &&
    normalizeOptionalValue(existing.brand) === normalizeOptionalValue(candidate.brand) &&
    normalizeOptionalValue(existing.imageUrl) === normalizeOptionalValue(candidate.imageUrl) &&
    normalizeOptionalValue(existing.platform) === normalizeOptionalValue(candidate.platform);
  return sameSourceId || samePermalink || sameIdentity;
}

router.get('/items', protect, async (req, res) => {
  try {
    const userId = req.user._id.toString();
    const type = req.query.type;
    const filter = { userId };
    if (type && CLOSET_ITEM_TYPES.includes(type)) filter.type = type;
    const items = await ClosetItemModel.find(filter).sort({ updatedAt: -1 }).lean();
    res.json({ items });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load closet items.' });
  }
});

router.get('/items/:id', protect, async (req, res) => {
  try {
    const userId = req.user._id.toString();
    const item = await ClosetItemModel.findOne({ _id: req.params.id, userId }).lean();
    if (!item) { res.status(404).json({ error: 'Not found.' }); return; }
    res.json({ item });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load closet item.' });
  }
});

router.post('/items', protect, upload.single('image'), async (req, res) => {
  try {
    const userId = req.user._id.toString();
    const name = req.body.name?.trim();
    const itemType = req.body.type;
    if (!name || !itemType) { res.status(400).json({ error: 'name and type are required.' }); return; }
    if (!CLOSET_ITEM_TYPES.includes(itemType)) {
      res.status(400).json({ error: `type must be one of: ${CLOSET_ITEM_TYPES.join(', ')}` });
      return;
    }
    const colors = parseStringArray(req.body.colors);
    const occasions = parseStringArray(req.body.occasions);
    const brand = req.body.brand?.trim();
    let imageUrl;
    if (req.file) imageUrl = `/uploads/${req.file.filename}`;
    else if (req.body.imageUrl) imageUrl = String(req.body.imageUrl).trim();

    const candidate = { name, type: itemType, brand, imageUrl, platform: req.body.platform, sourcePostId: req.body.sourcePostId, sourcePermalink: req.body.sourcePermalink };
    const existingItems = await ClosetItemModel.find({ userId }).select('name type brand imageUrl platform sourcePostId sourcePermalink').lean();
    const duplicateItem = existingItems.find((item) => isSameClosetItem(item, candidate));
    if (duplicateItem) { res.status(409).json({ error: 'That item is already in your closet.', item: duplicateItem }); return; }

    const doc = await ClosetItemModel.create({ userId, name, type: itemType, colors, occasions, brand: brand || undefined, imageUrl, notes: req.body.notes?.trim(), sourcePostId: req.body.sourcePostId, platform: req.body.platform, sourcePermalink: req.body.sourcePermalink });
    res.status(201).json({ item: doc.toObject() });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create closet item.' });
  }
});

router.patch('/items/:id', protect, upload.single('image'), async (req, res) => {
  try {
    const userId = req.user._id.toString();
    const item = await ClosetItemModel.findOne({ _id: req.params.id, userId });
    if (!item) { res.status(404).json({ error: 'Not found.' }); return; }
    if (req.body.name != null) item.name = String(req.body.name).trim();
    if (req.body.type != null) {
      const t = String(req.body.type);
      if (!CLOSET_ITEM_TYPES.includes(t)) { res.status(400).json({ error: 'Invalid type.' }); return; }
      item.type = t;
    }
    if (req.body.colors != null) item.colors = parseStringArray(req.body.colors);
    if (req.body.occasions != null) item.occasions = parseStringArray(req.body.occasions);
    if (req.body.brand != null) item.brand = String(req.body.brand).trim() || undefined;
    if (req.body.notes != null) item.notes = String(req.body.notes).trim() || undefined;
    if (req.file) item.imageUrl = `/uploads/${req.file.filename}`;
    else if (req.body.imageUrl != null) item.imageUrl = String(req.body.imageUrl).trim() || undefined;
    await item.save();
    res.json({ item: item.toObject() });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update closet item.' });
  }
});

router.delete('/items/:id', protect, async (req, res) => {
  try {
    const userId = req.user._id.toString();
    const result = await ClosetItemModel.deleteOne({ _id: req.params.id, userId });
    if (result.deletedCount === 0) { res.status(404).json({ error: 'Not found.' }); return; }
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete closet item.' });
  }
});

export default router;

