// src/models/productWarranty.js
import mongoose from 'mongoose';

const productWarrantySchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: [true, 'Product ID is required'],
      index: true,
    },
    warrantyPackageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'WarrantyPackage',
      required: [true, 'Warranty package ID is required'],
      index: true,
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
    price: {
      type: Number,
      min: [0, 'Price cannot be negative'],
      default: 0,
    },
    // optional metadata (keeps flexibility)
    meta: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

/* INDEXES */
productWarrantySchema.index(
  { productId: 1, warrantyPackageId: 1 },
  { unique: true }
);
productWarrantySchema.index({ warrantyPackageId: 1 });
productWarrantySchema.index({ productId: 1, isDefault: 1 });

/* PRE-VALIDATE: ensure referenced WarrantyPackage exists */
productWarrantySchema.pre('validate', async function (next) {
  try {
    const WarrantyPackage = mongoose.model('WarrantyPackage');
    if (!this.warrantyPackageId) return next();

    const exists = await WarrantyPackage.exists({ _id: this.warrantyPackageId });
    if (!exists) {
      const err = new Error('Referenced WarrantyPackage does not exist');
      err.name = 'ValidationError';
      return next(err);
    }
    return next();
  } catch (err) {
    return next(err);
  }
});

/* PRE-SAVE: If isDefault === true, atomically unset isDefault for others */
productWarrantySchema.pre('save', async function (next) {
  try {
    // If this doc is marked as default, unset others atomically
    if (this.isDefault) {
      await mongoose.model('ProductWarranty').updateMany(
        { productId: this.productId, _id: { $ne: this._id } },
        { $set: { isDefault: false } }
      );
    }
    return next();
  } catch (err) {
    return next(err);
  }
});

/* POST-REMOVE: if removed a default warranty, optionally pick another to be default (best-effort) */
productWarrantySchema.post('remove', async function (doc) {
  try {
    if (doc.isDefault) {
      // try to promote one existing warranty for this product to default
      const other = await mongoose
        .model('ProductWarranty')
        .findOne({ productId: doc.productId })
        .sort({ createdAt: 1 })
        .exec();

      if (other) {
        other.isDefault = true;
        await other.save();
      }
    }
  } catch (err) {
    // non-fatal: log or ignore
    // console.error('Error promoting fallback warranty:', err);
  }
});

/* STATIC helper: explicitly set a warranty as default for a product (atomic) */
productWarrantySchema.statics.setDefaultForProduct = async function (productId, warrantyId) {
  const Model = this;
  // unset all then set the chosen one in two steps (atomic enough because updateMany + updateOne)
  await Model.updateMany({ productId }, { $set: { isDefault: false } });
  const res = await Model.findByIdAndUpdate(
    warrantyId,
    { $set: { isDefault: true } },
    { new: true }
  );
  return res;
};

const ProductWarranty = mongoose.model('ProductWarranty', productWarrantySchema);

export default ProductWarranty;
