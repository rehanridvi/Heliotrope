import Review from '../models/Review.js';
import Product from '../models/Product.js';
import Order from '../models/Order.js';

const reviewFileUrl = (req, filename) =>
  `${req.protocol}://${req.get('host')}/uploads/reviews/${filename}`;

export const listProductReviews = async (req, res) => {
  const { productId } = req.params;
  const reviews = await Review.find({ product: productId })
    .populate('buyer', 'name')
    .sort({ createdAt: -1 });
  res.json({ reviews });
};

export const canReviewProduct = async (req, res) => {
  const { productId } = req.params;
  const delivered = await Order.findOne({
    buyer: req.user._id,
    status: 'delivered',
    'items.product': productId,
  });
  if (!delivered) return res.json({ canReview: false });
  const already = await Review.findOne({ buyer: req.user._id, product: productId });
  if (already) return res.json({ canReview: false });
  return res.json({ canReview: true });
};

export const addProductReview = async (req, res) => {
  const { productId } = req.params;
  const { rating, text } = req.body;

  const product = await Product.findById(productId);
  if (!product) return res.status(404).json({ message: 'Product not found' });

  const delivered = await Order.findOne({
    buyer: req.user._id,
    status: 'delivered',
    'items.product': productId,
  });
  if (!delivered) return res.status(403).json({ message: 'You can review only after delivery' });

  const already = await Review.findOne({ buyer: req.user._id, product: productId });
  if (already) return res.status(400).json({ message: 'You already reviewed this product' });

  const r = Number(rating);
  if (!r || r < 1 || r > 5) return res.status(400).json({ message: 'Rating must be 1-5' });

  const cleanText = String(text || '').trim();
  if (cleanText.length < 5) return res.status(400).json({ message: 'Review text too short' });

  const images = (req.files || []).map((f) => reviewFileUrl(req, f.filename));

  const review = await Review.create({
    product: productId,
    buyer: req.user._id,
    rating: r,
    text: cleanText,
    images,
  });

  product.ratingSum += r;
  product.ratingCount += 1;
  product.ratingAverage = Number((product.ratingSum / product.ratingCount).toFixed(2));
  await product.save();

  res.status(201).json({
    review,
    ratingAverage: product.ratingAverage,
    ratingCount: product.ratingCount,
  });
};

export const listMyReviews = async (req, res) => {
  const reviews = await Review.find({ buyer: req.user._id })
    .populate('product', 'name price images')
    .sort({ createdAt: -1 });
  res.json({ reviews });
};

