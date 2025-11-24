import { Cart, CartItem, Product, ProductVariant, WarrantyPackage } from '../models/index.js';
import { AppError } from '../middlewares/errorHandler.js';
import { v4 as uuidv4 } from 'uuid';

// Get cart
export const getCart = async (req, res, next) => {
  try {
    let cart;

    if (req.user) {
      cart = await Cart.findOneAndUpdate(
        { userId: req.user.id, status: 'active' },
        { userId: req.user.id },
        { upsert: true, new: true }
      );
    } else {
      const { sessionId } = req.cookies;

      if (!sessionId) {
        return res.status(200).json({
          status: 'success',
          data: { id: null, items: [], totalItems: 0, subtotal: 0 },
        });
      }

      cart = await Cart.findOneAndUpdate(
        { sessionId, status: 'active' },
        { sessionId },
        { upsert: true, new: true }
      );
    }

    const cartItems = await CartItem.find({ cartId: cart._id })
      .populate('productId', 'name slug price thumbnail inStock stockQuantity')
      .populate('variantId', 'name price stockQuantity')
      .lean();

    const cartItemsWithWarranties = await Promise.all(
      cartItems.map(async (item) => {
        if (item.warrantyPackageIds?.length > 0) {
          const warranties = await WarrantyPackage.find({
            _id: { $in: item.warrantyPackageIds },
            isActive: true
          }).select('name price durationMonths');
          item.warrantyPackages = warranties;
        } else {
          item.warrantyPackages = [];
        }
        return item;
      })
    );

    const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);
    const subtotal = cartItemsWithWarranties.reduce((sum, item) => {
      const price = item.variantId ? item.variantId.price : item.productId.price;
      const warrantyPrice = item.warrantyPackages?.reduce(
        (acc, w) => acc + parseFloat(w.price),
        0
      ) || 0;
      return sum + (price + warrantyPrice) * item.quantity;
    }, 0);

    res.status(200).json({
      status: 'success',
      data: { id: cart._id, items: cartItemsWithWarranties, totalItems, subtotal },
    });
  } catch (error) {
    next(error);
  }
};

// Add item to cart
export const addToCart = async (req, res, next) => {
  try {
    const { productId, variantId, quantity = 1, warrantyPackageIds = [] } = req.body;

    const product = await Product.findById(productId);
    if (!product) throw new AppError('Sản phẩm không tồn tại', 404);
    if (!product.inStock) throw new AppError('Sản phẩm đã hết hàng', 400);

    let variant = null;
    if (variantId) {
      variant = await ProductVariant.findOne({ _id: variantId, productId });
      if (!variant) throw new AppError('Biến thể sản phẩm không tồn tại', 404);
      if (variant.stockQuantity < quantity) throw new AppError('Số lượng vượt quá tồn kho', 400);
    } else if (product.stockQuantity < quantity) {
      throw new AppError('Số lượng vượt quá tồn kho', 400);
    }

    let validWarrantyPackageIds = [];
    if (warrantyPackageIds?.length > 0) {
      const warranties = await WarrantyPackage.find({
        _id: { $in: warrantyPackageIds },
        isActive: true
      });
      if (warranties.length !== warrantyPackageIds.length)
        throw new AppError('Một hoặc nhiều gói bảo hành không hợp lệ', 400);
      validWarrantyPackageIds = warranties.map((w) => w._id);
    }

    let cart;
    if (req.user) {
      cart = await Cart.findOneAndUpdate(
        { userId: req.user.id, status: 'active' },
        { userId: req.user.id },
        { upsert: true, new: true }
      );
    } else {
      let { sessionId } = req.cookies;
      if (!sessionId) {
        sessionId = uuidv4();
        res.cookie('sessionId', sessionId, {
          httpOnly: true,
          maxAge: 30 * 24 * 60 * 60 * 1000,
          sameSite: 'strict',
        });
      }

      cart = await Cart.findOneAndUpdate(
        { sessionId, status: 'active' },
        { sessionId },
        { upsert: true, new: true }
      );
    }

    let cartItem = await CartItem.findOne({
      cartId: cart._id,
      productId,
      variantId: variantId || null,
      warrantyPackageIds: validWarrantyPackageIds,
    });

    if (cartItem) {
      const newQuantity = cartItem.quantity + quantity;
      if (variantId) {
        if (variant.stockQuantity < newQuantity) throw new AppError('Số lượng vượt tồn kho', 400);
      } else if (product.stockQuantity < newQuantity) {
        throw new AppError('Số lượng vượt tồn kho', 400);
      }
      cartItem.quantity = newQuantity;
      await cartItem.save();
    } else {
      cartItem = new CartItem({
        cartId: cart._id,
        productId,
        variantId: variantId || null,
        quantity,
        price: variantId ? variant.price : product.price,
        warrantyPackageIds: validWarrantyPackageIds,
      });
      await cartItem.save();
    }

    return getCart(req, res, next);
  } catch (error) {
    next(error);
  }
};

