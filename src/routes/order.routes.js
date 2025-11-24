// routes/order.routes.js
import express from 'express';
const router = express.Router();

// Sử dụng named imports thay vì default import
import {
  createOrder,
  getUserOrders,
  getOrderById,
  getOrderByNumber,
  cancelOrder,
  repayOrder,
  getAllOrders,
  updateOrderStatus,
} from '../controllers/order.controller.js';

import { validateRequest } from '../middlewares/validateRequest.js';
import {
  createOrderSchema,
  updateOrderStatusSchema,
} from '../validators/order.validator.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';

// User routes (authenticated)
router.use(authenticate);
router.post('/', validateRequest(createOrderSchema), createOrder);
router.get('/', getUserOrders);
router.get('/number/:number', getOrderByNumber);
router.get('/:id', getOrderById);
router.post('/:id/cancel', cancelOrder);
router.post('/:id/repay', repayOrder);

// Admin routes
router.get('/admin/all', authorize('admin'), getAllOrders);
router.patch('/admin/:id/status', authorize('admin'), validateRequest(updateOrderStatusSchema), updateOrderStatus);

export default router;
