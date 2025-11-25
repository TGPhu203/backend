import express from 'express';
import {
  getProductWarrantiesConfig,
  createProductWarrantyConfig,
  updateProductWarrantyConfig,
  deleteProductWarrantyConfig,
} from '../controllers/warrantyPackageController.js';
import { adminAuthenticate } from '../middlewares/adminAuth.js';

const router = express.Router();

// Lấy cấu hình bảo hành của 1 sản phẩm: GET /api/product-warranties?productId=xxx
router.get('/', adminAuthenticate, getProductWarrantiesConfig);

// Gán gói bảo hành cho sản phẩm: POST /api/product-warranties
router.post('/', adminAuthenticate, createProductWarrantyConfig);

// Cập nhật giá / isDefault: PUT /api/product-warranties/:id
router.put('/:id', adminAuthenticate, updateProductWarrantyConfig);

// Xóa cấu hình bảo hành: DELETE /api/product-warranties/:id
router.delete('/:id', adminAuthenticate, deleteProductWarrantyConfig);

export default router;
