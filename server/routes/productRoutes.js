import { Router } from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { authorizeRoles } from '../middleware/roleMiddleware.js';
import { listProducts, getProduct, createProduct, listMySellerProducts, updateProduct, toggleProductActive } from '../controllers/productController.js';
import { upload } from '../middleware/upload.js';

const router = Router();
router.get('/', listProducts);
router.get('/my', protect, authorizeRoles('seller'), listMySellerProducts);
router.get('/:id', getProduct);
router.post('/', protect, authorizeRoles('seller'), upload.array('images', 5), createProduct);
router.put('/:id', protect, authorizeRoles('seller'), upload.array('images', 5), updateProduct);
router.patch('/:id/toggle', protect, authorizeRoles('seller'), toggleProductActive);
export default router;
