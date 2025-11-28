// controllers/payment.controller.js
import stripeService from '../services/payment/stripeService.js';
import { Order, User } from '../models/index.js';
import { AppError } from '../middlewares/errorHandler.js';
import payosService from '../services/payment/payosService.js';

/* =========================
      CREATE PAYMENT INTENT
   ========================= */
   export const createPaymentIntent = async (req, res, next) => {
    try {
      const { orderId, currency = "vnd" } = req.body;
      const userId = req.user.id;
  
      if (!orderId) throw new AppError("Order ID is required", 400);
  
      // ✅ đúng là userId
      const order = await Order.findOne({ _id: orderId, userId });
      if (!order) throw new AppError("Order not found", 404);
  
      if (order.paymentStatus === "paid") {
        throw new AppError("Order đã thanh toán", 400);
      }
  
      const amount = Number(
        order.totalAmount ?? order.total ?? order.subtotal ?? 0
      );
      if (!amount || amount <= 0) {
        throw new AppError("Invalid order amount", 400);
      }
  
      const paymentIntent = await stripeService.createPaymentIntent({
        amount,
        currency,
        metadata: { userId, orderId: order.id.toString() },
      });
  
      order.paymentProvider = "stripe";
      order.paymentStatus = "pending";
      order.paymentTransactionId = paymentIntent.id;
      await order.save();
  
      res.status(200).json({ status: "success", data: paymentIntent });
    } catch (error) {
      next(error);
    }
  };


export const confirmPayment = async (req, res, next) => {
  try {
    const { paymentIntentId } = req.body;
    if (!paymentIntentId)
      throw new AppError("Payment intent ID is required", 400);

    const paymentIntent =
      await stripeService.confirmPaymentIntent(paymentIntentId);

    // update order
    if (paymentIntent.metadata?.orderId) {
      const order = await Order.findById(paymentIntent.metadata.orderId);

      if (order && paymentIntent.status === "succeeded") {
        order.paymentStatus = "paid";
        order.status = "processing";
        order.paymentTransactionId = paymentIntent.id;
        order.paymentProvider = "stripe";
        await order.save();
      }
    }

    res.status(200).json({
      status: "success",
      data: {
        paymentIntent: {
          id: paymentIntent.id,
          status: paymentIntent.status,
          amount: paymentIntent.amount,
          currency: paymentIntent.currency,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};


/* =========================
      CREATE CUSTOMER
   ========================= */
export const createCustomer = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) throw new AppError('User not found', 404);

    if (user.stripeCustomerId) {
      const customer = await stripeService.getCustomer(user.stripeCustomerId);
      return res.status(200).json({ status: "success", data: { customer } });
    }

    const customer = await stripeService.createCustomer({
      email: user.email,
      name: `${user.firstName} ${user.lastName}`,
      metadata: { userId: user.id },
    });

    user.stripeCustomerId = customer.id;
    await user.save();

    res.status(201).json({ status: "success", data: { customer } });

  } catch (err) {
    next(err);
  }
};


/* =========================
      GET PAYMENT METHODS
   ========================= */
export const getPaymentMethods = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user?.stripeCustomerId)
      return res.status(200).json({ status: "success", data: { paymentMethods: [] } });

    const paymentMethods = await stripeService.getPaymentMethods(user.stripeCustomerId);

    res.status(200).json({ status: "success", data: { paymentMethods } });

  } catch (err) {
    next(err);
  }
};


/* =========================
      CREATE SETUP INTENT
   ========================= */
export const createSetupIntent = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) throw new AppError("User not found", 404);

    if (!user.stripeCustomerId) {
      const customer = await stripeService.createCustomer({
        email: user.email,
        name: `${user.firstName} ${user.lastName}`,
        metadata: { userId: user.id },
      });

      user.stripeCustomerId = customer.id;
      await user.save();
    }

    const setupIntent = await stripeService.createSetupIntent(user.stripeCustomerId);

    return res.status(200).json({
      status: "success",
      data: setupIntent,
    });

  } catch (err) {
    next(err);
  }
};

/* =========================
 *  STRIPE WEBHOOK HANDLER
 *  (nếu chưa dùng Stripe webhook thực sự, có thể giữ stub như này)
 * ======================= */
export const handleWebhook = async (req, res, next) => {
  try {
    // Nếu sau này bạn cấu hình webhook Stripe, xử lý tại đây.
    // Hiện tại chỉ ack để Stripe/POS không retry.
    console.log("Stripe webhook received (stub).");
    return res.status(200).json({ received: true });
  } catch (err) {
    console.error("Stripe webhook error:", err);
    return res.status(400).json({ received: false });
  }
};

/* =========================
 *  REFUND PAYMENT (Stripe)
 * ======================= */
export const createRefund = async (req, res, next) => {
  try {
    const { orderId, amount, reason } = req.body;

    if (!orderId) throw new AppError("Order ID is required", 400);

    const order = await Order.findById(orderId);
    if (!order) throw new AppError("Order not found", 404);

    if (!order.paymentTransactionId)
      throw new AppError("This order has no payment to refund", 400);

    const refund = await stripeService.createRefund({
      paymentIntentId: order.paymentTransactionId,
      amount,
      reason,
    });

    order.paymentStatus = "refunded";
    await order.save();

    return res.status(200).json({
      status: "success",
      data: { refund },
    });
  } catch (err) {
    next(err);
  }
};

