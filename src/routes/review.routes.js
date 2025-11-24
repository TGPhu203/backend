// routes/review.routes.js
import express from 'express';
const router = express.Router();

import * as reviewController from '../controllers/review.controller.js';
import { validateRequest } from '../middlewares/validateRequest.js';
import { reviewSchema, reviewHelpfulSchema } from '../validators/review.validator.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';

// Public routes
router.get('/product/:productId', reviewController.getProductReviews);

// User routes (authenticated)
router.use('/user', authenticate);
router.get('/user', reviewController.getUserReviews);

router.post(
  '/',
  authenticate,
  validateRequest(reviewSchema),
  reviewController.createReview
);

router.put(
  '/:id',
  authenticate,
  validateRequest(reviewSchema),
  reviewController.updateReview
);

router.delete('/:id', authenticate, reviewController.deleteReview);

router.put(
  '/:id/helpful',
  authenticate,
  validateRequest(reviewHelpfulSchema),
  reviewController.markReviewHelpful
);

// Admin routes
router.get(
  '/admin/all',
  authenticate,
  authorize('admin'),
  reviewController.getAllReviews
);

router.patch(
  '/admin/:id/verify',
  authenticate,
  authorize('admin'),
  reviewController.verifyReview
);

export default router;
