// controllers/order.controller.js
import {
  Order,
  OrderItem,
  Cart,
  CartItem,
  Product,
  ProductVariant,
  ProductWarranty,
  User,
  Coupon,
} from "../models/index.js";
import { AppError } from "../middlewares/errorHandler.js";
import {
  sendOrderConfirmationEmail,
  sendOrderStatusUpdateEmail,
  sendOrderCancellationEmail,
} from "../services/email/emailService.js";
import { generateRandomImei } from "../utils/imei.js";
import {
  getDiscountPercentByTier,
  applyOrderToUserLoyalty,
} from "../services/loyaltyService.js";
// helper cộng tháng
const addMonths = (date, months) => {
  const d = new Date(date);
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  // handle cuối tháng
  if (d.getDate() < day) {
    d.setDate(0);
  }
  return d;
};
const calcLoyaltyTier = (totalSpent = 0) => {
  if (totalSpent >= 100_000_000) return "diamond";
  if (totalSpent >= 50_000_000) return "gold";
  if (totalSpent >= 10_000_000) return "silver";
  return "none";
};


// helper tính điểm từ giá trị đơn
const calcEarnedPoints = (amount = 0) => {
  // 1 điểm / 100.000đ
  return Math.floor(amount / 10_000);
};

export const createOrder = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const {
      paymentMethod,
      notes,
      shippingAddress,
      billingAddress,
      coupon,               // 👈 nhận coupon từ body
    } = req.body;

    // 1. Validate shipping
    if (
      !shippingAddress ||
      !shippingAddress.fullName ||
      !shippingAddress.addressLine1 ||
      !shippingAddress.city ||
      !shippingAddress.phone
    ) {
      throw new AppError("Thông tin giao hàng không đầy đủ", 400);
    }

    // 2. Lấy giỏ hàng active
    const cart = await Cart.findOne({ userId, isActive: true });
    if (!cart) throw new AppError("Giỏ hàng trống", 400);

    const cartItems = await CartItem.find({ cartId: cart._id })
      .populate({
        path: "productId",
        select: "name slug price thumbnail images inStock stockQuantity sku",
      })
      .populate({
        path: "variantId",
        select: "name price stockQuantity sku",
      });

    if (!cartItems.length) throw new AppError("Giỏ hàng trống", 400);

    // 3. Tính subtotal + check tồn kho
    let subtotal = 0;
    const taxAmount = 0;
    const shippingAmount = 0;

    for (const item of cartItems) {
      const product = item.productId;
      const variant = item.variantId;

      if (!product.inStock) {
        throw new AppError(`Sản phẩm "${product.name}" đã hết hàng`, 400);
      }

      const stock = variant ? variant.stockQuantity : product.stockQuantity;
      if (stock < item.quantity) {
        throw new AppError(
          `Sản phẩm "${product.name}" chỉ còn ${stock} sản phẩm`,
          400
        );
      }

      const price = variant ? variant.price : product.price;
      subtotal += price * item.quantity;
    }

    // ========= GIẢM GIÁ =========

    // 3.5. Giảm giá loyalty (khách hàng thân thiết)
    let loyaltyDiscount = 0;
    const user = await User.findById(userId).select("loyaltyTier");
    if (user) {
      const discountPercent = await getDiscountPercentByTier(user.loyaltyTier);
      if (discountPercent > 0) {
        loyaltyDiscount = Math.round((subtotal * discountPercent) / 100);
      }
    }

    // 3.6. Giảm giá coupon
    let couponDiscount = 0;
    let appliedCouponDoc = null;

    if (coupon?.code) {
      const code = coupon.code.toUpperCase().trim();

      const c = await Coupon.findOne({ code, isActive: true });
      if (!c) {
        throw new AppError("Mã ưu đãi không tồn tại hoặc đã bị khóa", 400);
      }

      const now = new Date();
      if (c.startDate && now < c.startDate) {
        throw new AppError("Mã ưu đãi chưa đến thời gian sử dụng", 400);
      }
      if (c.endDate && now > c.endDate) {
        throw new AppError("Mã ưu đãi đã hết hạn", 400);
      }
      if (c.minOrderAmount && subtotal < c.minOrderAmount) {
        throw new AppError(
          "Đơn hàng không đủ điều kiện áp dụng mã ưu đãi",
          400
        );
      }
      if (c.usageLimit && c.usageLimit > 0 && c.usedCount >= c.usageLimit) {
        throw new AppError("Mã ưu đãi đã hết lượt sử dụng", 400);
      }
      if (Array.isArray(c.applicableTiers) && c.applicableTiers.length > 0) {
        const tier = user?.loyaltyTier || "none";
        if (!c.applicableTiers.includes(tier)) {
          throw new AppError(
            "Mã ưu đãi không áp dụng cho hạng thành viên hiện tại",
            400
          );
        }
      }

      // tính tiền giảm
      if (c.type === "percent") {
        couponDiscount = Math.round((subtotal * c.value) / 100);
      } else {
        couponDiscount = c.value;
      }

      if (c.maxDiscount && c.maxDiscount > 0) {
        couponDiscount = Math.min(couponDiscount, c.maxDiscount);
      }

      appliedCouponDoc = c;
    }

    // 3.7. Tổng giảm giá + tổng thanh toán
    const discountAmount = loyaltyDiscount + couponDiscount;   // 👈 KHAI BÁO Ở ĐÂY
    const totalAmount =
      subtotal + taxAmount + shippingAmount - discountAmount;

    // 4. Tạo mã đơn
    const now = new Date();
    const year = now.getFullYear().toString().slice(-2);
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const count = await Order.countDocuments();
    const orderNumber = `ORD-${year}${month}-${String(count + 1).padStart(
      5,
      "0"
    )}`;

    // Chuẩn hóa paymentMethod cho chắc
    const safePaymentMethod = ["cod", "stripe", "payos"].includes(paymentMethod)
      ? paymentMethod
      : "cod";

    // 5. Tạo order
    const order = await Order.create({
      userId,
      orderNumber,
      subtotal,
      taxAmount,
      shippingAmount,
      discountAmount,
      loyaltyDiscountAmount: loyaltyDiscount,
      couponDiscountAmount: couponDiscount,
      couponCode: appliedCouponDoc?.code || null,
      totalAmount,
      currency: "VND",
      shippingAddress,
      billingAddress,
      paymentMethod: safePaymentMethod,
      paymentStatus: "pending",
      // paymentProvider để default "cod", sau này:
      // - Stripe: set "stripe" khi tạo paymentIntent
      // - PayOS: set "payos" trong createPayOSPaymentLink
      notes,
    });


    // nếu dùng coupon thì tăng usedCount
    if (appliedCouponDoc) {
      appliedCouponDoc.usedCount = (appliedCouponDoc.usedCount || 0) + 1;
      await appliedCouponDoc.save();
    }

    const orderItems = [];

    // 6. Tạo OrderItem + bảo hành + trừ kho (phần này giữ nguyên code cũ của bạn)
    for (const item of cartItems) {
      const product = item.productId;
      const variant = item.variantId;
      const price = variant ? variant.price : product.price;

      const pw = await ProductWarranty.findOne({
        productId: product._id,
        isDefault: true,
      }).populate("warrantyPackageId");

      let warrantyPackageId = null;
      let warrantyStartAt = null;
      let warrantyEndAt = null;
      let warrantyStatus = "void";

      if (pw && pw.warrantyPackageId) {
        const pkg = pw.warrantyPackageId;
        warrantyPackageId = pkg._id;
        warrantyStartAt = new Date();
        const duration = pkg.durationMonths || 0;
        warrantyEndAt = duration > 0 ? addMonths(warrantyStartAt, duration) : null;
        warrantyStatus = "active";
      }

      const imei = generateRandomImei();

      const payload = {
        orderId: order._id,
        productId: product._id,
        variantId: variant ? variant._id : null,
        name: product.name,
        variantName: variant ? variant.name : null,
        sku: variant ? variant.sku : product.sku,
        image:
          product.thumbnail ||
          (Array.isArray(product.images) && product.images[0]) ||
          null,
        price,
        quantity: item.quantity,
        totalPrice: price * item.quantity,
        imei,
        warrantyPackageId,
        warrantyStartAt,
        warrantyEndAt,
        warrantyStatus,
      };

      const oItem = await OrderItem.create(payload);
      orderItems.push(oItem);

      if (variant) {
        await ProductVariant.findByIdAndUpdate(variant._id, {
          $inc: { stockQuantity: -item.quantity },
        });
      } else {
        await Product.findByIdAndUpdate(product._id, {
          $inc: { stockQuantity: -item.quantity },
        });
      }
    }

    // 7. Clear cart
    await Cart.findByIdAndUpdate(cart._id, { isActive: false });
    await CartItem.deleteMany({ cartId: cart._id });

    // 8. Gửi email (giữ nguyên đoạn của bạn)
    try {
      await sendOrderConfirmationEmail(req.user.email, {
        orderNumber: order.orderNumber,
        orderDate: order.createdAt,
        total: order.totalAmount,
        items: orderItems.map((i) => ({
          name: i.name,
          quantity: i.quantity,
          price: i.price,
          subtotal: i.totalPrice,
        })),
        shippingAddress,
      });
    } catch (e) {
      console.log("Email error:", e);
    }

    res.status(201).json({
      status: "success",
      data: {
        order: {
          id: order._id,
          number: order.orderNumber,
          status: order.status,
          total: order.totalAmount,
          createdAt: order.createdAt,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

// Get user orders
export const getUserOrders = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 10, status } = req.query;

    const query = { userId };
    if (status) query.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate("items")
      .lean();

    const total = await Order.countDocuments(query);

    res.status(200).json({
      status: "success",
      data: {
        orders,
        total,
        pages: Math.ceil(total / limit),
        currentPage: parseInt(page),
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get order by ID
export const getOrderById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const order = await Order.findOne({ _id: id, userId }).populate({
      path: "items",
      populate: [
        { path: "productId", select: "name slug thumbnail images" },
        { path: "variantId", select: "name" },
        { path: "warrantyPackageId", select: "name durationMonths price" },
      ],
    });

    if (!order) throw new AppError("Không tìm thấy đơn hàng", 404);

    res.status(200).json({
      status: "success",
      data: order,
    });
  } catch (error) {
    next(error);
  }
};

// Get order by number
export const getOrderByNumber = async (req, res, next) => {
  try {
    const { number } = req.params;
    const userId = req.user.id;

    const order = await Order.findOne({
      orderNumber: number,
      userId,
    }).populate({
      path: "items",
      populate: [
        { path: "productId", select: "name slug thumbnail images" },
        { path: "variantId", select: "name" },
        { path: "warrantyPackageId", select: "name durationMonths price" },
      ],
    });

    if (!order) throw new AppError("Không tìm thấy đơn hàng", 404);

    res.status(200).json({
      status: "success",
      data: order,
    });
  } catch (error) {
    next(error);
  }
};

// Cancel order
export const cancelOrder = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const order = await Order.findOne({ _id: id, userId });
    if (!order) throw new AppError("Không tìm thấy đơn hàng", 404);

    if (!["pending", "confirmed"].includes(order.status)) {
      throw new AppError("Không thể hủy đơn hàng này", 400);
    }

    // 1) Đổi trạng thái đơn
    order.status = "cancelled";
    await order.save();

    // 2) Lấy toàn bộ item của đơn
    const orderItems = await OrderItem.find({ orderId: order._id });

    // 3) Hoàn lại tồn kho
    for (const item of orderItems) {
      if (item.variantId) {
        await ProductVariant.findByIdAndUpdate(item.variantId, {
          $inc: { stockQuantity: item.quantity },
        });
      } else {
        await Product.findByIdAndUpdate(item.productId, {
          $inc: { stockQuantity: item.quantity },
        });
      }
    }

    // 4) Hủy hiệu lực bảo hành của các item (warrantyStatus: active -> void)
    await OrderItem.updateMany(
      { orderId: order._id, warrantyStatus: "active" },
      { $set: { warrantyStatus: "void" } }
    );

    // 5) Gửi email báo hủy
    await sendOrderCancellationEmail(req.user.email, {
      orderNumber: order.orderNumber, // dùng đúng field trong schema
      reason: "Khách hàng hủy",
    });

    res.status(200).json({
      status: "success",
      message: "Đơn hàng đã được hủy thành công",
    });
  } catch (error) {
    next(error);
  }
};

// Get all orders (Admin)
export const getAllOrders = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      paymentStatus,
      search,
      sort = "createdAt",
      order = "DESC",
    } = req.query;

    const query = {};
    if (status) query.status = status;
    if (paymentStatus) query.paymentStatus = paymentStatus;
    if (search) {
      query.$or = [
        { orderNumber: { $regex: search, $options: "i" } },
        { "shippingAddress.fullName": { $regex: search, $options: "i" } },
        { "shippingAddress.phone": { $regex: search, $options: "i" } },
      ];
    }

    const sortOptions = {};
    sortOptions[sort] = order === "DESC" ? -1 : 1;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const orders = await Order.find(query)
      .populate("userId", "firstName lastName email")
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await Order.countDocuments(query);

    res.status(200).json({
      status: "success",
      data: {
        orders,
        total,
        pages: Math.ceil(total / limit),
        currentPage: parseInt(page),
      },
    });
  } catch (error) {
    next(error);
  }
};
// Update order status (Admin)
export const updateOrderStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    const order = await Order.findById(id).populate(
      "userId",
      "email firstName lastName"
    );
    if (!order) throw new AppError("Không tìm thấy đơn hàng", 404);

    const oldStatus = order.status;
    order.status = status;
    if (notes) order.notes = notes;
    await order.save();

    // 🔹 LẦN ĐẦU CHUYỂN SANG completed => cộng chi tiêu + điểm
    if (oldStatus !== "completed" && status === "completed") {
      const amount = order.totalAmount || 0;
      const user = await User.findById(order.userId);

      if (user) {
        const earned = Math.floor(amount / 10000); // 1 điểm / 100k
        user.loyaltyPoints = (user.loyaltyPoints || 0) + earned;
        user.totalSpent = (user.totalSpent || 0) + amount;
        user.updateLoyaltyTier();                   // dùng method trong schema
        await user.save();
      }
    }


    await sendOrderStatusUpdateEmail(order.userId.email, {
      orderNumber: order.orderNumber,
      oldStatus,
      newStatus: status,
      customerName: `${order.userId.firstName} ${order.userId.lastName}`,
    });

    res.status(200).json({
      status: "success",
      data: order,
    });
  } catch (error) {
    next(error);
  }
};


// Repay order
export const repayOrder = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const order = await Order.findOne({ _id: id, userId });
    if (!order) throw new AppError("Không tìm thấy đơn hàng", 404);

    if (order.paymentStatus !== "failed") {
      throw new AppError("Đơn hàng này không thể thanh toán lại", 400);
    }

    // Reset payment status for retry
    order.paymentStatus = "pending";
    await order.save();

    res.status(200).json({
      status: "success",
      message: "Đã chuẩn bị thanh toán lại đơn hàng",
      data: order,
    });
  } catch (error) {
    next(error);
  }
};
