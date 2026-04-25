import express from 'express';
import { ClosetItemModel } from '../models/ClosetItem.js';
import { protect } from '../middleware/authMiddleware.js';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';

const router = express.Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadRoot = path.join(__dirname, '..', 'uploads');
const MAX_VISION_ITEMS = Number(process.env.AI_VISION_ITEMS || 4);
const MAX_IMAGE_BYTES = Number(process.env.AI_VISION_MAX_IMAGE_BYTES || 2_000_000);
const VALID_OUTFIT_OCCASIONS = new Set(['casual', 'work', 'formal', 'party', 'wedding', 'eid', 'sports', 'travel']);

function inferClothesCategory(item) {
  const text = `${item.name || ''} ${item.notes || ''}`.toLowerCase();
  if (/(dress|abaya|gown|frock|jumpsuit)/.test(text)) return 'dress';
  if (/(jacket|blazer|coat|hoodie|sweater|cardigan|shrug|outerwear)/.test(text)) return 'outerwear';
  if (/(pant|trouser|jeans|skirt|shorts|legging|palazzo|bottom)/.test(text)) return 'bottom';
  return 'top';
}
function toOutfitCategory(item) {
  if (item.type === 'accessories') return 'accessories';
  if (item.type === 'bags') return 'bag';
  if (item.type === 'glasses') return 'glasses';
  if (item.type === 'shoes') return 'shoes';
  if (item.type === 'makeup') return 'makeup';
  if (item.type === 'clothes') return inferClothesCategory(item);
  return null;
}
function toOutfitClosetItems(closetItems) {
  return closetItems.map((item) => {
    const category = toOutfitCategory(item);
    if (!category) return null;
    return { id: String(item._id), name: item.name, category, color: item.colors?.[0] || 'neutral', occasions: Array.isArray(item.occasions) ? item.occasions.filter((o) => VALID_OUTFIT_OCCASIONS.has(String(o))) : [], brand: item.brand || undefined };
  }).filter(Boolean);
}
function mimeFromFileName(fileName) {
  const ext = path.extname(fileName).toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.gif') return 'image/gif';
  return 'application/octet-stream';
}
async function buildClosetVisionImages(items) {
  const candidates = items.filter((item) => typeof item.imageUrl === 'string' && item.imageUrl.startsWith('/uploads/')).slice(0, Math.max(0, MAX_VISION_ITEMS));
  const results = [];
  for (const item of candidates) {
    try {
      const fileName = item.imageUrl.replace('/uploads/', '');
      const filePath = path.join(uploadRoot, fileName);
      const file = await fs.readFile(filePath);
      if (file.length > MAX_IMAGE_BYTES) continue;
      results.push({ itemId: String(item._id), name: item.name, mimeType: mimeFromFileName(fileName), dataBase64: file.toString('base64') });
    } catch {}
  }
  return results;
}
function buildFashionSystemPrompt(closet = [], context = {}) {
  let base = "You are Heliotrope's AI fashion assistant for buyers in Bangladesh. Give practical, respectful styling advice. Reference local occasions (eid, weddings, Pohela Boishakh) when relevant. If a digital closet is provided, prefer suggesting combinations using those items by name; say what is missing if the user asks for a full look and something is not in the closet. Keep answers concise unless the user asks for detail.";
  base += "\n\nTone and style requirements:\n- Sound polished, elegant, and friendly.\n- Use simple, clear language that feels easy to follow.\n- Avoid slang, harsh wording, and robotic phrasing.\n- Be encouraging and kind, but stay specific and practical.\n- When listing options, prefer short bullets or short clean sentences.";
  base += "\n\nOutput format must be exactly this structure:\nPrimary Look: <one short paragraph>\nAlternative Look: <one short paragraph>\nAccessories and Footwear: <one short paragraph>\nNotes: <one short paragraph>.";
  base += "\n\nHard styling rules:\n- Use exactly one base outfit per look.\n- A base outfit is either one full-piece garment (dress/abaya/gown/jumpsuit) OR a top+bottom/set.\n- Never combine two base outfits in the same look.\n- If another base garment is relevant, place it only in Alternative Look.\n- Do not invent item IDs. If an ID is unknown, omit it.";
  if (context.city) base += ` User city hint: ${context.city}.`;
  if (context.season) base += ` Season: ${context.season}.`;
  if (closet.length) {
    const lines = closet.map((c) => `- ${c.name} (${c.category})${c.color ? ` color:${c.color}` : ''}${c.brand ? ` brand:${c.brand}` : ''}${c.occasions?.length ? ` occasions:${c.occasions.join(',')}` : ''}${c.hasImage ? ' hasImage:true' : ''}`).join('\n');
    base += `\n\nUser's digital closet:\n${lines}`;
  } else {
    base += '\n\nNo closet items were sent; give general advice and ask what they own if needed.';
  }
  base += '\n\nWhen closet images are provided, use them to infer visible colors, fabric weight, style formality, and item type before suggesting outfits.';
  return base;
}
function toOpenRouterMessages(messages, closetImages = []) {
  const conversation = messages.filter((m) => m.role !== 'system').map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content }));
  if (closetImages.length) {
    const textSummary = 'Closet images were provided for context. Use these visuals to infer colors, fabrics, and formality before suggesting outfits. Item references: ' + closetImages.map((image) => `${image.name} (id:${image.itemId})`).join(', ');
    const content = [{ type: 'text', text: textSummary }, ...closetImages.map((image) => ({ type: 'image_url', image_url: { url: `data:${image.mimeType};base64,${image.dataBase64}` } }))];
    conversation.push({ role: 'user', content });
  }
  return conversation;
}
function buildFashionFallbackReply(messages, closet = []) {
  const lastUserMessage = [...messages].reverse().find((m) => m && m.role === 'user' && typeof m.content === 'string')?.content?.toLowerCase() || '';
  const closetNames = closet.map((item) => String(item.name || '')).join(', ');
  if (lastUserMessage.includes('green dress')) {
    return ['Lovely choice. For a green dress, keep the look refined and balanced:', '- Shoes: nude, beige, soft gold, or white', '- Bag: tan, cream, or a compact metallic clutch', '- Jewelry: delicate gold pieces pair beautifully with green', '- Layer: a light beige or ivory outer layer if needed', closetNames ? `If you already own these items, I would style them in first: ${closetNames}.` : ''].filter(Boolean).join('\n');
  }
  if (lastUserMessage.includes('black jeans')) {
    return 'Black jeans look most polished with a white, cream, or pastel top. Finish with neutral shoes and one elegant accent, such as gold jewelry or a structured mini bag.';
  }
  return 'I am temporarily rate-limited, but I can still guide you quickly: start with your main item, pair it with one neutral base piece, and finish with one refined accent color or accessory. Share your occasion and what you already own, and I will tailor it beautifully.';
}
async function runFashionChatDirect(payload) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return { assistant: 'OPENROUTER_API_KEY is not configured. Add it to the server environment to enable live fashion suggestions.', model: 'demo' };
  }
  const defaultModel = process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.1-8b-instruct';
  const visionModel = process.env.OPENROUTER_VISION_MODEL || defaultModel;
  const buildBody = (modelName, includeImages) => ({
    model: modelName,
    messages: [{ role: 'system', content: buildFashionSystemPrompt(payload.closet, payload.context) }, ...toOpenRouterMessages(payload.messages, includeImages ? payload.closetImages : [])],
    temperature: 0.75,
    max_tokens: 600,
  });
  const runCompletion = (body) => fetch('https://openrouter.ai/api/v1/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` }, body: JSON.stringify(body) });
  let usedVisionInput = Boolean(payload.closetImages?.length);
  let model = usedVisionInput ? visionModel : defaultModel;
  let response = await runCompletion(buildBody(model, usedVisionInput));
  if (!response.ok && usedVisionInput) {
    const errBody = await response.text().catch(() => '');
    const imageNotSupported = response.status === 404 && /no endpoints found that support image input|support image input/i.test(errBody);
    if (imageNotSupported) { usedVisionInput = false; model = defaultModel; response = await runCompletion(buildBody(model, false)); }
    else {
      if (response.status === 429) return { assistant: buildFashionFallbackReply(payload.messages, payload.closet), model: 'fallback' };
      throw new Error(`OpenRouter API error (${response.status}): ${errBody || 'request failed'}`);
    }
  }
  if (!response.ok) {
    const errBody = await response.text().catch(() => '');
    if (response.status === 429) return { assistant: buildFashionFallbackReply(payload.messages, payload.closet), model: 'fallback' };
    throw new Error(`OpenRouter API error (${response.status}): ${errBody || 'request failed'}`);
  }
  const data = await response.json();
  const assistant = data?.choices?.[0]?.message?.content?.trim() || '';
  return { assistant, model };
}

