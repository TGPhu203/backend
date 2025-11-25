import express from "express";
import {
  createRepairRequest,
  getAllRepairRequests,
  getRepairRequestById,
  updateRepairRequestStatus,
} from "../controllers/repairRequestController.js";
import { adminAuthenticate } from "../middlewares/adminAuth.js";

const router = express.Router();

/* PUBLIC: khách gửi yêu cầu */
router.post("/", createRepairRequest);

/* ADMIN: xem danh sách / chi tiết / cập nhật */
router.get("/", adminAuthenticate, getAllRepairRequests);
router.get("/:id", adminAuthenticate, getRepairRequestById);
router.put("/:id/status", adminAuthenticate, updateRepairRequestStatus);

export default router;
