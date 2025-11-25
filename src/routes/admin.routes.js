import express from 'express';
const router = express.Router();

// Controller
import adminController from '../controllers/admin.controller.js';

// Middlewares
import { authenticate } from "../middlewares/authenticate.js";
import { authorize } from "../middlewares/authorize.js";
import { validate, validateRequest } from '../middlewares/validateRequest.js';
import { auditMiddleware } from '../services/adminAuditService.js';
import { adminAuthenticate } from "../middlewares/adminAuth.js";

// Validators
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
import { objectIdParam } from "../validators/common.validator.js";
import {
  getDailyRevenue,
  getMonthlyRevenue,
  getYearlyRevenue,
} from "../controllers/adminStatsController.js";

// 🔐 Tất cả route /admin đều phải:
// 1) Đăng nhập (authenticate)
// 2) Role admin (authorize)
// 3) Ghi log (audit)
router.use(authenticate, authorize("admin"), auditMiddleware);

/**
 * DASHBOARD & STATISTICS ROUTES
 */
router.get('/dashboard', authenticate, adminAuthenticate,adminController.getDashboardStats);
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
router.get(
  "/products",
  validate(paginationValidation),
  adminController.getAllProducts
);

router.get(
  "/products/:id",
  validate(getByIdValidation),
  adminController.getProductById
);

router.post(
  "/products",
  validate(createProductValidation),
  adminController.createProduct
);

router.put(
  "/products/:id",
  validateRequest(objectIdParam, "params"),
  validateRequest(updateProductValidation),
  adminController.updateProduct
);

router.delete(
  "/products/:id",
  validateRequest(objectIdParam, "params"),
  adminController.deleteProduct
);

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
router.get(
  "/stats/revenue/daily",
  adminAuthenticate,
  getDailyRevenue
);

router.get(
  "/stats/revenue/monthly",
  adminAuthenticate,
  getMonthlyRevenue
);

router.get(
  "/stats/revenue/yearly",
  adminAuthenticate,
  getYearlyRevenue
);

export default router;
