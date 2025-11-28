// models/loyaltyConfig.js
import mongoose from "mongoose";

const loyaltyConfigSchema = new mongoose.Schema(
  {
    tier: {
      type: String,
      enum: ["silver", "gold", "diamond"],
      unique: true,
      required: true,
    },
    minTotalSpent: {
      type: Number,
      required: true,
      default: 0,
    },
    discountPercent: {
      type: Number,
      required: true,
      default: 0, // 0–100
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    note: String,
  },
  { timestamps: true }
);

export const LoyaltyConfig = mongoose.model(
  "LoyaltyConfig",
  loyaltyConfigSchema
);
