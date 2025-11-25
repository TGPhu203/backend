import express from 'express';
import uploadController from '../controllers/upload.controller.js';
import { authenticate } from '../middlewares/authenticate.js';
import {
    getProfile,
    updateProfile,
    changePassword,
    getAddresses,
    addAddress,
    updateAddress,
    deleteAddress,
    setDefaultAddress,
  } from '../controllers/user.controller.js';
const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Upload
 *   description: File upload management
 */
// Lấy thông tin profile user hiện tại
router.get('/profile', authenticate, getProfile);

// Cập nhật profile
router.put('/profile', authenticate, updateProfile);

// Đổi mật khẩu
router.put('/change-password', authenticate, changePassword);

// Địa chỉ
router.get('/addresses', authenticate, getAddresses);
router.post('/addresses', authenticate, addAddress);
router.put('/addresses/:id', authenticate, updateAddress);
router.delete('/addresses/:id', authenticate, deleteAddress);
router.put('/addresses/:id/default', authenticate, setDefaultAddress);
// Upload single file
router.post('/:type/single', authenticate, uploadController.uploadSingle);

// Upload multiple files
router.post('/:type/multiple', authenticate, uploadController.uploadMultiple);

// Delete file
router.delete('/:type/:filename', authenticate, uploadController.deleteFile);

export default router;
