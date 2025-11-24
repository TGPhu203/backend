import mongoose from 'mongoose';

const productAttributeGroupSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: [true, 'Product ID is required'],
      index: true,
    },
    attributeGroupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AttributeGroup',
      required: [true, 'Attribute group ID is required'],
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

// Unique index – không cho 1 product có trùng attributeGroup
productAttributeGroupSchema.index(
  { productId: 1, attributeGroupId: 1 },
  { unique: true }
);

// Hỗ trợ query phổ biến: tìm theo attributeGroup
productAttributeGroupSchema.index({ attributeGroupId: 1 });

// Hỗ trợ sorting & UI hiển thị theo displayOrder
productAttributeGroupSchema.index({ productId: 1, displayOrder: 1 });

const ProductAttributeGroup = mongoose.model('ProductAttributeGroup', productAttributeGroupSchema);

export default ProductAttributeGroup;
