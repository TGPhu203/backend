import mongoose from 'mongoose';

const reviewFeedbackSchema = new mongoose.Schema(
  {
    reviewId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Review',
      required: [true, 'Review ID is required'],
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    type: {
      type: String,
      enum: ['helpful', 'not-helpful'],
      required: [true, 'Feedback type is required'],
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
reviewFeedbackSchema.index({ reviewId: 1, userId: 1 }, { unique: true });
reviewFeedbackSchema.index({ type: 1 });

const ReviewFeedback = mongoose.model('ReviewFeedback', reviewFeedbackSchema);

export default ReviewFeedback;
