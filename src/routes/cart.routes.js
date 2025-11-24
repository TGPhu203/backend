import express from 'express';
import { validateRequest } from '../middlewares/validateRequest.js';
import {
  addToCartSchema,
  updateCartItemSchema,
  syncCartSchema,
} from '../validators/cart.validator.js';
import { optionalAuthenticate } from '../middlewares/authenticate.js';
import {
  getCart,
  getCartCount,
  addToCart,
  updateCartItem,
  removeCartItem,
  clearCart,
  syncCart,
  mergeCart,
} from '../controllers/cart.controller.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Cart
 *   description: Shopping cart management
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     CartItem:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           description: Cart item ID
 *         cartId:
 *           type: integer
 *           description: Cart ID
 *         productId:
 *           type: integer
 *           description: Product ID
 *         variantId:
 *           type: integer
 *           description: Product variant ID
 *         quantity:
 *           type: integer
 *           description: Quantity of the product
 *         price:
 *           type: number
 *           description: Price at the time of adding to cart
 *         Product:
 *           type: object
 *           properties:
 *             id:
 *               type: integer
 *             name:
 *               type: string
 *             slug:
 *               type: string
 *             price:
 *               type: number
 *             thumbnail:
 *               type: string
 *             inStock:
 *               type: boolean
 *             stockQuantity:
 *               type: integer
 *         ProductVariant:
 *           type: object
 *           properties:
 *             id:
 *               type: integer
 *             name:
 *               type: string
 *             price:
 *               type: number
 *             stockQuantity:
 *               type: integer
 */

// All routes use optional authentication to handle both guest and logged-in users
router.use(optionalAuthenticate);

// Get user's cart
router.get('/', getCart);

// Get cart item count
router.get('/count', getCartCount);

// Add item to cart
router.post('/', validateRequest(addToCartSchema), addToCart);

// Sync cart from local storage to server
router.post('/sync', validateRequest(syncCartSchema), syncCart);

// Merge guest cart with user cart after login
router.post('/merge', mergeCart);

// Update cart item quantity
router.put('/items/:id', validateRequest(updateCartItemSchema), updateCartItem);

// Remove item from cart
router.delete('/items/:id', removeCartItem);

// Clear cart
router.delete('/', clearCart);

export default router;
