import { Cart, CartItem, Product, ProductVariant, WarrantyPackage, Coupon, AttributeValue } from '../models/index.js';
import { AppError } from '../middlewares/errorHandler.js';
import { v4 as uuidv4 } from 'uuid';
export const getCart = async (req, res, next) => {
  try {
    let cart;

    // USER CART
    if (req.user) {
      cart = await Cart.findOneAndUpdate(
        { userId: req.user.id, isActive: true },
        { userId: req.user.id, isActive: true },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    } else {
      // GUEST CART
      const { sessionId } = req.cookies;

      if (!sessionId) {
        return res.status(200).json({
          status: "success",
          data: {
            id: null,
            items: [],
            totalItems: 0,
            subtotal: 0,
            couponCode: null,
            couponDiscount: 0,
            total: 0,
          },
        });
      }

      cart = await Cart.findOneAndUpdate(
        { sessionId, isActive: true },
        { sessionId, isActive: true },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }

    const cartItems = await CartItem.find({ cartId: cart._id })
      .populate({
        path: "productId",
        select: `
          name 
          slug 
          price 
          compareAtPrice
          thumbnail 
          images 
          inStock 
          stockQuantity 
          shortDescription
          categories
        `,
        populate: {
          path: "categories",
          select: "name slug",
        },
      })
      .populate({
        path: "variantId",
        select: `
          name 
          price 
          stockQuantity 
          attributes
        `,
        populate: {
          path: "attributes.attributeValueId",
          model: "AttributeValue",
          select: "name value colorCode imageUrl",
        },
      })
      .lean();

    const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);
    const subtotal = cartItems.reduce((sum, item) => sum + item.totalPrice, 0);

    const couponDiscount = cart.couponDiscount || 0;
    const couponCode = cart.couponCode || null;
    const total = Math.max(0, subtotal - couponDiscount); // số tiền thực tế sẽ đem đi thanh toán PayOS

    return res.status(200).json({
      status: "success",
      data: {
        id: cart._id,
        items: cartItems,
        totalItems,
        subtotal,
        couponCode,
        couponDiscount,
        total,
      },
    });
  } catch (err) {
    next(err);
  }
};



// ======================= ADD TO CART =======================
export const addToCart = async (req, res, next) => {
  try {
    const { productId, variantId, quantity = 1 } = req.body;

    const product = await Product.findById(productId);
    if (!product) throw new AppError("Sản phẩm không tồn tại", 404);
    if (!product.inStock) throw new AppError("Sản phẩm đã hết hàng", 400);

    let variant = null;
    let price = product.price;

    if (variantId) {
      variant = await ProductVariant.findOne({ _id: variantId, productId });
      if (!variant) throw new AppError("Biến thể không tồn tại", 404);
      if (variant.stockQuantity < quantity)
        throw new AppError("Số lượng vượt kho", 400);

      price = variant.price;
    } else {
      if (product.stockQuantity < quantity)
        throw new AppError("Số lượng vượt kho", 400);
    }

    let cart;
    // USER CART
    if (req.user) {
      cart = await Cart.findOneAndUpdate(
        { userId: req.user.id, isActive: true },
        { userId: req.user.id, isActive: true },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }
    // GUEST CART
    else {
      let { sessionId } = req.cookies;
      if (!sessionId) {
        sessionId = uuidv4();
        res.cookie("sessionId", sessionId, {
          httpOnly: true,
          maxAge: 30 * 24 * 60 * 60 * 1000,
          sameSite: "lax",
        });
      }

      cart = await Cart.findOneAndUpdate(
        { sessionId, isActive: true },
        { sessionId, isActive: true },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }

    // Find existing item
    let item = await CartItem.findOne({
      cartId: cart._id,
      productId,
      variantId: variantId || null,
    });

    if (item) {
      // UPDATE QUANTITY
      const newQty = item.quantity + quantity;

      if (variantId) {
        if (variant.stockQuantity < newQty)
          throw new AppError("Vượt kho", 400);
      } else {
        if (product.stockQuantity < newQty)
          throw new AppError("Vượt kho", 400);
      }

      item.quantity = newQty;
      item.price = price; // update price
      await item.save();
    } else {
      // ADD NEW ITEM
      item = new CartItem({
        cartId: cart._id,
        productId,
        variantId: variantId || null,
        quantity,
        price,
      });

      await item.save(); // totalPrice auto-calculated
    }

    return getCart(req, res, next);
  } catch (err) {
    next(err);
  }
};
// ======================= UPDATE CART ITEM =======================
export const updateCartItem = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { quantity } = req.body;

    const item = await CartItem.findById(id)
      .populate("productId", "stockQuantity")
      .populate("variantId", "stockQuantity");

    if (!item) throw new AppError("Không tìm thấy sản phẩm", 404);

    const maxStock =
      item.variantId?.stockQuantity ?? item.productId.stockQuantity;

    if (quantity > maxStock)
      throw new AppError("Số lượng vượt quá tồn kho", 400);

    item.quantity = quantity;
    await item.save();

    return getCart(req, res, next);
  } catch (err) {
    next(err);
  }
};


// ======================= REMOVE CART ITEM =======================
export const removeCartItem = async (req, res, next) => {
  try {
    const { id } = req.params;
    await CartItem.findByIdAndDelete(id);
    return getCart(req, res, next);
  } catch (err) {
    next(err);
  }
};

// ======================= CLEAR CART =======================
export const clearCart = async (req, res, next) => {
  try {
    let cart;

    if (req.user) {
      cart = await Cart.findOne({ userId: req.user.id, isActive: true });
    } else {
      cart = await Cart.findOne({ sessionId: req.cookies.sessionId, isActive: true });
    }

    if (cart) await CartItem.deleteMany({ cartId: cart._id });

    res.status(200).json({
      status: "success",
      data: { id: cart?._id || null, items: [], totalItems: 0, subtotal: 0 },
    });
  } catch (err) {
    next(err);
  }
};

// ======================= GET CART COUNT =======================
export const getCartCount = async (req, res, next) => {
  try {
    let cart;

    if (req.user) {
      cart = await Cart.findOne({ userId: req.user.id, isActive: true });
    } else {
      const { sessionId } = req.cookies;
      if (!sessionId)
        return res.status(200).json({ status: 'success', data: { count: 0 } });

      cart = await Cart.findOne({ sessionId, isActive: true });
    }

    if (!cart)
      return res.status(200).json({ status: 'success', data: { count: 0 } });

    const result = await CartItem.aggregate([
      { $match: { cartId: cart._id } },
      { $group: { _id: null, total: { $sum: '$quantity' } } },
    ]);

    const count = result[0]?.total || 0;

    res.status(200).json({ status: 'success', data: { count } });
  } catch (error) {
    next(error);
  }
};

// ======================= SYNC CART =======================
export const syncCart = async (req, res, next) => {
  try {
    const { items } = req.body;
    if (!req.user) throw new AppError('Bạn cần đăng nhập', 401);

    const cart = await Cart.findOneAndUpdate(
      { userId: req.user.id, isActive: true },
      { userId: req.user.id },
      { upsert: true, new: true }
    );

    await CartItem.deleteMany({ cartId: cart._id });

    for (const item of items) {
      const product = await Product.findById(item.productId);

      if (!product || !product.inStock) continue;

      const maxStock = item.variantId
        ? (await ProductVariant.findById(item.variantId))?.stockQuantity
        : product.stockQuantity;

      const finalQuantity = Math.min(item.quantity, maxStock);

      if (finalQuantity > 0) {
        await CartItem.create({
          cartId: cart._id,
          productId: item.productId,
          variantId: item.variantId || null,
          quantity: finalQuantity,
          price: item.price,
        });
      }
    }

    return getCart(req, res, next);
  } catch (error) {
    next(error);
  }
};

// ======================= MERGE CART =======================
export const mergeCart = async (req, res, next) => {
  try {
    if (!req.user) throw new AppError('Bạn cần đăng nhập', 401);

    const { sessionId } = req.cookies;
    if (!sessionId) return getCart(req, res, next);

    const sessionCart = await Cart.findOne({ sessionId, isActive: true });
    if (!sessionCart) return getCart(req, res, next);

    const userCart = await Cart.findOneAndUpdate(
      { userId: req.user.id, isActive: true },
      { userId: req.user.id },
      { upsert: true, new: true }
    );

    const sessionItems = await CartItem.find({ cartId: sessionCart._id })
      .populate('productId', 'stockQuantity')
      .populate('variantId', 'stockQuantity');

    for (const item of sessionItems) {
      const existingUserItem = await CartItem.findOne({
        cartId: userCart._id,
        productId: item.productId,
        variantId: item.variantId || null,
      });

      const maxStock = item.variantId
        ? item.variantId.stockQuantity
        : item.productId.stockQuantity;

      if (existingUserItem) {
        existingUserItem.quantity = Math.min(
          existingUserItem.quantity + item.quantity,
          maxStock
        );
        await existingUserItem.save();
        await item.deleteOne();
      } else {
        item.cartId = userCart._id;
        item.quantity = Math.min(item.quantity, maxStock);
        await item.save();
      }
    }

    sessionCart.isActive = false;
    await sessionCart.save();
    res.clearCookie('sessionId');

    return getCart(req, res, next);
  } catch (error) {
    next(error);
  }
};
export const applyCouponToCart = async (req, res) => {
  try {
    const userId = req.user.id;
    const { code } = req.body;

    if (!code || !code.trim()) {
      return res
        .status(400)
        .json({ status: "error", message: "Vui lòng nhập mã khuyến mãi" });
    }

    const normalizedCode = code.trim().toUpperCase();

    // 1) Tìm mã
    const coupon = await Coupon.findOne({
      code: normalizedCode,
      isActive: true,
    });

    if (!coupon) {
      return res
        .status(400)
        .json({ status: "error", message: "Mã khuyến mãi không hợp lệ" });
    }

    const now = new Date();
    if (coupon.startDate && coupon.startDate > now) {
      return res
        .status(400)
        .json({ status: "error", message: "Mã này chưa bắt đầu áp dụng" });
    }
    if (coupon.endDate && coupon.endDate < now) {
      return res
        .status(400)
        .json({ status: "error", message: "Mã khuyến mãi đã hết hạn" });
    }

    // 2) Lấy cart & cartItems của user
    const cart = await Cart.findOne({ userId, isActive: true });
    if (!cart) {
      return res
        .status(400)
        .json({ status: "error", message: "Giỏ hàng đang trống" });
    }

    const cartItems = await CartItem.find({ cartId: cart._id }).lean();
    if (!cartItems.length) {
      return res
        .status(400)
        .json({ status: "error", message: "Giỏ hàng đang trống" });
    }

    const subtotal = cartItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );

    if (subtotal < (coupon.minOrderAmount || 0)) {
      return res.status(400).json({
        status: "error",
        message: `Đơn hàng cần tối thiểu ${coupon.minOrderAmount.toLocaleString(
          "vi-VN"
        )}₫ để dùng mã này`,
      });
    }

    // 3) Tính số tiền giảm
    let discountAmount = 0;
    if (coupon.type === "percent") {
      discountAmount = Math.round((subtotal * coupon.value) / 100);
    } else {
      discountAmount = coupon.value;
    }

    if (coupon.maxDiscount && coupon.type === "percent") {
      discountAmount = Math.min(discountAmount, coupon.maxDiscount);
    }

    // 4) Lưu lên Cart – để sau khi thanh toán PayOS, Order lấy đúng số đã trừ
    const updatedCart = await Cart.findOneAndUpdate(
      { _id: cart._id },
      {
        couponCode: coupon.code,
        couponDiscount: discountAmount,
      },
      { new: true }
    ).lean();

    const totalAfterDiscount = Math.max(
      0,
      subtotal - (updatedCart.couponDiscount || 0)
    );

    return res.status(200).json({
      status: "success",
      data: {
        cart: {
          id: updatedCart._id,
          subtotal,
          couponCode: updatedCart.couponCode,
          couponDiscount: updatedCart.couponDiscount || 0,
          total: totalAfterDiscount, // số tiền bạn gửi sang PayOS
        },
        code: coupon.code,
        discountAmount,
        description:
          coupon.type === "percent"
            ? `Giảm ${coupon.value}%${
                coupon.maxDiscount
                  ? ` tối đa ${coupon.maxDiscount.toLocaleString("vi-VN")}₫`
                  : ""
              }`
            : `Giảm ${coupon.value.toLocaleString("vi-VN")}₫`,
      },
    });
  } catch (err) {
    console.error("applyCouponToCart error:", err);
    return res
      .status(500)
      .json({ status: "error", message: "Lỗi server khi áp dụng mã" });
  }
};
