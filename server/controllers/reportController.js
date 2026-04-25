import Report from '../models/Report.js';
import Product from '../models/Product.js';
import Review from '../models/Review.js';
import User from '../models/User.js';
import { notifyUser } from '../utils/notify.js';
import { emailTemplates } from '../utils/email.js';

const shortId = (id) => `#${String(id).slice(-6).toUpperCase()}`;

export const createReport = async (req, res) => {
  try {
    const { productId, reviewId, reason, description } = req.body;

    if (!productId) return res.status(400).json({ message: 'productId is required' });

    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    if (reviewId) {
      const review = await Review.findById(reviewId);
      if (!review) return res.status(404).json({ message: 'Review not found' });
      if (String(review.buyer) === String(req.user._id)) {
        return res.status(400).json({ message: 'You cannot report your own review' });
      }
    }

    const existing = await Report.findOne({
      product: productId,
      ...(reviewId ? { review: reviewId } : { review: null }),
      reportedBy: req.user._id,
      status: 'pending',
    });

    if (existing) {
      return res.status(400).json({ message: 'You already have a pending report for this item' });
    }

    const report = await Report.create({
      product: productId,
      review: reviewId || null,
      reportedBy: req.user._id,
      type: reviewId ? 'review' : 'product',
      reason: reason || 'other',
      description: description || '',
    });

    res.status(201).json({ report, message: 'Report submitted' });
  } catch (e) {
    console.error('createReport error:', e);
    res.status(500).json({ message: 'Server error' });
  }
};

export const listReports = async (req, res) => {
  try {
    const { status, type, reason, page = '1', limit = '20' } = req.query;

    const query = {};
    if (status) query.status = status;
    if (type) query.type = type;
    if (reason) query.reason = reason;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const reports = await Report.find(query)
      .populate('product', 'name price seller')
      .populate('review', 'rating text buyer')
      .populate('reportedBy', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    const total = await Report.countDocuments(query);

    res.json({ reports, total, page: pageNum, pages: Math.ceil(total / limitNum) });
  } catch (e) {
    console.error('listReports error:', e);
    res.status(500).json({ message: 'Server error' });
  }
};

export const takeReportAction = async (req, res) => {
  try {
    const { reportId } = req.params;
    const { action, adminNote } = req.body;

    if (!['dismissed', 'product_removed', 'review_removed'].includes(action)) {
      return res.status(400).json({ message: 'Invalid action' });
    }

    const report = await Report.findById(reportId).populate('product').populate('review');
    if (!report) return res.status(404).json({ message: 'Report not found' });

    report.status = 'reviewed';
    report.adminAction = action;
    if (adminNote) report.adminNote = String(adminNote);
    await report.save();

    if (action === 'product_removed' && report.product) {
      const product = await Product.findById(report.product._id);
      if (product) {
        const seller = await User.findById(product.seller).select('name email');
        await product.deleteOne();
        if (seller) {
          await notifyUser({
            userId: seller._id,
            type: 'system',
            title: 'Product removed by admin',
            body: `Your product "${report.product.name}" has been removed due to reports.`,
            link: '/dashboard',
            meta: { kind: 'PRODUCT_REMOVED', productId: report.product._id },
            emailSubject: 'Your product has been removed - Heliotrope',
            emailHtml: emailTemplates.productRemoved
              ? emailTemplates.productRemoved(seller.name, report.product.name, adminNote)
              : `<p>Hi ${seller.name}, your product "${report.product.name}" has been removed.</p>`,
          });
        }
      }
    }

    if (action === 'review_removed' && report.review) {
      const review = await Review.findById(report.review._id);
      if (review) {
        const buyer = await User.findById(review.buyer).select('name email');
        const product = await Product.findById(review.product);
        if (product) {
          product.ratingSum -= review.rating;
          product.ratingCount -= 1;
          product.ratingAverage = product.ratingCount > 0
            ? Number((product.ratingSum / product.ratingCount).toFixed(2))
            : 0;
          await product.save();
        }
        await review.deleteOne();
        if (buyer) {
          await notifyUser({
            userId: buyer._id,
            type: 'system',
            title: 'Review removed by admin',
            body: 'Your review has been removed after admin review.',
            link: '/dashboard',
            meta: { kind: 'REVIEW_REMOVED', reviewId: report.review._id },
            emailSubject: 'Your review has been removed - Heliotrope',
            emailHtml: emailTemplates.reviewRemoved
              ? emailTemplates.reviewRemoved(buyer.name, adminNote)
              : `<p>Hi ${buyer.name}, your review has been removed by admin.</p>`,
          });
        }
      }
    }

    res.json({ message: `Report ${action.replace('_', ' ')}`, report });
  } catch (e) {
    console.error('takeReportAction error:', e);
    res.status(500).json({ message: 'Server error' });
  }
};