// Update cart item
export const updateCartItem = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { quantity } = req.body;

    const cartItem = await CartItem.findById(id)
      .populate('cartId', 'userId sessionId')
      .populate('productId', 'stockQuantity')
      .populate('variantId', 'stockQuantity');

    if (!cartItem) throw new AppError('Không tìm thấy sản phẩm trong giỏ hàng', 404);

    if (req.user) {
      if (cartItem.cartId.userId.toString() !== req.user.id)
        throw new AppError('Bạn không có quyền truy cập giỏ hàng này', 403);
    } else {
      const { sessionId } = req.cookies;
      if (!sessionId || cartItem.cartId.sessionId !== sessionId)
        throw new AppError('Bạn không có quyền truy cập giỏ hàng này', 403);
    }

    if (cartItem.variantId) {
      if (cartItem.variantId.stockQuantity < quantity)
        throw new AppError('Số lượng vượt quá tồn kho', 400);
    } else if (cartItem.productId.stockQuantity < quantity) {
      throw new AppError('Số lượng vượt quá tồn kho', 400);
    }

    cartItem.quantity = quantity;
    await cartItem.save();
    return getCart(req, res, next);
  } catch (error) {
    next(error);
  }
};

// Remove item
export const removeCartItem = async (req, res, next) => {
  try {
    const { id } = req.params;
    const cartItem = await CartItem.findById(id).populate('cartId', 'userId sessionId');

    if (!cartItem) throw new AppError('Không tìm thấy sản phẩm trong giỏ hàng', 404);

    if (req.user) {
      if (cartItem.cartId.userId.toString() !== req.user.id)
        throw new AppError('Bạn không có quyền truy cập giỏ hàng này', 403);
    } else {
      const { sessionId } = req.cookies;
      if (!sessionId || cartItem.cartId.sessionId !== sessionId)
        throw new AppError('Bạn không có quyền truy cập giỏ hàng này', 403);
    }

    await cartItem.deleteOne();
    return getCart(req, res, next);
  } catch (error) {
    next(error);
  }
};

// Clear cart
export const clearCart = async (req, res, next) => {
  try {
    let cartId;

    if (req.user) {
      const cart = await Cart.findOne({ userId: req.user.id, status: 'active' });
      if (!cart) return res.status(200).json({ status: 'success', message: 'Giỏ hàng đã trống' });
      cartId = cart._id;
    } else {
      const { sessionId } = req.cookies;
      if (!sessionId)
        return res.status(200).json({ status: 'success', message: 'Giỏ hàng đã trống' });
      const cart = await Cart.findOne({ sessionId, status: 'active' });
      if (!cart) return res.status(200).json({ status: 'success', message: 'Giỏ hàng đã trống' });
      cartId = cart._id;
    }

    await CartItem.deleteMany({ cartId });

    res.status(200).json({
      status: 'success',
      message: 'Đã xóa tất cả sản phẩm trong giỏ hàng',
      data: { id: cartId, items: [], totalItems: 0, subtotal: 0 },
    });
  } catch (error) {
    next(error);
  }
};

