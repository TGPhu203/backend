import express from 'express';
import {
  getAllWarrantyPackages,
  createWarrantyPackage,
  updateWarrantyPackage,
  deleteWarrantyPackage,
  getWarrantyPackageById,
  getWarrantyPackagesByProduct,
} from '../controllers/warrantyPackageController.js';
import { authenticate } from '../middlewares/authenticate.js';
import { adminAuthenticate } from '../middlewares/adminAuth.js';

const router = express.Router();

// Public routes
router.get('/', getAllWarrantyPackages);
router.get('/product/:productId', getWarrantyPackagesByProduct);
router.get('/:id', getWarrantyPackageById);

// Admin routes
router.post('/', adminAuthenticate, createWarrantyPackage);
router.put('/:id', adminAuthenticate, updateWarrantyPackage);
router.delete('/:id', adminAuthenticate, deleteWarrantyPackage);

export default router;
