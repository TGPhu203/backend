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
      const { amount, currency = "vnd", orderId } = req.body;
      const userId = req.user.id;
  
      if (!amount || amount <= 0) throw new AppError("Invalid amount", 400);
  
      const paymentIntent = await stripeService.createPaymentIntent({
        amount,
        currency,
        metadata: { userId, orderId },
      });
  
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
      return res.status(200).json({ status: "success", data: { paymentMethods: [] }});

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


// =========================
//      PAYOS WEBHOOK HANDLER
// =========================
export const handleWebhook = async (req, res, next) => {
  try {
    // 1. Xác thực chữ ký + lấy data thanh toán từ PayOS
    const paymentData = payosService.verifyWebhook(req.body);
    // paymentData theo docs sẽ có orderCode, amount, paymentLinkId, code, desc, ... :contentReference[oaicite:5]{index=5}

    const {
      orderCode,
      amount,
      paymentLinkId,
      code,
      desc,
      // các field khác: accountNumber, reference, transactionDateTime, ...
    } = paymentData;

    console.log("PAYOS WEBHOOK:", paymentData);

    // 2. Tìm order tương ứng
    const order = await Order.findOne({
      paymentProvider: "payos",
      paymentOrderCode: orderCode,
    });

    if (!order) {
      console.warn("Không tìm thấy order cho orderCode:", orderCode);
      // vẫn trả 200 để PayOS không retry quá nhiều
      return res.status(200).json({ received: true });
    }

    // 3. Kiểm tra trạng thái thành công
    // Theo .NET docs, code = "00" khi thanh toán thành công :contentReference[oaicite:6]{index=6}
    const isSuccess =
      paymentData.success === true || code === "00" || paymentData.status === "PAID";

    if (isSuccess) {
      order.paymentStatus = "paid";
      // nếu đơn bạn đang để default là "pending" thì có thể chuyển sang "processing"
      if (order.status === "pending") {
        order.status = "processing";
      }
      order.paymentTransactionId = paymentLinkId || paymentData.reference || order.paymentTransactionId;
      await order.save();
    } else {
      // Nếu bạn muốn xử lý thất bại → set failed
      order.paymentStatus = "failed";
      await order.save();
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error("PayOS webhook error:", err);
    // Webhook không hợp lệ → trả 400
    return res.status(400).json({ received: false });
  }
};



/* =========================
      REFUND PAYMENT
   ========================= */
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

    // totalAmount hiện đang là VND (integer) trong createOrder
    const amount = Number(order.totalAmount);
    if (!amount || amount <= 0) {
      throw new AppError("Invalid order amount", 400);
    }

    // PayOS yêu cầu orderCode là số nguyên → dùng timestamp hoặc parse từ orderNumber :contentReference[oaicite:4]{index=4}
    let orderCode = Number(
      String(order.orderNumber || "").replace(/\D/g, "")
    );
    if (!orderCode) {
      orderCode = Date.now(); // fallback
    }

    const description = `Thanh toán đơn hàng ${order.orderNumber}`;

    // Nếu muốn gửi chi tiết item cho đẹp hoá đơn thì bạn có thể populate OrderItem ở đây,
    // ở đây demo đơn giản, không gửi items.
    const items = [];

    const returnUrl =
      process.env.PAYOS_RETURN_URL ||
      `${process.env.FRONTEND_URL}/payment/success`;
    const cancelUrl =
      process.env.PAYOS_CANCEL_URL ||
      `${process.env.FRONTEND_URL}/payment/cancel`;

    const paymentLink = await payosService.createPaymentLink({
      orderCode,
      amount,
      description,
      items,
      returnUrl,
      cancelUrl,
    });

    // Lưu info PayOS lên order để map ngược khi webhook trả về
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