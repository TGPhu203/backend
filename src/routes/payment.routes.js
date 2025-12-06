// routes/payment.routes.js
import express from "express";
const router = express.Router();

import {
  handleWebhook,          // Stripe webhook (stub)
  createPaymentIntent,
  confirmPayment,
  createCustomer,
  getPaymentMethods,
  createSetupIntent,
  createRefund,
  createPayOSPaymentLink,  
  handlePayOSWebhook,     // PayOS webhook thật
} from "../controllers/payment.controller.js";

import { authenticate } from "../middlewares/authenticate.js";
import { authorize } from "../middlewares/authorize.js";

// Stripe webhook
router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  handleWebhook
);

// PayOS webhook
router.post("/payos/webhook", express.json(), handlePayOSWebhook);

// Các route cần đăng nhập
router.use(authenticate);

router.post("/create-payment-intent", createPaymentIntent);
router.post("/confirm-payment", confirmPayment);
router.post("/create-customer", createCustomer);
router.get("/payment-methods", getPaymentMethods);
router.post("/create-setup-intent", createSetupIntent);
router.post("/refund", authorize("admin","manager"), createRefund);

// Tạo link PayOS
router.post("/payos/create-link", createPayOSPaymentLink);

export default router;
