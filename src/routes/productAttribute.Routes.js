// src/routes/productAttributeRoutes.js
import express from 'express';
import {
  getProductSpecs,
  createProductSpec,
  updateProductSpec,
  deleteProductSpec,
} from '../controllers/productAttribute.controller.js';
import { adminAuthenticate } from '../middlewares/adminAuth.js';

const router = express.Router();

/**
 * Public: FE đọc thông số kỹ thuật sản phẩm
 * GET /api/product-attributes/:productId/specs
 */
router.get('/:productId/specs', getProductSpecs);

/**
 * Admin: quản lý thông số (thêm / sửa / xoá)
 * Các route dưới đây bắt buộc token admin (adminAuthenticate)
 */
router.post('/:productId/specs', adminAuthenticate, createProductSpec);

router.put('/specs/:id', adminAuthenticate, updateProductSpec);

router.delete('/specs/:id', adminAuthenticate, deleteProductSpec);

export default router;
