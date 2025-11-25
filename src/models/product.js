// src/models/product.js
import mongoose from 'mongoose';
import slugify from 'slugify';
import keywordGeneratorService from '../services/keywordGenerator.service.js';

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      text: true,
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
    },
    description: {
      type: String,
      required: true,
      text: true,
    },
    shortDescription: {
      type: String,
      required: true,
      text: true,
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
    images: {
      type: [String],
      default: [],
    },
    thumbnail: String,

    inStock: {
      type: Boolean,
      default: true,
    },
    stockQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },

    sku: {
      type: String,
      unique: true,
      sparse: true,
    },

    status: {
      type: String,
      enum: ['active', 'inactive', 'draft'],
      default: 'active',
    },

    featured: {
      type: Boolean,
      default: false,
    },

    searchKeywords: {
      type: [String],
      default: [],
    },

    seoTitle: String,
    seoDescription: String,
    seoKeywords: [String],

    specifications: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    condition: {
      type: String,
      enum: ['new', 'like-new', 'used', 'refurbished'],
      default: 'new',
    },

    baseName: String,
    isVariantProduct: {
      type: Boolean,
      default: false,
    },

    categories: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
      },
    ],

    attributeGroups: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'AttributeGroup',
      },
    ],

    // KHÔNG còn mảng warrantyPackages ở đây
  },

  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

/* INDEXES */
productSchema.index({ slug: 1 }, { unique: true });
productSchema.index({ sku: 1 }, { sparse: true });

productSchema.index({ price: 1 });
productSchema.index({ createdAt: -1 });
productSchema.index({ featured: 1, createdAt: -1 });

productSchema.index({ categories: 1, status: 1 });
productSchema.index({ inStock: 1, status: 1 });

productSchema.index({ status: 1, featured: 1 });

productSchema.index({
  name: 'text',
  description: 'text',
  shortDescription: 'text'
});

productSchema.index({ searchKeywords: 1 });
productSchema.index({ isVariantProduct: 1 });

/* VIRTUALS */
productSchema.virtual('variants', {
  ref: 'ProductVariant',
  localField: '_id',
  foreignField: 'productId',
});

productSchema.virtual('attributes', {
  ref: 'ProductAttribute',
  localField: '_id',
  foreignField: 'productId',
});

productSchema.virtual('reviews', {
  ref: 'Review',
  localField: '_id',
  foreignField: 'productId',
});

productSchema.virtual('productSpecifications', {
  ref: 'ProductSpecification',
  localField: '_id',
  foreignField: 'productId',
});

productSchema.virtual('defaultVariant', {
  ref: 'ProductVariant',
  localField: '_id',
  foreignField: 'productId',
  justOne: true,
  match: { isDefault: true },
});

/* GENERATE SLUG */
productSchema.pre('validate', function (next) {
  if (this.name && (!this.slug || this.isModified('name'))) {
    const random = Math.random().toString(36).substring(2, 8);
    this.slug =
      slugify(this.name, { lower: true, strict: true }) + '-' + random;
  }
  next();
});

/* GENERATE SEARCH KEYWORDS */
productSchema.pre('save', function (next) {
  if (
    this.isNew ||
    this.isModified('name') ||
    this.isModified('description') ||
    this.isModified('shortDescription')
  ) {
    this.searchKeywords = keywordGeneratorService.generateKeywords({
      name: this.name,
      shortDescription: this.shortDescription,
      description: this.description,
      category: Array.isArray(this.categories)
        ? this.categories.join(' ')
        : '',
    });
  }
  next();
});

const Product = mongoose.model('Product', productSchema);

export default Product;
