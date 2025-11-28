// models/attributeValue.model.js
import mongoose from 'mongoose';

const attributeValueSchema = new mongoose.Schema(
  {
    attributeGroupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AttributeGroup',
      required: [true, 'Attribute group ID is required'],
      index: true,
    },

    // Tên hiển thị cho admin / UI: "Đỏ", "256GB"
    name: {
      type: String,
      required: [true, 'Attribute name is required'],
      trim: true,
    },

    // Giá trị lưu trong DB / filter: "red", "256"
    value: {
      type: String,
      required: [true, 'Attribute value is required'],
      trim: true,
    },

    // Mã màu cho loại color
    colorCode: {
      type: String,
      trim: true,
    },

    // Ảnh icon (vd màu sắc)
    imageUrl: {
      type: String,
      trim: true,
    },

    // Điều chỉnh giá (vd +200.000 cho 512GB)
    priceAdjustment: {
      type: Number,
      default: 0,
    },

    // Có ảnh hưởng tới tên sản phẩm không
    affectsName: {
      type: Boolean,
      default: false,
    },

    // Template chèn vào tên (vd: "{baseName} - {value}")
    nameTemplate: {
      type: String,
      trim: true,
    },

    sortOrder: {
      type: Number,
      default: 0,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
attributeValueSchema.index({ attributeGroupId: 1 });
attributeValueSchema.index({ isActive: 1 });
attributeValueSchema.index({ sortOrder: 1 });

const AttributeValue = mongoose.model('AttributeValue', attributeValueSchema);

export default AttributeValue;