/* =========================
 *  TẠO LINK THANH TOÁN PAYOS
 * ======================= */
export const createPayOSPaymentLink = async (req, res, next) => {
  try {
    const { orderId } = req.body;
    const userId = req.user.id;

    if (!orderId) throw new AppError("Order ID is required", 400);

    const order = await Order.findOne({ _id: orderId, userId });
    if (!order) throw new AppError("Order not found", 404);

    if (order.paymentStatus === "paid") {
      throw new AppError("Order đã thanh toán", 400);
    }

    const amount = Number(
      order.totalAmount ?? order.total ?? order.subtotal ?? 0
    );
    if (!amount || amount <= 0) {
      throw new AppError("Invalid order amount", 400);
    }

    // orderCode phải là số nguyên
    let orderCode = Number(
      String(order.orderNumber || "").replace(/\D/g, "")
    );
    if (!orderCode) orderCode = Date.now();

    // ✅ MÔ TẢ <= 25 KÝ TỰ
    let description = `DH_${String(order.orderNumber || order._id).slice(-10)}`;
    if (description.length > 25) {
      description = description.slice(0, 25);
    }

    // Nếu schema Order có items (virtual) mà chưa populate thì items có thể rỗng → an toàn.
    const items =
      Array.isArray(order.items) && order.items.length
        ? order.items.map((it) => ({
            name: it.productName || it.name || "Sản phẩm",
            quantity: it.quantity || 1,
            price: it.price || 0,
          }))
        : [];

    // ✅ DÙNG ROUTE RIÊNG CHO PAYOS, KHÔNG ĐỤNG /payment/:id CỦA STRIPE
    const baseReturnUrl =
      process.env.PAYOS_RETURN_URL ||
      `${process.env.FRONTEND_URL}/payment-result`;

    const baseCancelUrl =
      process.env.PAYOS_CANCEL_URL ||
      `${process.env.FRONTEND_URL}/payment-result`;

    // Gửi kèm orderId trong query để FE biết đơn nào
    const returnUrl = `${baseReturnUrl}?status=success&orderId=${order._id}`;
    const cancelUrl = `${baseCancelUrl}?status=cancel&orderId=${order._id}`;

    const paymentLink = await payosService.createPaymentLink({
      orderCode,
      amount,
      description,
      items,
      returnUrl,
      cancelUrl,
    });

    // Lưu thông tin PayOS lên order
    order.paymentProvider = "payos";
    order.paymentOrderCode = orderCode;
    order.paymentLinkId = paymentLink.paymentLinkId;
    order.paymentStatus = "pending";
    await order.save();

    return res.status(200).json({
      status: "success",
      data: {
        checkoutUrl: paymentLink.checkoutUrl,
        paymentLinkId: paymentLink.paymentLinkId,
        orderCode,
      },
    });
  } catch (err) {
    next(err);
  }
};
export const handlePayOSWebhook = async (req, res, next) => {
  try {
    console.log(">>> RAW PAYOS WEBHOOK BODY:", req.body);

    // ✅ PHẢI AWAIT
    const verified = await payosService.verifyWebhook(req.body);
    console.log(">>> VERIFIED PAYOS DATA:", verified);

    // Tùy SDK, verified có thể là:
    //  a) trực tiếp là data: { orderCode, amount, code, ... }
    //  b) hoặc vẫn là { code, desc, data: {...} }
    const data = verified.data || verified; // an toàn cho cả 2 trường hợp

    const {
      orderCode,
      amount,
      paymentLinkId,
      code,
      status,       // có thể không có, tùy PayOS
      desc,
    } = data;

    console.log("PAYOS WEBHOOK DATA (parsed):", data);

    const order = await Order.findOne({
      paymentProvider: "payos",
      paymentOrderCode: orderCode,
    });

    if (!order) {
      console.warn("Không tìm thấy order cho orderCode:", orderCode);
      return res.status(200).json({ received: true });
    }

    const isSuccess =
      data.success === true ||
      code === "00" ||
      data.status === "PAID" ||
      status === "PAID";

    const wasPaid = order.paymentStatus === "paid";

    if (isSuccess) {
      order.paymentStatus = "paid";
      if (order.status === "pending") {
        order.status = "processing";
      }
      order.paymentTransactionId =
        paymentLinkId || data.reference || order.paymentTransactionId;
    } else {
      order.paymentStatus = "failed";
    }

    await order.save();

    // ------- CẬP NHẬT LOYALTY KHI THANH TOÁN THÀNH CÔNG -------
    if (isSuccess && !wasPaid && order.userId) {
      const user = await User.findById(order.userId);
      if (user) {
        const orderAmount =
          order.totalAmount || order.total || order.subtotal || 0;

        user.totalSpent = (user.totalSpent || 0) + orderAmount;

        const addPoints = Math.floor(orderAmount / 100_000);
        user.loyaltyPoints = (user.loyaltyPoints || 0) + addPoints;

        user.updateLoyaltyTier();
        await user.save();
      }
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error("PayOS webhook error:", err);
    return res.status(400).json({ received: false });
  }
};

