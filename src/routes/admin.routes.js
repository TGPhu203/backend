import express from 'express';
const router = express.Router();

// Import controller
import adminController from '../controllers/admin.controller.js';

// Import middlewares
import { adminAuthenticate } from '../middlewares/adminAuth.js';
import { validate } from '../middlewares/validateRequest.js';
import { auditMiddleware } from '../services/adminAuditService.js';

// Import validators
import {
  createProductValidation,
  updateProductValidation,
  updateUserValidation,
  updateOrderStatusValidation,
  paginationValidation,
  statsValidation,
  deleteValidation,
  getByIdValidation,
} from '../validators/admin.validator.js';

// Middleware cho tất cả admin routes
router.use(adminAuthenticate);
router.use(auditMiddleware);

/**
 * DASHBOARD & STATISTICS ROUTES
 */
router.get('/dashboard', adminController.getDashboardStats);
router.get('/stats', validate(statsValidation), adminController.getDetailedStats);

/**
 * USER MANAGEMENT ROUTES
 */
router.get('/users', validate(paginationValidation), adminController.getAllUsers);
router.put('/users/:id', validate(updateUserValidation), adminController.updateUser);
router.delete('/users/:id', validate(deleteValidation), adminController.deleteUser);

/**
 * PRODUCT MANAGEMENT ROUTES
 */
router.get('/products', validate(paginationValidation), adminController.getAllProducts);
router.get('/products/:id', validate(getByIdValidation), adminController.getProductById);
router.post('/products', validate(createProductValidation), adminController.createProduct);
router.put('/products/:id', validate(updateProductValidation), adminController.updateProduct);
router.delete('/products/:id', validate(deleteValidation), adminController.deleteProduct);

/**
 * REVIEW MANAGEMENT ROUTES
 */
router.get('/reviews', validate(paginationValidation), adminController.getAllReviews);
router.delete('/reviews/:id', validate(deleteValidation), adminController.deleteReview);

/**
 * ORDER MANAGEMENT ROUTES
 */
router.get('/orders', validate(paginationValidation), adminController.getAllOrders);
router.put('/orders/:id/status', validate(updateOrderStatusValidation), adminController.updateOrderStatus);

export default router;
