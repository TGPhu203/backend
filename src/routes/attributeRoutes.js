// routes/attributeRoutes.js
import express from 'express';
const router = express.Router();

import attributeController from '../controllers/attributeController.js';
import { authenticate } from '../middlewares/authenticate.js';
import { adminAuthenticate } from '../middlewares/adminAuth.js';
// ================= PUBLIC ==================
// Public routes (for frontend product display)
router.get('/groups', attributeController.getAttributeGroups);

router.get(
  '/products/:productId/groups',
  attributeController.getProductAttributeGroups
);

// Product name generation routes (public for frontend use)
router.post('/preview-name', attributeController.previewProductName);
router.post(
  '/generate-name-realtime',
  attributeController.generateNameRealTime
);
router.get('/name-affecting', attributeController.getNameAffectingAttributes);

// ================ ADMIN ONLY =================
// viết giống kiểu:
// router.get('/dashboard', authenticate, adminAuthenticate, ...)

// Attribute groups management
router.post(
  '/groups',
  authenticate,
  adminAuthenticate,
  attributeController.createAttributeGroup
);

router.put(
  '/groups/:id',
  authenticate,
  adminAuthenticate,
  attributeController.updateAttributeGroup
);

router.delete(
  '/groups/:id',
  authenticate,
  adminAuthenticate,
  attributeController.deleteAttributeGroup
);

// Attribute values management
router.get(
  '/groups/:attributeGroupId/values',
  authenticate,
  adminAuthenticate,
  attributeController.getAttributeValuesByGroup
);
router.post(
  '/groups/:attributeGroupId/values',
  authenticate,
  adminAuthenticate,
  attributeController.addAttributeValue
);
router.put(
  '/values/:id',
  authenticate,
  adminAuthenticate,
  attributeController.updateAttributeValue
);

router.delete(
  '/values/:id',
  authenticate,
  adminAuthenticate,
  attributeController.deleteAttributeValue
);

// Product attribute group assignments
router.post(
  '/products/:productId/groups/:attributeGroupId',
  authenticate,
  adminAuthenticate,
  attributeController.assignAttributeGroupToProduct
);

// remove group khỏi product
router.delete(
  '/products/:productId/groups/:attributeGroupId',
  authenticate,
  adminAuthenticate,
  attributeController.removeAttributeGroupFromProduct
);

// Admin-only batch name generation
router.post(
  '/batch-generate-names',
  authenticate,
  adminAuthenticate,
  attributeController.batchGenerateProductNames
);

export default router;
