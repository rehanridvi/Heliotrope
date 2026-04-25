import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import mongoose from 'mongoose';
import { fileURLToPath } from 'url';
import { SellerStorefrontModel } from '../models/SellerStorefront.js';
import { StorefrontProductModel } from '../models/StorefrontProduct.js';
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
const uploadStorefrontAssets = upload.fields([{ name: 'logo', maxCount: 1 }, { name: 'banner', maxCount: 1 }]);

function parseStringArray(raw) {
  if (raw == null) return [];
  if (Array.isArray(raw)) return raw.map((x) => String(x).trim()).filter(Boolean);
  if (typeof raw === 'string') {
    try { const p = JSON.parse(raw); if (Array.isArray(p)) return p.map((x) => String(x).trim()).filter(Boolean); } catch {}
    return raw.split(',').map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

function slugify(name) {
  const s = String(name || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return s || 'store';
}

async function uniqueSlugFromName(storeName, excludeStorefrontId) {
  const base = slugify(storeName);
  let slug = base, n = 0;
  for (;;) {
    const q = { slug };
    if (excludeStorefrontId) q._id = { $ne: excludeStorefrontId };
    const taken = await SellerStorefrontModel.exists(q);
    if (!taken) return slug;
    n += 1; slug = `${base}-${n}`;
  }
}

async function loadStorefrontBySlugOrId(param) {
  if (mongoose.Types.ObjectId.isValid(param)) {
    const byId = await SellerStorefrontModel.findById(param).lean();
    if (byId) return byId;
  }
  return SellerStorefrontModel.findOne({ slug: param }).lean();
}

function getSellerId(req) {
  return req.user?._id?.toString() || req.query.sellerId || req.headers['x-seller-id'] || req.body?.sellerId || null;
}

router.get('/storefronts', async (req, res) => {
  try {
    const q = String(req.query.q || '').trim().toLowerCase();
    const filter = {};
    if (q) {
      filter.$or = [
        { storeName: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
        { description: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
        { categoryTags: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
      ];
    }
    const storefronts = await SellerStorefrontModel.find(filter).sort({ updatedAt: -1 }).select('storeName slug logoUrl bannerUrl description categoryTags updatedAt createdAt').lean();
    res.json({ storefronts });
  } catch (error) {
    console.error('GET /storefronts failed:', error);
    res.status(500).json({ error: 'Failed to load storefronts.' });
  }
});

router.get('/my-storefront', protect, async (req, res) => {
  try {
    const sellerId = getSellerId(req);
    if (!sellerId) { res.status(400).json({ error: 'Seller authentication required.' }); return; }
    const storefront = await SellerStorefrontModel.findOne({ sellerId }).lean();
    if (!storefront) { res.json({ storefront: null, products: [] }); return; }
    const products = await StorefrontProductModel.find({ storefrontId: storefront._id }).sort({ updatedAt: -1 }).lean();
    res.json({ storefront, products });
  } catch (error) {
    console.error('GET /my-storefront failed:', error);
    res.status(500).json({ error: 'Failed to load your storefront.' });
  }
});

router.get('/storefronts/:slugOrId', async (req, res) => {
  try {
    const storefront = await loadStorefrontBySlugOrId(req.params.slugOrId);
    if (!storefront) { res.status(404).json({ error: 'Storefront not found.' }); return; }
    const products = await StorefrontProductModel.find({ storefrontId: storefront._id }).sort({ updatedAt: -1 }).lean();
    res.json({ storefront, products });
  } catch (error) {
    console.error('GET /storefronts/:slugOrId failed:', error);
    res.status(500).json({ error: 'Failed to load storefront.' });
  }
});

router.post('/storefronts', protect, uploadStorefrontAssets, async (req, res) => {
  try {
    const sellerId = getSellerId(req);
    if (!sellerId) { res.status(400).json({ error: 'Seller authentication required.' }); return; }
    const existing = await SellerStorefrontModel.findOne({ sellerId });
    if (existing) { res.status(409).json({ error: 'You already have a storefront. Use PATCH to update it.', storefrontId: String(existing._id) }); return; }
    const storeName = req.body.storeName?.trim();
    if (!storeName) { res.status(400).json({ error: 'storeName is required.' }); return; }
    const description = String(req.body.description ?? '').trim();
    const categoryTags = parseStringArray(req.body.categoryTags);
    const slug = await uniqueSlugFromName(storeName);
    let logoUrl, bannerUrl;
    const files = req.files;
    if (files?.logo?.[0]) logoUrl = `/uploads/${files.logo[0].filename}`;
    if (files?.banner?.[0]) bannerUrl = `/uploads/${files.banner[0].filename}`;
    const doc = await SellerStorefrontModel.create({ sellerId, storeName, slug, description, categoryTags, logoUrl, bannerUrl });
    res.status(201).json({ storefront: doc.toObject() });
  } catch (error) {
    console.error('POST /storefronts failed:', error);
    res.status(500).json({ error: 'Failed to create storefront.' });
  }
});

router.patch('/storefronts/:id', protect, uploadStorefrontAssets, async (req, res) => {
  try {
    const sellerId = getSellerId(req);
    if (!sellerId) { res.status(400).json({ error: 'Seller authentication required.' }); return; }
    const storefront = await SellerStorefrontModel.findOne({ _id: req.params.id, sellerId });
    if (!storefront) { res.status(404).json({ error: 'Storefront not found.' }); return; }
    if (req.body.storeName != null) {
      const name = String(req.body.storeName).trim();
      if (name && name !== storefront.storeName) { storefront.storeName = name; storefront.slug = await uniqueSlugFromName(name, storefront._id); }
    }
    if (req.body.description != null) storefront.description = String(req.body.description).trim();
    if (req.body.categoryTags != null) storefront.categoryTags = parseStringArray(req.body.categoryTags);
    const files = req.files;
    if (files?.logo?.[0]) storefront.logoUrl = `/uploads/${files.logo[0].filename}`;
    if (files?.banner?.[0]) storefront.bannerUrl = `/uploads/${files.banner[0].filename}`;
    await storefront.save();
    res.json({ storefront: storefront.toObject() });
  } catch (error) {
    console.error('PATCH /storefronts/:id failed:', error);
    res.status(500).json({ error: 'Failed to update storefront.' });
  }
});

router.delete('/storefronts/:id', protect, async (req, res) => {
  try {
    const sellerId = getSellerId(req);
    if (!sellerId) { res.status(400).json({ error: 'Seller authentication required.' }); return; }
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) { res.status(400).json({ error: 'Invalid storefront id.' }); return; }
    const storefront = await SellerStorefrontModel.findOne({ _id: req.params.id, sellerId });
    if (!storefront) { res.status(404).json({ error: 'Storefront not found.' }); return; }
    await StorefrontProductModel.deleteMany({ storefrontId: storefront._id });
    await storefront.deleteOne();
    res.status(204).send();
  } catch (error) {
    console.error('DELETE /storefronts/:id failed:', error);
    res.status(500).json({ error: 'Failed to delete storefront.' });
  }
});

router.get('/storefronts/:slugOrId/products', async (req, res) => {
  try {
    const storefront = await loadStorefrontBySlugOrId(req.params.slugOrId);
    if (!storefront) { res.status(404).json({ error: 'Storefront not found.' }); return; }
    const products = await StorefrontProductModel.find({ storefrontId: storefront._id }).sort({ updatedAt: -1 }).lean();
    res.json({ storefront, products });
  } catch (error) {
    console.error('GET /storefronts/:slugOrId/products failed:', error);
    res.status(500).json({ error: 'Failed to load storefront products.' });
  }
});

router.get('/products/:productId', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.productId)) { res.status(400).json({ error: 'Invalid product id.' }); return; }
    const product = await StorefrontProductModel.findById(req.params.productId).lean();
    if (!product) { res.status(404).json({ error: 'Product not found.' }); return; }
    res.json({ product });
  } catch (error) {
    console.error('GET /products/:productId failed:', error);
    res.status(500).json({ error: 'Failed to load product.' });
  }
});

router.post('/storefronts/:storefrontId/products', protect, upload.single('image'), async (req, res) => {
  try {
    const sellerId = getSellerId(req);
    if (!sellerId) { res.status(400).json({ error: 'Seller authentication required.' }); return; }
    if (!mongoose.Types.ObjectId.isValid(req.params.storefrontId)) { res.status(400).json({ error: 'Invalid storefront id.' }); return; }
    const storefront = await SellerStorefrontModel.findOne({ _id: req.params.storefrontId, sellerId });
    if (!storefront) { res.status(404).json({ error: 'Storefront not found.' }); return; }
    const name = req.body.name?.trim();
    const priceRaw = req.body.price;
    const price = typeof priceRaw === 'number' ? priceRaw : parseFloat(String(priceRaw));
    if (!name || Number.isNaN(price) || price < 0) { res.status(400).json({ error: 'name and a valid non-negative price are required.' }); return; }
    let imageUrl;
    if (req.file) imageUrl = `/uploads/${req.file.filename}`;
    else if (req.body.imageUrl) imageUrl = String(req.body.imageUrl).trim();
    const doc = await StorefrontProductModel.create({ sellerId, storefrontId: storefront._id, name, description: String(req.body.description ?? '').trim(), price, imageUrl });
    res.status(201).json({ product: doc.toObject() });
  } catch (error) {
    console.error('POST .../products failed:', error);
    res.status(500).json({ error: 'Failed to create product.' });
  }
});

router.patch('/products/:productId', protect, upload.single('image'), async (req, res) => {
  try {
    const sellerId = getSellerId(req);
    if (!sellerId) { res.status(400).json({ error: 'Seller authentication required.' }); return; }
    const product = await StorefrontProductModel.findOne({ _id: req.params.productId, sellerId });
    if (!product) { res.status(404).json({ error: 'Product not found.' }); return; }
    if (req.body.name != null) product.name = String(req.body.name).trim();
    if (req.body.description != null) product.description = String(req.body.description).trim();
    if (req.body.price != null) {
      const p = parseFloat(String(req.body.price));
      if (Number.isNaN(p) || p < 0) { res.status(400).json({ error: 'Invalid price.' }); return; }
      product.price = p;
    }
    if (req.file) product.imageUrl = `/uploads/${req.file.filename}`;
    else if (req.body.imageUrl != null) { const u = String(req.body.imageUrl).trim(); product.imageUrl = u || undefined; }
    await product.save();
    res.json({ product: product.toObject() });
  } catch (error) {
    console.error('PATCH /products/:productId failed:', error);
    res.status(500).json({ error: 'Failed to update product.' });
  }
});

router.delete('/products/:productId', protect, async (req, res) => {
  try {
    const sellerId = getSellerId(req);
    if (!sellerId) { res.status(400).json({ error: 'Seller authentication required.' }); return; }
    const result = await StorefrontProductModel.deleteOne({ _id: req.params.productId, sellerId });
    if (result.deletedCount === 0) { res.status(404).json({ error: 'Product not found.' }); return; }
    res.status(204).send();
  } catch (error) {
    console.error('DELETE /products/:productId failed:', error);
    res.status(500).json({ error: 'Failed to delete product.' });
  }
});

export default router;

