import mongoose from 'mongoose';

const warrantyPackageSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Warranty package name is required'],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    durationMonths: {
      type: Number,
      required: [true, 'Duration in months is required'],
      min: [1, 'Duration must be at least 1 month'],
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price cannot be negative'],
    },
    coverage: {
      type: [String],
      default: [],
    },
    isActive: {
      type: Boolean,
      default: true,
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

// Indexes
warrantyPackageSchema.index({ isActive: 1 });
warrantyPackageSchema.index({ displayOrder: 1 });

const WarrantyPackage = mongoose.model('WarrantyPackage', warrantyPackageSchema);

export default WarrantyPackage;