router.use(protect);

router.post('/ai-chat', async (req, res) => {
  try {
    if (req.user.role !== 'buyer') { res.status(403).json({ error: 'AI fashion assistant is buyer-only.' }); return; }
    const userId = req.user._id.toString();
    if (!Array.isArray(req.body?.messages) || req.body.messages.length === 0) { res.status(400).json({ error: 'messages array is required.' }); return; }
    const closetItems = await ClosetItemModel.find({ userId }).select('name type colors brand occasions imageUrl').lean();
    const closetImages = await buildClosetVisionImages(closetItems);
    const closet = closetItems.map((item) => ({ id: item._id, name: item.name, category: item.type, color: item.colors?.[0] || undefined, brand: item.brand, occasions: item.occasions || [], hasImage: Boolean(item.imageUrl) }));
    const payload = { messages: req.body.messages, closet, closetImages, context: req.body.context || { season: 'summer' } };
    try { const data = await runFashionChatDirect(payload); res.json(data); }
    catch (error) { const message = error instanceof Error ? error.message : 'AI request failed'; res.status(500).json({ error: message }); }
  } catch (error) { res.status(502).json({ error: error instanceof Error ? error.message : 'AI service is unreachable.' }); }
});

router.post('/outfits/generate', async (req, res) => {
  try {
    if (req.user.role !== 'buyer') { res.status(403).json({ error: 'Outfit generator is buyer-only.' }); return; }
    const userId = req.user._id.toString();
    const requestedOccasion = req.body?.occasion;
    if (requestedOccasion && !VALID_OUTFIT_OCCASIONS.has(String(requestedOccasion))) {
      res.status(400).json({ error: `Invalid occasion. Use one of: ${Array.from(VALID_OUTFIT_OCCASIONS).join(', ')}` });
      return;
    }
    const closetItems = await ClosetItemModel.find({ userId }).select('name type colors brand occasions imageUrl notes').lean();
    const closet = toOutfitClosetItems(closetItems);
    if (!closet.length) { res.status(400).json({ error: 'No compatible closet items found. Add clothes/shoes/accessories first.' }); return; }
    const closetImages = await buildClosetVisionImages(closetItems);
    const payload = { occasion: requestedOccasion || undefined, useAI: Boolean(req.body?.useAI), closet, closetImages };
    const proxyRes = await fetch('http://localhost:3001/api/outfits/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!proxyRes.ok) {
      const serviceError = await proxyRes.json().catch(() => ({}));
      res.status(proxyRes.status).json({ error: serviceError?.error || 'Outfit generator service error' });
      return;
    }
    const data = await proxyRes.json();
    res.json({ ...data, source: { closetCount: closet.length, closetImageCount: closetImages.length } });
  } catch (error) {
    console.error('Outfit generation proxy error:', error);
    res.status(502).json({ error: 'Outfit generator is unreachable. Start outfit-generator service on port 3001.' });
  }
});

export default router;

