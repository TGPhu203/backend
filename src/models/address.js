import mongoose from "mongoose";

const addressSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
      index: true,
    },

    // ====== THÔNG TIN NGƯỜI NHẬN ======
    fullName: {
      type: String,
      required: [true, "Full name is required"],
      trim: true,
    },
    phone: {
      type: String,
      required: [true, "Phone number is required"],
      trim: true,
    },

    // ====== FIELD THEO FORM VIỆT NAM ======
    street: {
      // Địa chỉ (số nhà, tên đường)
      type: String,
      required: [true, "Địa chỉ (số nhà, tên đường) là bắt buộc"],
      trim: true,
    },
    ward: {
      type: String,
      trim: true,
    },
    district: {
      type: String,
      trim: true,
    },
    province: {
      type: String,
      required: [true, "Tỉnh/Thành phố là bắt buộc"],
      trim: true,
    },

    // ====== FIELD CŨ GIỮ LẠI ĐỂ TƯƠNG THÍCH (KHÔNG REQUIRED) ======
    addressLine1: {
      type: String,
      trim: true,
    },
    addressLine2: {
      type: String,
      trim: true,
    },
    city: {
      type: String,
      trim: true,
    },
    state: {
      type: String,
      trim: true,
    },
    postalCode: {
      type: String,
      trim: true,
    },
    country: {
      type: String,
      default: "Vietnam",
      trim: true,
    },

    isDefault: {
      type: Boolean,
      default: false,
    },
    addressType: {
      type: String,
      enum: ["home", "office", "other"],
      default: "home",
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
addressSchema.index({ userId: 1, isDefault: 1 });
addressSchema.index({ userId: 1, createdAt: -1 });

// Ensure only one default address per user + auto map field
addressSchema.pre("save", async function (next) {
  // map sang field cũ nếu chưa có
  if (!this.addressLine1 && this.street) {
    this.addressLine1 = this.street;
  }

  if (!this.state && this.province) {
    this.state = this.province;
  }

  if (!this.city && (this.district || this.province)) {
    const parts = [this.district, this.province].filter(Boolean);
    this.city = parts.join(", ");
  }

  if (!this.country) {
    this.country = "Vietnam";
  }

  // chỉ một địa chỉ mặc định / user
  if (this.isDefault) {
    await mongoose.model("Address").updateMany(
      { userId: this.userId, _id: { $ne: this._id } },
      { isDefault: false }
    );
  }

  next();
});

const Address = mongoose.model("Address", addressSchema);

export default Address;
