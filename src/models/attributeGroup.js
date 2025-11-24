import mongoose from 'mongoose';

const attributeGroupSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Attribute group name is required'],
      trim: true,
    },
    description: {
      type: String,
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
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
attributeGroupSchema.index({ isActive: 1 });
attributeGroupSchema.index({ displayOrder: 1 });

// Virtual for values
attributeGroupSchema.virtual('values', {
  ref: 'AttributeValue',
  localField: '_id',
  foreignField: 'attributeGroupId',
});

const AttributeGroup = mongoose.model('AttributeGroup', attributeGroupSchema);

export default AttributeGroup;
