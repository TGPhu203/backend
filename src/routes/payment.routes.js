// routes/payment.routes.js
import express from 'express';
const router = express.Router();

import {
  handleWebhook,
  createPaymentIntent,
  confirmPayment,
  createCustomer,
  getPaymentMethods,
  createSetupIntent,
  createRefund,
  createPayOSPaymentLink,  
} from '../controllers/payment.controller.js';

import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';

// Webhook route (no authentication needed)
router.post('/webhook', express.raw({ type: 'application/json' }), handleWebhook);

// Authenticated routes
router.use(authenticate);

// Create payment intent
router.post('/create-payment-intent', createPaymentIntent);

// Confirm payment
router.post('/confirm-payment', confirmPayment);

// Customer management
router.post('/create-customer', createCustomer);
router.get('/payment-methods', getPaymentMethods);
router.post('/create-setup-intent', createSetupIntent);

// Admin routes
router.post('/refund', authorize('admin'), createRefund);
// PayOS
router.post("/payos/create-link",authenticate, createPayOSPaymentLink);
// Webhook PayOS (KHÔNG cần verifyToken, PayOS sẽ gọi thẳng)
router.post("/payos/webhook", handleWebhook);
export default router;