// Get cart count
export const getCartCount = async (req, res, next) => {
  try {
    let cart;

    if (req.user) {
      cart = await Cart.findOne({ userId: req.user.id, status: 'active' });
    } else {
      const { sessionId } = req.cookies;
      if (!sessionId)
        return res.status(200).json({ status: 'success', data: { count: 0 } });
      cart = await Cart.findOne({ sessionId, status: 'active' });
    }

    if (!cart) return res.status(200).json({ status: 'success', data: { count: 0 } });

    const result = await CartItem.aggregate([
      { $match: { cartId: cart._id } },
      { $group: { _id: null, total: { $sum: '$quantity' } } }
    ]);

    const count = result.length > 0 ? result[0].total : 0;
    res.status(200).json({ status: 'success', data: { count } });
  } catch (error) {
    next(error);
  }
};

// Sync cart
export const syncCart = async (req, res, next) => {
  try {
    const { items } = req.body;
    if (!req.user) throw new AppError('Bạn cần đăng nhập để đồng bộ giỏ hàng', 401);

    const cart = await Cart.findOneAndUpdate(
      { userId: req.user.id, status: 'active' },
      { userId: req.user.id },
      { upsert: true, new: true }
    );

    await CartItem.deleteMany({ cartId: cart._id });

    for (const item of items) {
      const { productId, variantId, quantity } = item;
      const product = await Product.findById(productId);
      if (!product || !product.inStock) continue;

      if (variantId) {
        const variant = await ProductVariant.findOne({ _id: variantId, productId });
        if (!variant) continue;
        const actualQuantity = Math.min(quantity, variant.stockQuantity);
        if (actualQuantity > 0) {
          await CartItem.create({
            cartId: cart._id,
            productId,
            variantId,
            quantity: actualQuantity,
            price: variant.price
          });
        }
      } else {
        const actualQuantity = Math.min(quantity, product.stockQuantity);
        if (actualQuantity > 0) {
          await CartItem.create({
            cartId: cart._id,
            productId,
            quantity: actualQuantity,
            price: product.price
          });
        }
      }
    }

    return getCart(req, res, next);
  } catch (error) {
    next(error);
  }
};

// Merge guest cart with user cart
export const mergeCart = async (req, res, next) => {
  try {
    if (!req.user) throw new AppError('Bạn cần đăng nhập để thực hiện chức năng này', 401);

    const { sessionId } = req.cookies;
    if (!sessionId) return getCart(req, res, next);

    const sessionCart = await Cart.findOne({ sessionId, status: 'active' });
    if (!sessionCart) return getCart(req, res, next);

    const userCart = await Cart.findOneAndUpdate(
      { userId: req.user.id, status: 'active' },
      { userId: req.user.id },
      { upsert: true, new: true }
    );

    const sessionItems = await CartItem.find({ cartId: sessionCart._id })
      .populate('productId', 'stockQuantity')
      .populate('variantId', 'stockQuantity');

    for (const sessionItem of sessionItems) {
      const existingUserItem = await CartItem.findOne({
        cartId: userCart._id,
        productId: sessionItem.productId,
        variantId: sessionItem.variantId || null,
      });

      if (existingUserItem) {
        const newQuantity = existingUserItem.quantity + sessionItem.quantity;
        const maxStock = sessionItem.variantId
          ? sessionItem.variantId.stockQuantity
          : sessionItem.productId.stockQuantity;
        const finalQuantity = Math.min(newQuantity, maxStock);
        existingUserItem.quantity = finalQuantity;
        await existingUserItem.save();
        await sessionItem.deleteOne();
      } else {
        sessionItem.cartId = userCart._id;
        await sessionItem.save();
      }
    }

    sessionCart.status = 'merged';
    await sessionCart.save();
    res.clearCookie('sessionId');
    return getCart(req, res, next);
  } catch (error) {
    next(error);
  }
};
