import { Router } from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { authorizeRoles } from '../middleware/roleMiddleware.js';
import { checkout, buyerOrders, sellerOrders, sellerDecision, assignDelivery, employeeOrders, deliveryOrders, deliveryStatus, buyerCancelOrder } from '../controllers/orderController.js';

const router = Router();
router.post('/checkout', protect, authorizeRoles('buyer'), checkout);
router.get('/my', protect, authorizeRoles('buyer'), buyerOrders);
router.get('/seller', protect, authorizeRoles('seller'), sellerOrders);
router.put('/:orderId/decision', protect, authorizeRoles('seller'), sellerDecision);
router.put('/:orderId/assign-delivery', protect, authorizeRoles('admin', 'employee'), assignDelivery);
router.get('/employee', protect, authorizeRoles('admin', 'employee'), employeeOrders);
router.get('/delivery', protect, authorizeRoles('delivery'), deliveryOrders);
router.put('/:orderId/delivery-status', protect, authorizeRoles('delivery'), deliveryStatus);
router.put('/:orderId/cancel', protect, authorizeRoles('buyer'), buyerCancelOrder);
export default router;
