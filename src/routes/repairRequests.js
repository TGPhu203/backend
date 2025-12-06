// routes/repairRequests.js
import express from "express";
import {
  createRepairRequest,
  getAllRepairRequests,
  getRepairRequestById,
  updateRepairRequestStatus,
  getMyRepairRequests,
} from "../controllers/repairRequestController.js";
import { adminAuthenticate } from "../middlewares/adminAuth.js";
import { authenticate } from "../middlewares/authenticate.js";

const router = express.Router();

/* USER: khách đã login gửi yêu cầu => luôn có req.user.id */
router.post("/", authenticate, createRepairRequest);

/* USER: lịch sử của chính mình */
router.get("/my", authenticate, getMyRepairRequests);

/* ADMIN */
router.get("/", adminAuthenticate, getAllRepairRequests);
router.get("/:id", adminAuthenticate, getRepairRequestById);
router.put("/:id/status", adminAuthenticate, updateRepairRequestStatus);

export default router;
