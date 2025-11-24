import mongoose from 'mongoose';

const productAttributeSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: [true, 'Product ID is required'],
      index: true,
    },

    attributeName: {
      type: String,
      required: [true, 'Attribute name is required'],
      trim: true,
      index: true,
    },

    attributeValue: {
      type: String,
      required: [true, 'Attribute value is required'],
      trim: true,
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

/* ------------------ INDEXES TỐI ƯU ------------------ */

// ⭐ Lấy thuộc tính theo sản phẩm
productAttributeSchema.index({ productId: 1, displayOrder: 1 });

// ⭐ Lọc sản phẩm theo tên thuộc tính
productAttributeSchema.index({ attributeName: 1, productId: 1 });

// ⭐ Lọc nâng cao: Color = Red, Size = M...
productAttributeSchema.index({ attributeName: 1, attributeValue: 1 });

// ⭐ Ngăn giá trị trùng lặp cho 1 sản phẩm
productAttributeSchema.index(
  { productId: 1, attributeName: 1, attributeValue: 1 },
  { unique: true }
);

// Sort theo thứ tự
productAttributeSchema.index({ displayOrder: 1 });

const ProductAttribute = mongoose.model('ProductAttribute', productAttributeSchema);

export default ProductAttribute;
