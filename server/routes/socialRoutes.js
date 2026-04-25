import { Router } from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { authorizeRoles } from '../middleware/roleMiddleware.js';
import User from '../models/User.js';

const router = Router();

// Demo connect endpoint
router.post('/demo/connect', protect, async (req, res) => {
  if (req.user.role !== 'seller') return res.status(403).json({ error: 'Seller only' });
  const platform = String(req.body?.platform || '').toLowerCase();
  if (!['facebook', 'instagram', 'both'].includes(platform)) return res.status(400).json({ error: 'platform must be facebook, instagram, or both' });

  const setFields = {};
  if (platform === 'facebook' || platform === 'both') { setFields['sellerSocial.fbPageId'] = 'demo_fb_page'; setFields['sellerSocial.fbAccessToken'] = 'demo_fb_token'; }
  if (platform === 'instagram' || platform === 'both') { setFields['sellerSocial.igUserId'] = 'demo_ig_user'; setFields['sellerSocial.igAccessToken'] = 'demo_ig_token'; }

  await User.updateOne({ _id: req.user._id }, { $set: setFields });
  res.json({ success: true, connected: { facebook: platform === 'facebook' || platform === 'both', instagram: platform === 'instagram' || platform === 'both' } });
});

router.post('/disconnect', protect, async (req, res) => {
  if (req.user.role !== 'seller') return res.status(403).json({ error: 'Seller only' });
  const platform = String(req.body?.platform || '').toLowerCase();
  if (!['facebook', 'instagram', 'both'].includes(platform)) return res.status(400).json({ error: 'platform must be facebook, instagram, or both' });

  const unsetFields = {};
  if (platform === 'facebook' || platform === 'both') { unsetFields['sellerSocial.fbPageId'] = ''; unsetFields['sellerSocial.fbAccessToken'] = ''; }
  if (platform === 'instagram' || platform === 'both') { unsetFields['sellerSocial.igUserId'] = ''; unsetFields['sellerSocial.igAccessToken'] = ''; }

  await User.updateOne({ _id: req.user._id }, { $unset: unsetFields });
  res.json({ success: true, disconnected: { facebook: platform === 'facebook' || platform === 'both', instagram: platform === 'instagram' || platform === 'both' } });
});

router.get('/connections/options', protect, async (req, res) => {
  if (req.user.role !== 'seller') return res.status(403).json({ error: 'Only sellers can access social features.' });
  const user = await User.findById(req.user._id).select('+sellerSocial');
  if (!user) return res.status(404).json({ error: 'Seller account not found.' });

  const facebookConnected = Boolean(user?.sellerSocial?.fbPageId);
  const instagramConnected = Boolean(user?.sellerSocial?.igUserId);

  res.json({
    role: 'seller',
    canConnectSocial: true,
    options: [
      { platform: 'facebook', action: 'Facebook Feed', oauthUrl: null, status: facebookConnected ? 'connected' : 'ready', note: 'Using demo feed. No Facebook app setup required.' },
      { platform: 'instagram', action: 'Instagram Feed', oauthUrl: null, status: instagramConnected ? 'connected' : 'ready', note: 'Set AYRSHARE_API_KEY in .env or configure Meta OAuth.' },
    ],
    config: { facebookAppConfigured: false, facebookRedirectConfigured: false },
  });
});

export default router;
