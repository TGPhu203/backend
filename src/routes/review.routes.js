// routes/review.routes.js
import express from "express";
const router = express.Router();

import * as reviewController from "../controllers/review.controller.js";
import { validateRequest } from "../middlewares/validateRequest.js";
import {
  reviewSchema,
  reviewHelpfulSchema,
} from "../validators/review.validator.js";
import { authenticate } from "../middlewares/authenticate.js";
import { authorize } from "../middlewares/authorize.js";

/**
 * PUBLIC ROUTES
 */

// Lấy danh sách review của 1 sản phẩm (public)
router.get("/product/:productId", reviewController.getProductReviews);

/**
 * AUTHENTICATED USER ROUTES
 * Tất cả route bên dưới đều yêu cầu đăng nhập
 */
router.use(authenticate);

// ✅ Alias cho FE: /api/reviews/purchased-products
router.get(
  "/purchased-products",
  reviewController.getPurchasedProductsForReview
);

// Lấy tất cả review của chính user
router.get("/user", reviewController.getUserReviews);

// Lấy danh sách sản phẩm đã mua (đã giao) để user chọn đánh giá
router.get(
  "/user/purchased-products",
  reviewController.getPurchasedProductsForReview
);

// Tạo review mới
router.post("/", validateRequest(reviewSchema), reviewController.createReview);

// Cập nhật review
router.put("/:id", validateRequest(reviewSchema), reviewController.updateReview);

// Xóa review
router.delete("/:id", reviewController.deleteReview);

// Đánh dấu review hữu ích / không hữu ích
router.put(
  "/:id/helpful",
  validateRequest(reviewHelpfulSchema),
  reviewController.markReviewHelpful
);

/**
 * ADMIN ROUTES
 * Cần quyền admin
 */
router.get(
  "/admin/all",
  authorize("admin","manager"),
  reviewController.getAllReviews
);

router.patch(
  "/admin/:id/verify",
  authorize("admin","manager"),
  reviewController.verifyReview
);

export default router;
