import mongoose from 'mongoose';

/* ------------------ SCHEMA ------------------ */
const productVariantSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },

    variantName: {
      type: String,
      required: true,
      trim: true,
    },

    sku: {
      type: String,
      unique: true,
      sparse: true,
    },

    price: {
      type: Number,
      required: true,
      min: 0,
    },

    compareAtPrice: {
      type: Number,
      min: 0,
    },

    stockQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },

    isDefault: {
      type: Boolean,
      default: false,
    },

    isAvailable: {
      type: Boolean,
      default: true,
    },

    images: {
      type: [String],
      default: [],
    },

    specifications: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    attributes: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    weight: {
      type: Number,
      min: 0,
    },

    dimensions: {
      length: Number,
      width: Number,
      height: Number,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

/* ------------------ INDEXES ------------------ */

// Query theo product & default
productVariantSchema.index({ productId: 1, isDefault: 1 });

// Query theo product & availability
productVariantSchema.index({ productId: 1, isAvailable: 1 });

// Price filtering
productVariantSchema.index({ productId: 1, price: 1 });

// SKU unique
productVariantSchema.index({ sku: 1 }, { unique: true, sparse: true });

// Sort nhanh
productVariantSchema.index({ createdAt: -1 });

/* ------------------ VIRTUALS ------------------ */
productVariantSchema.virtual('fullName').get(function () {
  return `${this.variantName}`;
});

/* ------------------ PRE-SAVE ------------------ */
productVariantSchema.pre('save', async function (next) {
  // 1) Generate SKU if missing
  if (!this.sku) {
    const Product = mongoose.model('Product');
    const product = await Product.findById(this.productId).select('sku name');

    const base = slugifyBase(product?.sku || product?.name || 'PRD');
    const random = Math.random().toString(36).substring(2, 7).toUpperCase();

    this.sku = `${base}-${random}`;
  }

  // 2) Enforce single default variant
  if (this.isDefault) {
    await mongoose
      .model('ProductVariant')
      .updateMany(
        { productId: this.productId, _id: { $ne: this._id } },
        { $set: { isDefault: false } }
      );
  }

  next();
});

/* ------------------ HELPERS ------------------ */
function slugifyBase(text = '') {
  return text
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .substring(0, 10); // limit length for clean SKU
}

/* ------------------ EXPORT ------------------ */
const ProductVariant = mongoose.model('ProductVariant', productVariantSchema);
export default ProductVariant;
