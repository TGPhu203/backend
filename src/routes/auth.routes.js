import express from 'express';
import * as authController from '../controllers/auth.controller.js';
import { validateRequest } from '../middlewares/validateRequest.js';
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  emailSchema,
  verifyEmailSchema,
} from '../validators/user.validator.js';
import { authenticate } from '../middlewares/authenticate.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Authentication
 *   description: User authentication and authorization
 */

// Register
router.post('/register', validateRequest(registerSchema), authController.register);

// Login
router.post('/login', validateRequest(loginSchema), authController.login);

// Logout
router.post('/logout', authenticate, authController.logout);

// Verify email via link (GET)
router.get('/verify-email/:token', authController.verifyEmail);

// Verify email via token (POST)
router.post('/verify-email', validateRequest(verifyEmailSchema), authController.verifyEmailWithToken);

// Resend verification email
router.post('/resend-verification', validateRequest(emailSchema), authController.resendVerification);

// Refresh token
router.post('/refresh-token', authController.refreshToken);

// Forgot password
router.post('/forgot-password', validateRequest(forgotPasswordSchema), authController.forgotPassword);

// Reset password
router.post('/reset-password', validateRequest(resetPasswordSchema), authController.resetPassword);

// Get current user
router.get('/me', authenticate, authController.getCurrentUser);

export default router;
