// controllers/order.controller.js
import {
  Order,
  OrderItem,
  Cart,
  CartItem,
  Product,
  ProductVariant,
} from '../models/index.js';
import { AppError } from '../middlewares/errorHandler.js';
import {
  sendOrderConfirmationEmail,
  sendOrderStatusUpdateEmail,
  sendOrderCancellationEmail,
} from '../services/email/emailService.js';

// Create order from cart
export const createOrder = async (req, res, next) => {
  const session = await Order.startSession();
  session.startTransaction();
  try {
    const userId = req.user.id;
    const {
      shippingFirstName, shippingLastName, shippingCompany, shippingAddress1, shippingAddress2,
      shippingCity, shippingState, shippingZip, shippingCountry, shippingPhone,
      billingFirstName, billingLastName, billingCompany, billingAddress1, billingAddress2,
      billingCity, billingState, billingZip, billingCountry, billingPhone, paymentMethod, notes,
    } = req.body;

    const cart = await Cart.findOne({ userId, status: 'active' })
      .populate({
        path: 'items',
        populate: [
          { path: 'productId', select: 'name slug price thumbnail inStock stockQuantity sku' },
          { path: 'variantId', select: 'name price stockQuantity sku' }
        ]
      })
      .session(session);

    if (!cart || cart.items.length === 0) throw new AppError('Giỏ hàng trống', 400);

    let subtotal = 0;
    const tax = 0, shippingCost = 0, discount = 0;

    for (const item of cart.items) {
      const product = item.productId;
      const variant = item.variantId;

      if (!product.inStock) throw new AppError(`Sản phẩm "${product.name}" đã hết hàng`, 400);

      if (variant) {
        if (variant.stockQuantity < item.quantity) throw new AppError(
          `Biến thể "${variant.name}" của sản phẩm "${product.name}" chỉ còn ${variant.stockQuantity} sản phẩm`, 400
        );
      } else if (product.stockQuantity < item.quantity) throw new AppError(
        `Sản phẩm "${product.name}" chỉ còn ${product.stockQuantity} sản phẩm`, 400
      );

      const price = variant ? variant.price : product.price;
      subtotal += price * item.quantity;
    }

    const total = subtotal + tax + shippingCost - discount;

    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const count = await Order.countDocuments().session(session);
    const orderNumber = `ORD-${year}${month}-${String(count + 1).padStart(5, '0')}`;

    const order = new Order({
      number: orderNumber, userId, shippingFirstName, shippingLastName, shippingCompany,
      shippingAddress1, shippingAddress2, shippingCity, shippingState, shippingZip, shippingCountry,
      shippingPhone, billingFirstName, billingLastName, billingCompany, billingAddress1, billingAddress2,
      billingCity, billingState, billingZip, billingCountry, billingPhone, paymentMethod,
      paymentStatus: 'pending', subtotal, tax, shippingCost, discount, total, notes,
    });

    await order.save({ session });

    const orderItems = [];
    for (const item of cart.items) {
      const product = item.productId;
      const variant = item.variantId;
      const price = variant ? variant.price : product.price;
      const itemSubtotal = price * item.quantity;

      const orderItem = new OrderItem({
        orderId: order._id,
        productId: product._id,
        variantId: variant ? variant._id : null,
        name: product.name,
        sku: variant ? variant.sku : product.sku,
        price,
        quantity: item.quantity,
        subtotal: itemSubtotal,
        image: product.thumbnail,
        attributes: variant ? { variant: variant.name } : {},
      });

      await orderItem.save({ session });
      orderItems.push(orderItem);

      if (variant) {
        await ProductVariant.findByIdAndUpdate(
          variant._id,
          { $inc: { stockQuantity: -item.quantity } },
          { session }
        );
      } else {
        await Product.findByIdAndUpdate(
          product._id,
          { $inc: { stockQuantity: -item.quantity } },
          { session }
        );
      }
    }

    await Cart.findByIdAndUpdate(cart._id, { status: 'converted' }, { session });
    await CartItem.deleteMany({ cartId: cart._id }, { session });
    await session.commitTransaction();

    await sendOrderConfirmationEmail(req.user.email, {
      orderNumber: order.number,
      orderDate: order.createdAt,
      total: order.total,
      items: orderItems.map(i => ({ name: i.name, quantity: i.quantity, price: i.price, subtotal: i.subtotal })),
      shippingAddress: {
        name: `${order.shippingFirstName} ${order.shippingLastName}`,
        address1: order.shippingAddress1,
        address2: order.shippingAddress2,
        city: order.shippingCity,
        state: order.shippingState,
        zip: order.shippingZip,
        country: order.shippingCountry,
      },
    });

    res.status(201).json({
      status: 'success',
      data: { order: { id: order._id, number: order.number, status: order.status, total: order.total, createdAt: order.createdAt } },
    });
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
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
      .populate('items')
      .lean();

    const total = await Order.countDocuments(query);

    res.status(200).json({
      status: 'success',
      data: {
        orders,
        total,
        pages: Math.ceil(total / limit),
        currentPage: parseInt(page)
      }
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

    const order = await Order.findOne({ _id: id, userId })
      .populate({
        path: 'items',
        populate: [
          { path: 'productId', select: 'name slug thumbnail' },
          { path: 'variantId', select: 'name' }
        ]
      });

    if (!order) throw new AppError('Không tìm thấy đơn hàng', 404);

    res.status(200).json({
      status: 'success',
      data: order
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

    const order = await Order.findOne({ number, userId })
      .populate({
        path: 'items',
        populate: [
          { path: 'productId', select: 'name slug thumbnail' },
          { path: 'variantId', select: 'name' }
        ]
      });

    if (!order) throw new AppError('Không tìm thấy đơn hàng', 404);

    res.status(200).json({
      status: 'success',
      data: order
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
    if (!order) throw new AppError('Không tìm thấy đơn hàng', 404);

    if (!['pending', 'confirmed'].includes(order.status)) {
      throw new AppError('Không thể hủy đơn hàng này', 400);
    }

    order.status = 'cancelled';
    await order.save();

    // Restore stock quantities
    const orderItems = await OrderItem.find({ orderId: order._id });
    for (const item of orderItems) {
      if (item.variantId) {
        await ProductVariant.findByIdAndUpdate(
          item.variantId,
          { $inc: { stockQuantity: item.quantity } }
        );
      } else {
        await Product.findByIdAndUpdate(
          item.productId,
          { $inc: { stockQuantity: item.quantity } }
        );
      }
    }

    await sendOrderCancellationEmail(req.user.email, {
      orderNumber: order.number,
      reason: 'Khách hàng hủy'
    });

    res.status(200).json({
      status: 'success',
      message: 'Đơn hàng đã được hủy thành công'
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
      sort = 'createdAt',
      order = 'DESC'
    } = req.query;

    const query = {};
    if (status) query.status = status;
    if (paymentStatus) query.paymentStatus = paymentStatus;
    if (search) {
      query.$or = [
        { number: { $regex: search, $options: 'i' } },
        { shippingFirstName: { $regex: search, $options: 'i' } },
        { shippingLastName: { $regex: search, $options: 'i' } }
      ];
    }

    const sortOptions = {};
    sortOptions[sort] = order === 'DESC' ? -1 : 1;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const orders = await Order.find(query)
      .populate('userId', 'firstName lastName email')
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await Order.countDocuments(query);

    res.status(200).json({
      status: 'success',
      data: {
        orders,
        total,
        pages: Math.ceil(total / limit),
        currentPage: parseInt(page)
      }
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

    const order = await Order.findById(id).populate('userId', 'email firstName lastName');
    if (!order) throw new AppError('Không tìm thấy đơn hàng', 404);

    const oldStatus = order.status;
    order.status = status;
    if (notes) order.notes = notes;
    await order.save();

    await sendOrderStatusUpdateEmail(order.userId.email, {
      orderNumber: order.number,
      oldStatus,
      newStatus: status,
      customerName: `${order.userId.firstName} ${order.userId.lastName}`
    });

    res.status(200).json({
      status: 'success',
      data: order
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
    if (!order) throw new AppError('Không tìm thấy đơn hàng', 404);

    if (order.paymentStatus !== 'failed') {
      throw new AppError('Đơn hàng này không thể thanh toán lại', 400);
    }

    // Reset payment status for retry
    order.paymentStatus = 'pending';
    await order.save();

    res.status(200).json({
      status: 'success',
      message: 'Đã chuẩn bị thanh toán lại đơn hàng',
      data: order
    });
  } catch (error) {
    next(error);
  }
};
