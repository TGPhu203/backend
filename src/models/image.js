import mongoose from 'mongoose';

const imageSchema = new mongoose.Schema(
  {
    filename: {
      type: String,
      required: [true, 'Filename is required'],
    },
    originalName: {
      type: String,
      required: [true, 'Original name is required'],
    },
    mimeType: {
      type: String,
      required: [true, 'MIME type is required'],
    },
    size: {
      type: Number,
      required: [true, 'File size is required'],
      min: [0, 'File size cannot be negative'],
    },
    url: {
      type: String,
      required: [true, 'URL is required'],
    },
    thumbnailUrl: {
      type: String,
    },
    alt: {
      type: String,
      trim: true,
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    isPrimary: {
      type: Boolean,
      default: false,
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
imageSchema.index({ productId: 1, isPrimary: 1 });
imageSchema.index({ userId: 1 });
imageSchema.index({ displayOrder: 1 });

// Ensure only one primary image per product
imageSchema.pre('save', async function (next) {
  if (this.isPrimary && this.productId) {
    await mongoose.model('Image').updateMany(
      { productId: this.productId, _id: { $ne: this._id } },
      { isPrimary: false }
    );
  }
  next();
});

const Image = mongoose.model('Image', imageSchema);

export default Image;
