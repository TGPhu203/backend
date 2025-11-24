// routes/product.routes.js
import express from 'express';
const router = express.Router();

import * as productController from '../controllers/product.controller.js';
import { validateRequest } from '../middlewares/validateRequest.js';
import { productSchema } from '../validators/product.validator.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';

// ============================
// User-facing product routes
// ============================
router.get('/', productController.getAllProducts);
router.get('/featured', productController.getFeaturedProducts);
router.get('/new-arrivals', productController.getNewArrivals);
router.get('/best-sellers', productController.getBestSellers);
router.get('/deals', productController.getDeals);
router.get('/filters', productController.getProductFilters);
router.get('/search', productController.searchProducts);
router.get('/slug/:slug', productController.getProductBySlug);
router.get('/:id/related', productController.getRelatedProducts);
router.get('/:id/variants', productController.getProductVariants);
router.get('/:id/reviews-summary', productController.getProductReviewsSummary);
router.get('/:id', productController.getProductById);

// ============================
// Admin product management routes
// ============================
router.post(
  '/',
  authenticate,
  authorize('admin'),
  validateRequest(productSchema),
  productController.createProduct
);

router.put(
  '/:id',
  authenticate,
  authorize('admin'),
  validateRequest(productSchema),
  productController.updateProduct
);

router.delete(
  '/:id',
  authenticate,
  authorize('admin'),
  productController.deleteProduct
);

export default router;
