// controllers/review.controller.js
import { Review, Product, User, Order, OrderItem, ReviewFeedback } from '../models/index.js';
import { AppError } from '../middlewares/errorHandler.js';

// ✅ Create review
export const createReview = async (req, res, next) => {
  try {
    const { productId, rating, title, comment, images } = req.body;
    const userId = req.user.id;

    // Check if product exists
    const product = await Product.findById(productId);
    if (!product) throw new AppError('Sản phẩm không tồn tại', 404);

    // Check if user has purchased the product
    const hasPurchased = await Order.findOne({
      userId,
      status: 'delivered',
      'items.productId': productId
    });

    if (!hasPurchased) throw new AppError('Bạn cần mua sản phẩm trước khi đánh giá', 403);

    // Check if already reviewed
    const existingReview = await Review.findOne({ userId, productId });
    if (existingReview) throw new AppError('Bạn đã đánh giá sản phẩm này rồi', 400);

    // Create review
    const review = new Review({
      productId,
      userId,
      rating,
      title,
      content: comment,
      images: images || [],
      isVerified: true, // Auto-verify since purchase verified
    });

    await review.save();

    // Fetch review with user info
    const createdReview = await Review.findById(review._id)
      .populate('userId', 'firstName lastName avatar');

    // Update product rating using aggregation
    const reviewStats = await Review.aggregate([
      { $match: { productId } },
      {
        $group: {
          _id: null,
          avgRating: { $avg: '$rating' },
          count: { $sum: 1 }
        }
      }
    ]);

    if (reviewStats.length > 0) {
      await Product.findByIdAndUpdate(productId, {
        rating: reviewStats[0].avgRating,
        reviewCount: reviewStats[0].count
      });
    }

    res.status(201).json({ status: 'success', data: createdReview });
  } catch (error) {
    next(error);
  }
};

// ✅ Update review
export const updateReview = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { rating, title, comment, images } = req.body;
    const userId = req.user.id;

    const review = await Review.findOne({ _id: id, userId });
    if (!review) throw new AppError('Không tìm thấy đánh giá', 404);

    if (rating !== undefined) review.rating = rating;
    if (title !== undefined) review.title = title;
    if (comment !== undefined) review.content = comment;
    if (images !== undefined) review.images = images;
    review.isVerified = true;

    await review.save();

    const updatedReview = await Review.findById(review._id)
      .populate('userId', 'firstName lastName avatar');

    // Update product rating using aggregation
    const reviewStats = await Review.aggregate([
      { $match: { productId: review.productId } },
      {
        $group: {
          _id: null,
          avgRating: { $avg: '$rating' },
          count: { $sum: 1 }
        }
      }
    ]);

    if (reviewStats.length > 0) {
      await Product.findByIdAndUpdate(review.productId, {
        rating: reviewStats[0].avgRating,
        reviewCount: reviewStats[0].count
      });
    }

    res.status(200).json({ status: 'success', data: updatedReview });
  } catch (error) {
    next(error);
  }
};

// ✅ Delete review
export const deleteReview = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const review = await Review.findOne({ _id: id, userId });
    if (!review) throw new AppError('Không tìm thấy đánh giá', 404);

    const productId = review.productId;
    await review.deleteOne();

    // Update product rating using aggregation
    const reviewStats = await Review.aggregate([
      { $match: { productId } },
      {
        $group: {
          _id: null,
          avgRating: { $avg: '$rating' },
          count: { $sum: 1 }
        }
      }
    ]);

    if (reviewStats.length > 0) {
      await Product.findByIdAndUpdate(productId, {
        rating: reviewStats[0].avgRating,
        reviewCount: reviewStats[0].count
      });
    } else {
      await Product.findByIdAndUpdate(productId, {
        rating: 0,
        reviewCount: 0
      });
    }

    res.status(200).json({ status: 'success', message: 'Xóa đánh giá thành công' });
  } catch (error) {
    next(error);
  }
};

// ✅ Get product reviews
export const getProductReviews = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const { page = 1, limit = 10, sort = 'newest', rating, verified } = req.query;

    const sortMapping = {
      newest: { createdAt: -1 },
      oldest: { createdAt: 1 },
      highest_rating: { rating: -1 },
      lowest_rating: { rating: 1 },
      most_helpful: { likes: -1 },
    };

    const sortOptions = sortMapping[sort] || { createdAt: -1 };

    const product = await Product.findById(productId);
    if (!product) throw new AppError('Sản phẩm không tồn tại', 404);

    const query = { productId };
    if (rating) query.rating = parseInt(rating);
    if (verified !== undefined) query.isVerified = verified === 'true';

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const reviews = await Review.find(query)
      .populate('userId', 'firstName lastName avatar')
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Review.countDocuments(query);

    res.status(200).json({
      status: 'success',
      data: {
        total,
        pages: Math.ceil(total / limit),
        currentPage: parseInt(page),
        reviews,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ✅ Get user reviews
export const getUserReviews = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 10 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const reviews = await Review.find({ userId })
      .populate('productId', 'name slug thumbnail')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Review.countDocuments({ userId });

    res.status(200).json({
      status: 'success',
      data: {
        total,
        pages: Math.ceil(total / limit),
        currentPage: parseInt(page),
        reviews,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ✅ Admin: Get all reviews
export const getAllReviews = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, verified } = req.query;

    const query = {};
    if (verified !== undefined) query.isVerified = verified === 'true';

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const reviews = await Review.find(query)
      .populate('userId', 'firstName lastName email')
      .populate('productId', 'name slug')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Review.countDocuments(query);

    res.status(200).json({
      status: 'success',
      data: {
        total,
        pages: Math.ceil(total / limit),
        currentPage: parseInt(page),
        reviews,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ✅ Admin: Verify review
export const verifyReview = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { isVerified } = req.body;

    const review = await Review.findById(id);
    if (!review) throw new AppError('Không tìm thấy đánh giá', 404);

    review.isVerified = isVerified;
    await review.save();

    res.status(200).json({
      status: 'success',
      message: isVerified
        ? 'Đánh giá đã được xác nhận'
        : 'Đánh giá đã bị từ chối',
      data: { id: review._id, isVerified },
    });
  } catch (error) {
    next(error);
  }
};

// ✅ Mark review helpful
export const markReviewHelpful = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { helpful } = req.body;
    const userId = req.user.id;

    const review = await Review.findById(id);
    if (!review) throw new AppError('Không tìm thấy đánh giá', 404);
    if (review.userId.toString() === userId)
      throw new AppError('Bạn không thể đánh giá đánh giá của chính mình', 400);

    const reviewFeedback = await ReviewFeedback.findOne({ reviewId: id, userId });

    if (reviewFeedback) {
      if (reviewFeedback.isHelpful !== helpful) {
        if (helpful) {
          review.likes += 1;
          review.dislikes -= 1;
        } else {
          review.likes -= 1;
          review.dislikes += 1;
        }
        reviewFeedback.isHelpful = helpful;
        await reviewFeedback.save();
        await review.save();
      }
    } else {
      const newFeedback = new ReviewFeedback({
        reviewId: id,
        userId,
        isHelpful: helpful
      });
      await newFeedback.save();

      if (helpful) {
        review.likes += 1;
      } else {
        review.dislikes += 1;
      }
      await review.save();
    }

    res.status(200).json({
      status: 'success',
      message: helpful
        ? 'Đã đánh dấu đánh giá là hữu ích'
        : 'Đã đánh dấu đánh giá là không hữu ích',
      data: {
        id: review._id,
        likes: review.likes,
        dislikes: review.dislikes,
      },
    });
  } catch (error) {
    next(error);
  }
};
