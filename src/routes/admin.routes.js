import express from 'express';
const router = express.Router();

// Controller
import adminController, { createSupportUser } from '../controllers/admin.controller.js';

// Middlewares
import { authenticate } from "../middlewares/authenticate.js";
import { authorize } from "../middlewares/authorize.js";
import { validate, validateRequest } from '../middlewares/validateRequest.js';
import { auditMiddleware } from '../services/adminAuditService.js';
import { adminAuthenticate } from "../middlewares/adminAuth.js"; // có thể bỏ dần, dùng authorize thay
import {
  adminGetCoupons,
  adminCreateCoupon,
  adminUpdateCoupon,
  adminDeleteCoupon,
  applyCoupon,
} from "../controllers/coupon.controller.js"; 

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
  exportRevenueReport,
} from "../controllers/adminStatsController.js";
import { updateOrderStatus as orderUpdateStatus } from "../controllers/order.controller.js";
import {
  createCouponSchema,
  updateCouponSchema,
} from "../validators/coupon.validator.js";  

// 🔐 BASE MIDDLEWARE CHO /admin
// 1) Bắt buộc đăng nhập
// 2) Chỉ admin / manager / support mới vào được admin panel
// 3) Ghi log
router.use(
  authenticate,
  authorize("admin", "manager", "support"),
  auditMiddleware
);

/**
 * DASHBOARD & STATISTICS ROUTES
 * Chỉ admin + manager xem dashboard, stats
 */
router.get(
  '/dashboard',
  authorize("admin", "manager"),
  adminController.getDashboardStats
);

router.get(
  '/stats',
  authorize("admin", "manager"),
  validate(statsValidation),
  adminController.getDetailedStats
);

/**
 * USER MANAGEMENT ROUTES
 * - Xem danh sách khách hàng: admin + manager + support  (CSKH cần xem info khách)
 * - Sửa, xóa, block/unblock: chỉ admin (hoặc admin+manager tùy bạn)
 */
router.get(
  '/users',
  authorize("admin", "manager", "support"),
  validate(paginationValidation),
  adminController.getAllUsers
);

router.put(
  '/users/:id',
  authorize("admin", "manager"),
  validate(updateUserValidation),
  adminController.updateUser
);

router.delete(
  '/users/:id',
  authorize("admin","manager"),
  validate(deleteValidation),
  adminController.deleteUser
);

router.patch(
  "/users/:id/block",
  authorize("admin","manager"),
  validateRequest(objectIdParam, "params"),
  adminController.blockUser
);

router.patch(
  "/users/:id/unblock",
  authorize("admin","manager"),
  validateRequest(objectIdParam, "params"),
  adminController.unblockUser
);

/**
 * PRODUCT MANAGEMENT ROUTES
 * Chỉ admin + manager quản lý sản phẩm
 * (support không được đổi giá/tồn kho)
 */
router.get(
  "/products",
  authorize("admin", "manager"),
  validate(paginationValidation),
  adminController.getAllProducts
);

router.get(
  "/products/:id",
  authorize("admin", "manager"),
  validate(getByIdValidation),
  adminController.getProductById
);

router.post(
  "/products",
  authorize("admin", "manager"),
  validate(createProductValidation),
  adminController.createProduct
);

router.put(
  "/products/:id",
  authorize("admin", "manager"),
  validateRequest(objectIdParam, "params"),
  validateRequest(updateProductValidation),
  adminController.updateProduct
);

router.delete(
  "/products/:id",
  authorize("admin","manager"),
  validateRequest(objectIdParam, "params"),
  adminController.deleteProduct
);

/**
 * REVIEW MANAGEMENT ROUTES
 * Admin + manager + support đều có thể xem / xóa review (tùy policy)
 */
router.get(
  '/reviews',
  authorize("admin", "manager", "support"),
  validate(paginationValidation),
  adminController.getAllReviews
);

router.delete(
  '/reviews/:id',
  authorize("admin", "manager"),
  validate(deleteValidation),
  adminController.deleteReview
);

/**
 * ORDER MANAGEMENT ROUTES
 * - Xem danh sách đơn: admin + manager + support
 * - Đổi trạng thái (xác nhận/giao hàng/hoàn tiền): admin + manager
 *   (support chỉ nên cập nhật ghi chú / ticket, không đổi status chính)
 */
router.get(
  '/orders',
  authorize("admin", "manager", "support"),
  validate(paginationValidation),
  adminController.getAllOrders
);

router.patch(
  "/orders/:id/status",
  authorize("admin", "manager","support"),
  validate(updateOrderStatusValidation),
  orderUpdateStatus
);

// Ví dụ: route CSKH cập nhật ghi chú trên đơn (cả admin/manager/support dùng được)
// router.patch(
//   "/orders/:id/note",
//   authorize("admin", "manager", "support"),
//   updateOrderNoteController
// );

/**
 * COUPON MANAGEMENT
 * - Xem coupon: admin + manager + support (để tư vấn khách)
 * - Tạo/Sửa/Xóa coupon: chỉ admin (hoặc admin+manager nếu bạn muốn)
 * - Apply coupon: có thể cho cả support dùng để hỗ trợ khách
 */
router.get(
  "/coupons",
  authorize("admin", "manager", "support"),
  adminGetCoupons
);

router.post(
  "/coupons",
  authorize("admin","manager"),
  validateRequest(createCouponSchema),   // Joi schema
  adminCreateCoupon
);

router.put(
  "/coupons/:id",
  authorize("admin","manager"),
  validateRequest(updateCouponSchema),   // Joi schema
  adminUpdateCoupon
);

router.delete(
  "/coupons/:id",
  authorize("admin","manager"),
  adminDeleteCoupon
);

// Áp mã giảm giá trong context admin/CSKH (ví dụ hotline nhập giúp khách)
router.post(
  "/apply",
  authorize("admin", "manager", "support"),
  applyCoupon
);

/**
 * REVENUE STATS
 * Chỉ admin + manager xem thống kê doanh thu
 */
router.get(
  "/stats/revenue/daily",
  authorize("admin", "manager","support"),
  getDailyRevenue
);

router.get(
  "/stats/revenue/monthly",
  authorize("admin", "manager","support"),
  getMonthlyRevenue
);

router.get(
  "/stats/revenue/yearly",
  authorize("admin", "manager","support"),
  getYearlyRevenue
);
router.get(
  "/stats/revenue/export",
  authorize("admin", "manager", "support"), // hoặc chỉ "admin","manager" tùy policy
  exportRevenueReport
);
/**
 * SUPPORT STAFF (CSKH)
 * - Tạo nhân viên CSKH: chỉ admin
 * - Xem danh sách nhân viên CSKH: admin + manager
 */
router.post(
  "/support",
  authorize("admin","manager"),
  createSupportUser
);

router.get(
  "/support-users",
  authorize("admin", "manager"),
  adminController.getSupportUsers
);
// EMPLOYEE
router.get("/employees", adminController.getEmployees);
router.post("/employees", adminController.createEmployee);
router.patch("/employees/:id", adminController.updateEmployee);

// ATTENDANCE
router.post("/attendance/check-in", adminController.checkIn);
router.post("/attendance/check-out", adminController.checkOut);
router.get("/attendance", adminController.getAttendance);

// PAYROLL
router.post("/payroll/generate", adminController.generatePayroll);
router.get("/payroll", adminController.getPayrolls);
router.post("/payroll/:id/mark-paid", adminController.markPayrollPaid);
router.get(
  "/payroll/export",
  authorize("admin", "manager"),
  adminController.exportPayrollReport
);
export default router;
