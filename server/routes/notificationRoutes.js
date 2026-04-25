import { Router } from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { clearAll, getMyNotifications, markAllRead, markOneRead } from '../controllers/notificationController.js';

const router = Router();

router.get('/me', protect, getMyNotifications);
router.patch('/read-all', protect, markAllRead);
router.patch('/:id/read', protect, markOneRead);
router.delete('/clear', protect, clearAll);

export default router;

