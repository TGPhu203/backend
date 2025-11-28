// src/controllers/wishlist.controller.js
import Wishlist from '../models/wishlist.js';
import Product from '../models/product.js';
import { AppError } from '../middlewares/errorHandler.js';

// Lấy danh sách wishlist (trả về chính danh sách product)
export const getWishlist = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const docs = await Wishlist.find({ userId }).populate('productId', [
      '_id',
      'name',
      'slug',
      'price',
      'compareAtPrice',
      'thumbnail',
      'images',
      'inStock',
      'stockQuantity',
    ]);

    // docs: [{ _id, userId, productId: { ...product } }, ...]
    const products = docs
      .map((d) => d.productId)
      .filter(Boolean); // đề phòng product đã bị xoá

    res.status(200).json({
      status: 'success',
      data: products,
    });
  } catch (error) {
    next(error);
  }
};

// Thêm sản phẩm vào wishlist
export const addToWishlist = async (req, res, next) => {
  try {
    const { productId } = req.body;
    const userId = req.user.id;

    const product = await Product.findById(productId);
    if (!product) {
      throw new AppError('Sản phẩm không tồn tại', 404);
    }

    // schema hiện tại dùng mỗi dòng cho 1 sản phẩm
    const existed = await Wishlist.findOne({ userId, productId });
    if (existed) {
      return res.status(200).json({
        status: 'success',
        message: 'Sản phẩm đã có trong danh sách yêu thích',
      });
    }

    await Wishlist.create({ userId, productId });

    res.status(201).json({
      status: 'success',
      message: 'Đã thêm sản phẩm vào danh sách yêu thích',
    });
  } catch (error) {
    next(error);
  }
};

// Xoá 1 sản phẩm khỏi wishlist
export const removeFromWishlist = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const userId = req.user.id;

    const deleted = await Wishlist.findOneAndDelete({ userId, productId });
    if (!deleted) {
      throw new AppError('Sản phẩm không có trong danh sách yêu thích', 404);
    }

    res.status(200).json({
      status: 'success',
      message: 'Đã xóa sản phẩm khỏi danh sách yêu thích',
    });
  } catch (error) {
    next(error);
  }
};

// Kiểm tra 1 product có trong wishlist hay chưa
export const checkWishlist = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const userId = req.user.id;

    const existed = await Wishlist.findOne({ userId, productId });

    res.status(200).json({
      status: 'success',
      data: {
        inWishlist: !!existed,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Xoá toàn bộ wishlist
export const clearWishlist = async (req, res, next) => {
  try {
    const userId = req.user.id;

    await Wishlist.deleteMany({ userId });

    res.status(200).json({
      status: 'success',
      message: 'Đã xóa tất cả sản phẩm trong danh sách yêu thích',
    });
  } catch (error) {
    next(error);
  }
};
