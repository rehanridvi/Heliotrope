import { Router } from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { authorizeRoles } from '../middleware/roleMiddleware.js';
import { createReport, listReports, takeReportAction } from '../controllers/reportController.js';

const router = Router();
router.post('/', protect, authorizeRoles('buyer', 'seller'), createReport);
router.get('/', protect, authorizeRoles('admin'), listReports);
router.put('/:reportId/action', protect, authorizeRoles('admin'), takeReportAction);
export default router;
