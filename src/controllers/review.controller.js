// controllers/review.controller.js
import mongoose from "mongoose";
import { Review, Product, User, Order, OrderItem, ReviewFeedback } from '../models/index.js';
import { AppError } from '../middlewares/errorHandler.js';

export const createReview = async (req, res, next) => {
  try {
    const { productId, rating, title, comment, images } = req.body;
    const userId = req.user.id;

    // 1. Check product tồn tại
    const product = await Product.findById(productId);
    if (!product) throw new AppError("Sản phẩm không tồn tại", 404);

    // 2. Check user đã mua và HOÀN THÀNH đơn chứa sản phẩm này chưa
    //    (giống logic getPurchasedProductsForReview)
    const completedOrders = await Order.find({
      userId,
      status: "completed",          // chỉ đơn đã hoàn thành
    }).select("_id");

    if (!completedOrders.length) {
      throw new AppError(
        "Bạn cần mua và hoàn thành đơn hàng của sản phẩm này trước khi đánh giá",
        403
      );
    }

    const orderIds = completedOrders.map((o) => o._id);

    const purchasedItem = await OrderItem.findOne({
      orderId: { $in: orderIds },
      productId,
    });

    if (!purchasedItem) {
      throw new AppError(
        "Bạn cần mua và hoàn thành đơn hàng của sản phẩm này trước khi đánh giá",
        403
      );
    }

    // 3. Check đã đánh giá chưa
    const existingReview = await Review.findOne({ userId, productId });
    if (existingReview)
      throw new AppError("Bạn đã đánh giá sản phẩm này rồi", 400);

    // 4. Tạo review
    let media = [];
    if (Array.isArray(images)) {
      media = images.filter((u) => typeof u === "string" && u.trim() !== "");
    } else if (typeof images === "string" && images.trim() !== "") {
      media = [images.trim()];
    }

    const review = new Review({
      productId,
      userId,
      rating,
      title,
      content: comment,
      images: media,   // <-- dùng mảng URL (ảnh + video)
      isVerified: true,
    });

    await review.save();

    const createdReview = await Review.findById(review._id).populate(
      "userId",
      "firstName lastName avatar"
    );

    // 5. Cập nhật rating trung bình cho product
    const reviewStats = await Review.aggregate([
      { $match: { productId } },
      {
        $group: {
          _id: null,
          avgRating: { $avg: "$rating" },
          count: { $sum: 1 },
        },
      },
    ]);

    if (reviewStats.length > 0) {
      await Product.findByIdAndUpdate(productId, {
        rating: reviewStats[0].avgRating,
        reviewCount: reviewStats[0].count,
      });
    }

    res.status(201).json({ status: "success", data: createdReview });
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
    if (!review) throw new AppError("Không tìm thấy đánh giá", 404);

    if (rating !== undefined) review.rating = rating;
    if (title !== undefined) review.title = title;
    if (comment !== undefined) review.content = comment;

    // ❗ Chuẩn hóa media khi update
    if (images !== undefined) {
      if (Array.isArray(images)) {
        review.images = images.filter(
          (u) => typeof u === "string" && u.trim() !== ""
        );
      } else if (typeof images === "string" && images.trim() !== "") {
        review.images = [images.trim()];
      } else {
        review.images = [];
      }
    }

    review.isVerified = true;

    await review.save();

    const updatedReview = await Review.findById(review._id).populate(
      "userId",
      "firstName lastName avatar"
    );

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

    // ---- THỐNG KÊ TOÀN BỘ REVIEW (KHÔNG ÁP DỤNG FILTER) ----
    const statsAgg = await Review.aggregate([
      { $match: { productId: product._id } },
      {
        $group: {
          _id: "$rating",
          count: { $sum: 1 },
        },
      },
    ]);

    const ratingCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let totalReviews = 0;
    let sumRating = 0;

    for (const s of statsAgg) {
      const r = s._id;
      if (ratingCounts[r] !== undefined) {
        ratingCounts[r] = s.count;
        totalReviews += s.count;
        sumRating += r * s.count;
      }
    }

    const averageRating = totalReviews > 0 ? sumRating / totalReviews : 0;

    // ---- QUERY LIST REVIEW (CÓ ÁP DỤNG FILTER) ----
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
        averageRating,
        ratingCounts,
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
// ✅ Lấy danh sách sản phẩm user đã mua (đơn đã hoàn thành) để đánh giá
export const getPurchasedProductsForReview = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // 1. Lấy các đơn hàng COMPLETED kèm subtotal, discount, total
    const completedOrders = await Order.find({
      userId,
      status: "completed",
    })
      .select("_id subtotal discountAmount totalAmount")
      .lean();

    if (!completedOrders.length) {
      return res.status(200).json({
        status: "success",
        data: [],
      });
    }

    const orderIds = completedOrders.map((o) => o._id);

    // Map orderId -> info (để tính tỉ lệ giảm)
    const orderMap = new Map(
      completedOrders.map((o) => {
        const subtotal = Number(o.subtotal ?? 0);
        // nếu totalAmount null thì tự tính từ subtotal - discount
        const totalAmount = Number(
          o.totalAmount ??
            (o.subtotal != null && o.discountAmount != null
              ? o.subtotal - o.discountAmount
              : o.subtotal ?? 0)
        );
        return [
          String(o._id),
          {
            subtotal,
            totalAmount,
          },
        ];
      })
    );

    // 2. Lấy các OrderItem của những đơn đó
    const items = await OrderItem.find({
      orderId: { $in: orderIds },
    })
      .populate("productId", "name slug thumbnail images price")
      .lean();

    if (!items.length) {
      return res.status(200).json({
        status: "success",
        data: [],
      });
    }

    // 3. Gom theo sản phẩm, đồng thời tính giá đã trả (paidPrice)
    const productMap = new Map(); // key = productId

    for (const item of items) {
      const p = item.productId;
      if (!p) continue;

      const orderInfo = orderMap.get(String(item.orderId));
      const subtotal = orderInfo?.subtotal ?? 0;
      const totalAmount = orderInfo?.totalAmount ?? subtotal;

      // tỉ lệ giảm của cả đơn, ví dụ: 4500 / 5000 = 0.9
      let ratio = 1;
      if (subtotal > 0 && totalAmount > 0) {
        ratio = totalAmount / subtotal;
      }

      // giá gốc 1 sản phẩm trong đơn
      const originalPrice = Number(item.price ?? p.price ?? 0);
      // giá đã trả sau giảm
      const paidPrice = Math.round(originalPrice * ratio);

      const idStr = String(p._id);
      const existing = productMap.get(idStr);

      if (!existing) {
        productMap.set(idStr, {
          _id: p._id,
          name: p.name,
          slug: p.slug,
          price: originalPrice, // giá gốc
          paidPrice,            // 👈 giá đã giảm
          thumbnail:
            p.thumbnail ||
            (Array.isArray(p.images) && p.images[0]) ||
            null,
        });
      } else {
        // nếu 1 sản phẩm xuất hiện ở nhiều đơn, có thể chọn giá thấp nhất
        if (paidPrice < existing.paidPrice) {
          existing.paidPrice = paidPrice;
        }
      }
    }

    const productIds = Array.from(productMap.keys());

    // 4. Sản phẩm nào user đã review?
    const userReviews = await Review.find({
      userId,
      productId: { $in: productIds },
    }).select("productId");

    const reviewedSet = new Set(
      userReviews.map((r) => r.productId.toString())
    );

    const purchasedProducts = Array.from(productMap.values()).map((p) => ({
      ...p,
      hasReviewed: reviewedSet.has(p._id.toString()),
    }));

    return res.status(200).json({
      status: "success",
      data: purchasedProducts,
    });
  } catch (error) {
    next(error);
  }
};

