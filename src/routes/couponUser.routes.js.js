// routes/couponUser.routes.js
import express from "express";
const router = express.Router();

import { authenticate } from "../middlewares/authenticate.js";
import { applyCoupon,getAvailableCoupons } from "../controllers/coupon.controller.js";

router.post("/apply", authenticate, applyCoupon);
router.get("/available", getAvailableCoupons);

export default router;
