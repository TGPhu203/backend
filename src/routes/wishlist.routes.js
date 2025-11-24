// src/routes/wishlist.routes.js
import express from 'express';
import * as wishlistController from '../controllers/wishlist.controller.js';
import { authenticate } from '../middlewares/authenticate.js';

const router = express.Router();

// Tất cả route cần authenticate
router.use(authenticate);

// Wishlist routes
router.get('/', wishlistController.getWishlist);
router.post('/', wishlistController.addToWishlist);
router.get('/check/:productId', wishlistController.checkWishlist);
router.delete('/:productId', wishlistController.removeFromWishlist);
router.delete('/', wishlistController.clearWishlist);


export default router;
