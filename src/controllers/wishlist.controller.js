// src/controllers/wishlist.controller.js
import { Wishlist, Product } from '../models/index.js';
import { AppError } from '../middlewares/errorHandler.js';

// Get user wishlist
export const getWishlist = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const user = await Wishlist.findOne({ userId }).populate('products', [
      'id',
      'name',
      'slug',
      'price',
      'compareAtPrice',
      'thumbnail',
      'inStock',
      'stockQuantity',
    ]);

    res.status(200).json({
      status: 'success',
      data: user ? user.products : [],
    });
  } catch (error) {
    next(error);
  }
};

// Add product to wishlist
export const addToWishlist = async (req, res, next) => {
  try {
    const { productId } = req.body;
    const userId = req.user.id;

    const product = await Product.findById(productId);
    if (!product) {
      throw new AppError('Sản phẩm không tồn tại', 404);
    }

    let wishlist = await Wishlist.findOne({ userId });
    if (!wishlist) {
      wishlist = new Wishlist({ userId, products: [] });
    }

    if (wishlist.products.includes(productId)) {
      return res.status(200).json({
        status: 'success',
        message: 'Sản phẩm đã có trong danh sách yêu thích',
      });
    }

    wishlist.products.push(productId);
    await wishlist.save();

    res.status(201).json({
      status: 'success',
      message: 'Đã thêm sản phẩm vào danh sách yêu thích',
    });
  } catch (error) {
    next(error);
  }
};

// Remove product from wishlist
export const removeFromWishlist = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const userId = req.user.id;

    const wishlist = await Wishlist.findOne({ userId });
    if (!wishlist || !wishlist.products.includes(productId)) {
      throw new AppError('Sản phẩm không có trong danh sách yêu thích', 404);
    }

    wishlist.products = wishlist.products.filter(id => id.toString() !== productId);
    await wishlist.save();

    res.status(200).json({
      status: 'success',
      message: 'Đã xóa sản phẩm khỏi danh sách yêu thích',
    });
  } catch (error) {
    next(error);
  }
};

// Check if product is in wishlist
export const checkWishlist = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const userId = req.user.id;

    const wishlist = await Wishlist.findOne({ userId });

    res.status(200).json({
      status: 'success',
      data: {
        inWishlist: wishlist ? wishlist.products.includes(productId) : false,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Clear wishlist
export const clearWishlist = async (req, res, next) => {
  try {
    const userId = req.user.id;

    await Wishlist.findOneAndDelete({ userId });

    res.status(200).json({
      status: 'success',
      message: 'Đã xóa tất cả sản phẩm trong danh sách yêu thích',
    });
  } catch (error) {
    next(error);
  }
};
