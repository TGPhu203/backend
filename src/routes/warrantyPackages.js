// src/routes/warrantyPackages.js
import express from 'express';
import {
  getAllWarrantyPackages,
  createWarrantyPackage,
  updateWarrantyPackage,
  deleteWarrantyPackage,
  getWarrantyPackageById,
  getWarrantyPackagesByProduct,
  getWarrantyByImei, 
} from '../controllers/warrantyPackageController.js';
import { adminAuthenticate } from '../middlewares/adminAuth.js';

const router = express.Router();

// Public routes
router.get('/', getAllWarrantyPackages);
router.get('/product/:productId', getWarrantyPackagesByProduct);
router.get('/:id', getWarrantyPackageById);
router.get('/imei/:imei', getWarrantyByImei);

// Admin routes
router.post('/', adminAuthenticate, createWarrantyPackage);
router.put('/:id', adminAuthenticate, updateWarrantyPackage);
router.delete('/:id', adminAuthenticate, deleteWarrantyPackage);

export default router;
