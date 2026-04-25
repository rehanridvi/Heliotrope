import { Router } from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { authorizeRoles } from '../middleware/roleMiddleware.js';
import {
  listPendingSellers,
  approveSeller,
  createStaffUser,
  setBlockUser,
  deleteProductByAdmin,
  deleteUserByAdmin,
  sendOfferEmail,
  listLowRatedProducts,
  listAllUsers,
  listAllProducts,
} from '../controllers/adminController.js';

const router = Router();

router.get('/pending-sellers', protect, authorizeRoles('admin'), listPendingSellers);
router.put('/approve-seller/:userId', protect, authorizeRoles('admin'), approveSeller);
router.post('/create-staff', protect, authorizeRoles('admin'), createStaffUser);
router.put('/block-user/:userId', protect, authorizeRoles('admin'), setBlockUser);
router.delete('/products/:productId', protect, authorizeRoles('admin'), deleteProductByAdmin);
router.delete('/users/:userId', protect, authorizeRoles('admin'), deleteUserByAdmin);
router.post('/send-offer', protect, authorizeRoles('admin'), sendOfferEmail);
router.get('/low-rated-products', protect, authorizeRoles('admin'), listLowRatedProducts);
router.get('/users', protect, authorizeRoles('admin'), listAllUsers);
router.get('/products', protect, authorizeRoles('admin'), listAllProducts);

export default router;
