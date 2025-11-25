import mongoose from "mongoose";

const orderItemSchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: [true, "Order ID is required"],
      index: true,
    },

    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: [true, "Product ID is required"],
      index: true,
    },

    variantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProductVariant",
      index: true,
      default: null,
    },

    name: {
      type: String,
      required: [true, "Product name is required"],
    },

    image: {
      type: String,
      default: null,
    },

    variantName: {
      type: String,
      default: null,
    },

    sku: {
      type: String,
    },

    quantity: {
      type: Number,
      required: [true, "Quantity is required"],
      min: [1, "Quantity must be at least 1"],
    },

    price: {
      type: Number,
      required: [true, "Price is required"],
      min: [0, "Price cannot be negative"],
    },

    totalPrice: {
      type: Number,
      default: 0,
    },

    // ========= IMEI CHO TỪNG MÁY =========
    imei: {
      type: String,
      trim: true,
      unique: true,  // mỗi imei chỉ gắn với 1 máy
      sparse: true,
      index: true,
    },

    // ========= BẢO HÀNH THEO MÁY =========
    warrantyPackageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "WarrantyPackage",
      default: null,
      index: true,
    },

    warrantyStartAt: {
      type: Date,
    },

    warrantyEndAt: {
      type: Date,
    },

    warrantyStatus: {
      type: String,
      enum: ["active", "expired", "void"],
      default: "void",   // ❗ hợp lý hơn cho item không có gói BH
    },
    // =====================================
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
orderItemSchema.index({ orderId: 1 });
orderItemSchema.index({ productId: 1 });
orderItemSchema.index({ warrantyPackageId: 1 });
orderItemSchema.index({ warrantyStatus: 1 });
orderItemSchema.index({ imei: 1 }, { unique: true, sparse: true });

// Virtuals
orderItemSchema.virtual("product", {
  ref: "Product",
  localField: "productId",
  foreignField: "_id",
  justOne: true,
});

orderItemSchema.virtual("variant", {
  ref: "ProductVariant",
  localField: "variantId",
  foreignField: "_id",
  justOne: true,
});

orderItemSchema.virtual("warrantyPackage", {
  ref: "WarrantyPackage",
  localField: "warrantyPackageId",
  foreignField: "_id",
  justOne: true,
});

// Tính totalPrice
orderItemSchema.pre("save", function (next) {
  this.totalPrice = this.price * this.quantity;
  next();
});

const OrderItem = mongoose.model("OrderItem", orderItemSchema);

export default OrderItem;
