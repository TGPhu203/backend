console.log("👉 BACKEND STRIPE KEY:", process.env.STRIPE_SECRET_KEY);

import Stripe from 'stripe';
import { AppError } from '../../middlewares/errorHandler.js';

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

class StripeService {
  /**
   * Create a payment intent for checkout
   */
  async createPaymentIntent({ amount, currency = 'usd', metadata = {} }) {
    try {
      const stripeAmount =
        currency === 'vnd' ? Math.round(amount) : Math.round(amount * 100);

      console.log('Creating Stripe payment intent with params:', {
        amount: stripeAmount,
        currency,
        metadata,
        originalAmount: amount,
      });

      const paymentIntent = await stripe.paymentIntents.create({
        amount: stripeAmount,
        currency,
        metadata,
        automatic_payment_methods: {
          enabled: true,
        },
      });

      return {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
      };
    } catch (error) {
      console.error('Stripe createPaymentIntent error:', error);
      console.error('Error details:', {
        message: error.message,
        type: error.type,
        code: error.code,
        param: error.param,
        statusCode: error.statusCode,
      });
      throw new AppError(
        `Failed to create payment intent: ${error.message}`,
        500
      );
    }
  }

  /**
   * Confirm a payment intent
   */
  async confirmPaymentIntent(paymentIntentId) {
    try {
      return await stripe.paymentIntents.retrieve(paymentIntentId);
    } catch (error) {
      console.error('Stripe confirmPaymentIntent error:', error);
      throw new AppError('Failed to confirm payment intent', 500);
    }
  }

  /**
   * Create a new customer
   */
  async createCustomer({ email, name, metadata = {} }) {
    try {
      return await stripe.customers.create({
        email,
        name,
        metadata,
      });
    } catch (error) {
      console.error('Stripe createCustomer error:', error);
      throw new AppError('Failed to create customer', 500);
    }
  }

  /**
   * Retrieve customer
   */
  async getCustomer(customerId) {
    try {
      return await stripe.customers.retrieve(customerId);
    } catch (error) {
      console.error('Stripe getCustomer error:', error);
      throw new AppError('Failed to retrieve customer', 500);
    }
  }

  /**
   * Create a refund
   */
  async createRefund({ paymentIntentId, amount, reason = 'requested_by_customer' }) {
    try {
      const refundData = {
        payment_intent: paymentIntentId,
        reason,
      };

      if (amount) {
        refundData.amount = Math.round(amount * 100);
      }

      return await stripe.refunds.create(refundData);
    } catch (error) {
      console.error('Stripe createRefund error:', error);
      throw new AppError('Failed to create refund', 500);
    }
  }

  /**
   * Handle webhook events
   */
  async handleWebhook(payload, signature) {
    try {
      return stripe.webhooks.constructEvent(
        payload,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (error) {
      console.error('Stripe webhook error:', error);
      throw new AppError('Invalid webhook signature', 400);
    }
  }

  /**
   * Get customer payment methods
   */
  async getPaymentMethods(customerId) {
    try {
      const paymentMethods = await stripe.paymentMethods.list({
        customer: customerId,
        type: 'card',
      });

      return paymentMethods.data;
    } catch (error) {
      console.error('Stripe getPaymentMethods error:', error);
      throw new AppError('Failed to retrieve payment methods', 500);
    }
  }

  /**
   * Create setup intent
   */
  async createSetupIntent(customerId) {
    try {
      const setupIntent = await stripe.setupIntents.create({
        customer: customerId,
        payment_method_types: ['card'],
      });

      return {
        clientSecret: setupIntent.client_secret,
        setupIntentId: setupIntent.id,
      };
    } catch (error) {
      console.error('Stripe createSetupIntent error:', error);
      throw new AppError('Failed to create setup intent', 500);
    }
  }
}

export default new StripeService();
