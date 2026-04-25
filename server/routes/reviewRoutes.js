import { Router } from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { authorizeRoles } from '../middleware/roleMiddleware.js';
import { uploadReviewImages } from '../utils/upload.js';
import {
  listProductReviews,
  canReviewProduct,
  addProductReview,
  listMyReviews,
} from '../controllers/reviewController.js';

const router = Router();

router.get('/product/:productId', listProductReviews);
router.get('/product/:productId/can-review', protect, authorizeRoles('buyer'), canReviewProduct);
router.post('/product/:productId', protect, authorizeRoles('buyer'), uploadReviewImages.array('images', 3), addProductReview);
router.get('/me', protect, authorizeRoles('buyer'), listMyReviews);

export default router;

