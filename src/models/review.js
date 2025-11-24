import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: [true, 'Product ID is required'],
      index: true,
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },

    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },

    title: {
      type: String,
      trim: true,
    },

    comment: {
      type: String,
      trim: true,
    },

    images: {
      type: [String],
      default: [],
    },

    isVerified: {
      type: Boolean,
      default: false,
    },

    isApproved: {
      type: Boolean,
      default: true,
    },

    helpful: {
      type: Number,
      default: 0,
    },

    notHelpful: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

/* -------------------------- INDEXES -------------------------- */

// ⭐ Truy vấn chính trên trang sản phẩm
reviewSchema.index(
  { productId: 1, isApproved: 1, createdAt: -1 },
  { name: 'product_review_sort' }
);

// Filter theo rating
reviewSchema.index({ productId: 1, rating: 1 });

// Sort review hữu ích nhất
reviewSchema.index({ helpful: -1 });

// Lấy review theo user
reviewSchema.index({ userId: 1 });

// Ngăn user review 2 lần cùng sản phẩm
reviewSchema.index({ productId: 1, userId: 1 }, { unique: true });

// Optional: Search trong review
reviewSchema.index({ title: 'text', comment: 'text' });

/* -------------------------- VIRTUALS -------------------------- */

// Populate user
reviewSchema.virtual('user', {
  ref: 'User',
  localField: 'userId',
  foreignField: '_id',
  justOne: true,
  select: 'id firstName lastName avatar',
});

// Populate feedbacks
reviewSchema.virtual('feedbacks', {
  ref: 'ReviewFeedback',
  localField: '_id',
  foreignField: 'reviewId',
});

const Review = mongoose.model('Review', reviewSchema);
export default Review;
