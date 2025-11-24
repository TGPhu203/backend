import express from 'express';
import { validateRequest } from '../middlewares/validateRequest.js';
import { categorySchema } from '../validators/category.validator.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';
import {
  getAllCategories,
  getCategoryTree,
  getFeaturedCategories,
  getCategoryBySlug,
  getProductsByCategory,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
} from '../controllers/category.controller.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Categories
 *   description: Category management
 */

// Public routes
router.get('/', getAllCategories);
router.get('/tree', getCategoryTree);
router.get('/featured', getFeaturedCategories);
router.get('/slug/:slug', getCategoryBySlug);
router.get('/:id/products', getProductsByCategory);
router.get('/:id', getCategoryById);

// Admin routes
router.post(
  '/',
  authenticate,
  authorize('admin'),
  validateRequest(categorySchema),
  createCategory
);

router.put(
  '/:id',
  authenticate,
  authorize('admin'),
  validateRequest(categorySchema),
  updateCategory
);

router.delete(
  '/:id',
  authenticate,
  authorize('admin'),
  deleteCategory
);

export default router;
