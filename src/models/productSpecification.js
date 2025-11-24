import mongoose from 'mongoose';

const productSpecificationSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: [true, 'Product ID is required'],
      index: true,
    },
    specName: {
      type: String,
      required: [true, 'Specification name is required'],
      trim: true,
    },
    specValue: {
      type: String,
      required: [true, 'Specification value is required'],
      trim: true,
    },
    specGroup: {
      type: String,
      trim: true,
      default: 'General',
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

/* ------------------------ INDEXES ------------------------ */

// Query nhanh theo product
productSpecificationSchema.index({ productId: 1 });

// Query theo nhóm thông số trong 1 sản phẩm
productSpecificationSchema.index({ productId: 1, specGroup: 1 });

// Sort nhanh trong bảng thông số
productSpecificationSchema.index({ productId: 1, displayOrder: 1 });

// Ngăn trùng tên thông số trong cùng một sản phẩm
productSpecificationSchema.index(
  { productId: 1, specName: 1 },
  {
    unique: true,
    partialFilterExpression: {
      productId: { $exists: true },
      specName: { $exists: true },
    },
  }
);

// Index theo group toàn cục (tối ưu admin filter)
productSpecificationSchema.index({ specGroup: 1 });

const ProductSpecification = mongoose.model(
  'ProductSpecification',
  productSpecificationSchema
);

export default ProductSpecification;
