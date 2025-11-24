// controllers/payment.controller.js
import * as stripeService from '../services/payment/stripeService.js';
import { Order, User } from '../models/index.js';
import { AppError } from '../middlewares/errorHandler.js';

// Create payment intent
export const createPaymentIntent = async (req, res, next) => {
  try {
    const { amount, currency = 'usd', orderId } = req.body;
    const userId = req.user.id;

    if (!amount || amount <= 0) {
      throw new AppError('Invalid amount', 400);
    }

    // Create payment intent with metadata
    console.log('Creating payment intent with metadata:', { userId, orderId: orderId || '' });

    const paymentIntent = await stripeService.createPaymentIntent({
      amount,
      currency,
      metadata: { userId, orderId: orderId || '' },
    });

    console.log('Payment intent created:', { id: paymentIntent.paymentIntentId, metadata: paymentIntent.metadata });

    res.status(200).json({ status: 'success', data: paymentIntent });
  } catch (error) {
    next(error);
  }
};

// Confirm payment
export const confirmPayment = async (req, res, next) => {
  try {
    const { paymentIntentId } = req.body;

    if (!paymentIntentId) {
      throw new AppError('Payment intent ID is required', 400);
    }

    const paymentIntent = await stripeService.confirmPaymentIntent(paymentIntentId);

    console.log('Payment Intent Retrieved:', { id: paymentIntent.id, status: paymentIntent.status, metadata: paymentIntent.metadata });

    // Update order payment status if orderId exists in metadata
    if (paymentIntent.metadata.orderId) {
      const existingOrder = await Order.findById(paymentIntent.metadata.orderId);

      if (existingOrder && paymentIntent.status === 'succeeded') {
        existingOrder.status = 'processing';
        existingOrder.paymentStatus = 'paid';
        existingOrder.paymentTransactionId = paymentIntent.id;
        existingOrder.paymentProvider = 'stripe';
        await existingOrder.save();
      }
    }

    res.status(200).json({
      status: 'success',
      data: {
        paymentIntent: {
          id: paymentIntent.id,
          status: paymentIntent.status,
          amount: paymentIntent.currency === 'vnd' ? paymentIntent.amount : paymentIntent.amount / 100,
          currency: paymentIntent.currency,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// Create customer
export const createCustomer = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);

    if (!user) throw new AppError('User not found', 404);

    if (user.stripeCustomerId) {
      const customer = await stripeService.getCustomer(user.stripeCustomerId);
      return res.status(200).json({ status: 'success', data: { customer } });
    }

    const customer = await stripeService.createCustomer({
      email: user.email,
      name: `${user.firstName} ${user.lastName}`,
      metadata: { userId: user.id },
    });

    user.stripeCustomerId = customer.id;
    await user.save();

    res.status(201).json({ status: 'success', data: { customer } });
  } catch (error) {
    next(error);
  }
};

// Get payment methods
export const getPaymentMethods = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);

    if (!user || !user.stripeCustomerId) return res.status(200).json({ status: 'success', data: { paymentMethods: [] } });

    const paymentMethods = await stripeService.getPaymentMethods(user.stripeCustomerId);

    res.status(200).json({ status: 'success', data: { paymentMethods } });
  } catch (error) {
    next(error);
  }
};

// Create setup intent
export const createSetupIntent = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);

    if (!user) throw new AppError('User not found', 404);

    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripeService.createCustomer({
        email: user.email,
        name: `${user.firstName} ${user.lastName}`,
        metadata: { userId: user.id },
      });
      customerId = customer.id;
      user.stripeCustomerId = customerId;
      await user.save();
    }

    const setupIntent = await stripeService.createSetupIntent(customerId);

    res.status(200).json({ status: 'success', data: setupIntent });
  } catch (error) {
    next(error);
  }
};

// Handle webhook
export const handleWebhook = async (req, res, next) => {
  try {
    console.log('Webhook received (sandbox mode)');
    res.status(200).json({ received: true });
  } catch (error) {
    next(error);
  }
};

// Create refund
export const createRefund = async (req, res, next) => {
  try {
    const { orderId, amount, reason } = req.body;

    if (!orderId) throw new AppError('Order ID is required', 400);

    const order = await Order.findById(orderId);
    if (!order) throw new AppError('Order not found', 404);

    if (!order.paymentTransactionId) throw new AppError('No payment transaction found for this order', 400);

    const refund = await stripeService.createRefund({
      paymentIntentId: order.paymentTransactionId,
      amount,
      reason,
    });

    order.paymentStatus = 'refunded';
    await order.save();

    res.status(200).json({ status: 'success', data: { refund } });
  } catch (error) {
    next(error);
  }
};
