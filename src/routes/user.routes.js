import express from 'express';
import uploadController from '../controllers/upload.controller.js';
import { authenticate } from '../middlewares/authenticate.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Upload
 *   description: File upload management
 */

// Upload single file
router.post('/:type/single', authenticate, uploadController.uploadSingle);

// Upload multiple files
router.post('/:type/multiple', authenticate, uploadController.uploadMultiple);

// Delete file
router.delete('/:type/:filename', authenticate, uploadController.deleteFile);

export default router;
