import { Router } from 'express';
import LiveSession from '../models/LiveSession.js';
import LiveComment from '../models/LiveComment.js';
import SellerStorefront from '../models/SellerStorefront.js';

const router = Router();

function safeTrim(v, maxLen) {
  if (v == null) return '';
  const s = String(v).trim();
  if (!s) return '';
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

function requireBodyField(req, key, maxLen) {
  const v = safeTrim(req.body?.[key], maxLen);
  return v || null;
}

router.post('/start', async (req, res) => {
  try {
    const sellerId = requireBodyField(req, 'sellerId', 120);
    const sellerName = requireBodyField(req, 'sellerName', 80);
    const title = requireBodyField(req, 'title', 120);
    if (!sellerId || !sellerName || !title) return res.status(400).json({ error: 'sellerId, sellerName, and title are required.' });

    const existingActive = await LiveSession.findOne({ sellerId, isActive: true }).sort({ startedAt: -1 });
    if (existingActive) {
      existingActive.sellerName = sellerName;
      existingActive.title = title;
      await existingActive.save();
      return res.json({ session: existingActive.toObject() });
    }

    const channelName = `live_${sellerId}_${Date.now()}`;
    const session = await LiveSession.create({ sellerId, sellerName, channelName, title, isActive: true, viewerCount: 0, pinnedProduct: null, startedAt: new Date() });
    res.status(201).json({ session: session.toObject() });
  } catch (error) { console.error('POST /api/live/start failed:', error); res.status(500).json({ error: 'Failed to start live session.' }); }
});

router.post('/end/:channelName', async (req, res) => {
  try {
    const channelName = safeTrim(req.params.channelName, 200);
    if (!channelName) return res.status(400).json({ error: 'channelName is required.' });
    const session = await LiveSession.findOne({ channelName });
    if (!session) return res.status(404).json({ error: 'Live session not found.' });
    if (session.isActive) { session.isActive = false; session.endedAt = new Date(); await session.save(); }
    res.json({ session: session.toObject() });
  } catch (error) { console.error('POST /api/live/end/:channelName failed:', error); res.status(500).json({ error: 'Failed to end live session.' }); }
});

router.get('/active', async (req, res) => {
  try {
    const rawSessions = await LiveSession.find({ isActive: true }).sort({ startedAt: -1 }).lean();
    const seenSellerIds = new Set();
    const sessions = [];
    for (const s of rawSessions) { if (!s?.sellerId || seenSellerIds.has(s.sellerId)) continue; seenSellerIds.add(s.sellerId); sessions.push(s); }

    const sellerIds = Array.from(new Set(sessions.map((s) => s.sellerId).filter(Boolean)));
    const storefronts = sellerIds.length ? await SellerStorefront.find({ sellerId: { $in: sellerIds } }).select('sellerId logoUrl bannerUrl storeName').lean() : [];
    const bySellerId = new Map(storefronts.map((sf) => [sf.sellerId, sf]));

    const enriched = sessions.map((s) => { const sf = bySellerId.get(s.sellerId); return { ...s, storefrontThumbnail: sf?.logoUrl || sf?.bannerUrl || null, storefrontName: sf?.storeName || null }; });
    res.json({ sessions: enriched });
  } catch (error) { console.error('GET /api/live/active failed:', error); res.status(500).json({ error: 'Failed to load active live sessions.' }); }
});

router.post('/:channelName/comments', async (req, res) => {
  try {
    const channelName = safeTrim(req.params.channelName, 200);
    const username = requireBodyField(req, 'username', 60);
    const text = requireBodyField(req, 'text', 500);
    const avatar = safeTrim(req.body?.avatar, 400) || null;
    const timestampRaw = Number(req.body?.timestamp);
    const timestamp = Number.isFinite(timestampRaw) ? new Date(timestampRaw) : new Date();
    if (!channelName || !username || !text) return res.status(400).json({ error: 'channelName, username, and text are required.' });

    const comment = await LiveComment.create({ channelName, username, text, avatar, timestamp });
    res.status(201).json({ comment: { id: String(comment._id), channelName: comment.channelName, username: comment.username, text: comment.text, timestamp: Number(comment.timestamp) || Date.now(), avatar: comment.avatar || null } });
  } catch (error) { console.error('POST /api/live/:channelName/comments failed:', error); res.status(500).json({ error: 'Failed to create live comment.' }); }
});

router.get('/:channelName/comments', async (req, res) => {
  try {
    const channelName = safeTrim(req.params.channelName, 200);
    const limitRaw = Number(req.query?.limit);
    const limit = Math.min(Math.max(Number.isFinite(limitRaw) ? limitRaw : 50, 1), 200);
    if (!channelName) return res.status(400).json({ error: 'channelName is required.' });
    const comments = await LiveComment.find({ channelName }).sort({ timestamp: -1, _id: -1 }).limit(limit).lean();
    res.json({ comments: comments.reverse().map((c) => ({ id: String(c._id), channelName: c.channelName, username: c.username, text: c.text, timestamp: Number(c.timestamp) || Date.now(), avatar: c.avatar || null })) });
  } catch (error) { console.error('GET /api/live/:channelName/comments failed:', error); res.status(500).json({ error: 'Failed to load live comments.' }); }
});

router.get('/:channelName', async (req, res) => {
  try {
    const channelName = safeTrim(req.params.channelName, 200);
    if (!channelName) return res.status(400).json({ error: 'channelName is required.' });
    const session = await LiveSession.findOne({ channelName }).lean();
    if (!session) return res.status(404).json({ error: 'Live session not found.' });
    const sf = await SellerStorefront.findOne({ sellerId: session.sellerId }).select('logoUrl bannerUrl storeName slug _id').lean();
    res.json({ session: { ...session, storefrontThumbnail: sf?.logoUrl || sf?.bannerUrl || null, storefront: sf ? { _id: String(sf._id), slug: sf.slug, storeName: sf.storeName } : null } });
  } catch (error) { console.error('GET /api/live/:channelName failed:', error); res.status(500).json({ error: 'Failed to load live session.' }); }
});

export default router;
