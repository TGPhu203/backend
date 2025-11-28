// models/coupon.js
import mongoose from "mongoose";

const couponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },

    // 'percent' = giảm theo %, 'fixed' = giảm số tiền cố định
    type: {
      type: String,
      enum: ["percent", "fixed"],
      required: true,
    },

    value: {
      type: Number,
      required: true,
      min: 0,
    },

    // điều kiện tối thiểu của đơn hàng
    minOrderAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    // giới hạn giảm tối đa (cho coupon %)
    maxDiscount: {
      type: Number,
      default: 0, // 0 = không giới hạn
      min: 0,
    },

    startDate: {
      type: Date,
      default: () => new Date(),
    },

    endDate: {
      type: Date,
    },

    usageLimit: {
      type: Number,
      default: 0, // 0 = không giới hạn
      min: 0,
    },

    usedCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    // áp dụng cho tier nào (nếu để rỗng = mọi khách hàng)
    applicableTiers: {
      type: [String],
      enum: ["none", "silver", "gold", "diamond"],
      default: [],
    },

    description: {
      type: String,
      trim: true,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

couponSchema.index({ code: 1 }, { unique: true });
couponSchema.index({ isActive: 1, startDate: 1, endDate: 1 });

const Coupon = mongoose.model("Coupon", couponSchema);
export default Coupon;
