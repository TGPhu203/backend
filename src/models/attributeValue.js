import mongoose from 'mongoose';

const attributeValueSchema = new mongoose.Schema(
  {
    attributeGroupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AttributeGroup',
      required: [true, 'Attribute group ID is required'],
      index: true,
    },
    value: {
      type: String,
      required: [true, 'Attribute value is required'],
      trim: true,
    },
    displayOrder: {
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

const AttributeValue = mongoose.model('AttributeValue', attributeValueSchema);

export default AttributeValue;
