// routes/order.routes.js
import express from "express";
const router = express.Router();

// Controllers
import {
  createOrder,
  getUserOrders,
  getOrderById,
  getOrderByNumber,
  cancelOrder,
  repayOrder,
  getAllOrders,
  updateOrderStatus,
  confirmOrderReceived,
} from "../controllers/order.controller.js";

// Middlewares
import { authenticate } from "../middlewares/authenticate.js";
import { authorize } from "../middlewares/authorize.js";

import {
  validate,
  validateRequest,
  validateOrderAddress, // 🔥 Cái này dùng cho createOrder
} from "../middlewares/validateRequest.js";

import {
  createOrderSchema,
  updateOrderStatusSchema,
} from "../validators/order.validator.js";

// 🔒 User must be authenticated
router.use(authenticate);

// ================================
// USER ROUTES
// ================================

// 🟢 Tạo đơn hàng
// ❗ Bỏ validateRequest(createOrderSchema)
// ❗ Dùng validateOrderAddress (khớp BE)
router.post("/", validateOrderAddress, createOrder);

// 🟢 Lấy danh sách đơn hàng
router.get("/", getUserOrders);

// 🟢 Lấy đơn theo số đơn
router.get("/number/:number", getOrderByNumber);

// 🟢 Lấy đơn theo ID
router.get("/:id", getOrderById);

// 🟢 Hủy đơn
router.post("/:id/cancel", cancelOrder);
router.put("/:id/received", authenticate, confirmOrderReceived);
// 🟢 Thanh toán lại
router.post("/:id/repay", repayOrder);

// ================================
// ADMIN ROUTES
// ================================

// 🟣 Admin xem tất cả đơn
// 🟣 Admin / Manager / Support xem tất cả đơn
router.get(
  "/admin/all",
  authorize("admin", "manager", "support"),
  getAllOrders
);

// 🟣 Admin cập nhật trạng thái đơn
router.patch(
  "/admin/:id/status",
  authorize("admin","manager"),
  validate(updateOrderStatusSchema),
  updateOrderStatus
);

export default router;
