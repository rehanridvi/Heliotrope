import { Router } from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { authorizeRoles } from '../middleware/roleMiddleware.js';
import { getMyProfile, updateMyProfile, listDeliverymen } from '../controllers/userController.js';

const router = Router();
router.get('/me', protect, getMyProfile);
router.put('/me', protect, updateMyProfile);
router.get('/deliverymen', protect, authorizeRoles('admin'), listDeliverymen);
export default router;
