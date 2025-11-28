// models/productAttribute.model.js
import mongoose from 'mongoose';

const productAttributeSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: [true, 'Product ID is required'],
      index: true,
    },

    // Tên thuộc tính: "Thương hiệu", "Bảo hành", "CPU"...
    attributeName: {
      type: String,
      required: [true, 'Attribute name is required'],
      trim: true,
      index: true,
    },

    // Giá trị: "Lenovo", "24 tháng", "Intel Core i5-13420H"...
    attributeValue: {
      type: String,
      required: [true, 'Attribute value is required'],
      trim: true,
      index: true,
    },

    // Nhóm hiển thị
    section: {
      type: String,
      enum: ['general', 'detail'], // bạn có thể mở rộng
      default: 'general',
      index: true,
    },

    displayOrder: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

productAttributeSchema.index({ productId: 1, section: 1, displayOrder: 1 });
productAttributeSchema.index({ attributeName: 1, productId: 1 });
productAttributeSchema.index({ attributeName: 1, attributeValue: 1 });
productAttributeSchema.index(
  { productId: 1, attributeName: 1, attributeValue: 1 },
  { unique: true }
);

const ProductAttribute = mongoose.model(
  'ProductAttribute',
  productAttributeSchema
);

export default ProductAttribute;
