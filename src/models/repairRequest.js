import mongoose from "mongoose";

const { Schema } = mongoose;

const repairRequestSchema = new Schema(
  {
    // nếu có đăng nhập thì có thể lưu thêm userId (không bắt buộc)
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    customerName: {
      type: String,
      required: [true, "Vui lòng nhập họ tên"],
      trim: true,
    },

    phone: {
      type: String,
      required: [true, "Vui lòng nhập số điện thoại"],
      trim: true,
    },

    email: {
      type: String,
      trim: true,
    },

    productName: {
      type: String,
      required: [true, "Vui lòng nhập tên sản phẩm"],
      trim: true,
    },

    imei: {
      type: String,
      trim: true,
    },

    issueDescription: {
      type: String,
      required: [true, "Vui lòng mô tả vấn đề"],
      trim: true,
    },

    preferredTime: {
      type: String, // hoặc Date nếu bạn muốn dùng Date thật
      default: null,
    },

    status: {
      type: String,
      enum: ["new", "in_progress", "completed", "cancelled"],
      default: "new",
      index: true,
    },

    adminNotes: {
      type: String,
      default: "",
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

repairRequestSchema.index({ createdAt: -1 });

const RepairRequest = mongoose.model("RepairRequest", repairRequestSchema);

export default RepairRequest;
