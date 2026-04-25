import { Router } from 'express';
import { searchProducts } from '../controllers/searchController.js';
const router = Router();
router.get('/', searchProducts);
export default router;
