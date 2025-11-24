import mongoose from 'mongoose';

const productCategorySchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: [true, 'Product ID is required'],
      index: true,
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: [true, 'Category ID is required'],
      index: true,
    },
    isPrimary: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

/* -------------------- INDEXES -------------------- */

// Unique index (product + category)
productCategorySchema.index(
  { productId: 1, categoryId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      productId: { $exists: true },
      categoryId: { $exists: true },
    },
  }
);

// Index theo product
productCategorySchema.index({ productId: 1 });

// Index theo category
productCategorySchema.index({ categoryId: 1 });

/* -------- Ensure only one primary category per product -------- */
productCategorySchema.pre('save', async function(next) {
  if (this.isPrimary) {
    await mongoose.model('ProductCategory').updateMany(
      { productId: this.productId, _id: { $ne: this._id } },
      { $set: { isPrimary: false } },
      { multi: true }
    );
  }
  next();
});

const ProductCategory = mongoose.model('ProductCategory', productCategorySchema);

export default ProductCategory;
