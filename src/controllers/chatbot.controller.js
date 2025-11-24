import { Product, Category, Order, OrderItem, User, Cart, CartItem } from '../models/index.js';
import chatbotService from '../services/chatbot.service.js';
import geminiChatbotService from '../services/geminiChatbot.service.js';

let genAI = null;
try {
  if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'demo-key') {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  }
} catch (error) {
  console.log('Google Generative AI not available, using fallback responses');
}

class ChatbotController {
  async handleMessage(req, res) {
    try {
      const { message, userId, sessionId, context = {} } = req.body;

      if (!message?.trim()) {
        return res.status(400).json({
          status: 'error',
          message: 'Message is required',
        });
      }

      const response = await geminiChatbotService.handleMessage(message, {
        userId,
        sessionId,
        ...context,
      });

      res.json({ status: 'success', data: response });
    } catch (error) {
      console.error('Chatbot error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to process message',
        data: {
          response:
            'Xin lỗi, tôi đang gặp một chút vấn đề. Vui lòng thử lại sau ít phút nhé! 😅',
          suggestions: ['Xem sản phẩm hot', 'Tìm khuyến mãi', 'Liên hệ hỗ trợ'],
        },
      });
    }
  }

  async aiProductSearch(req, res) {
    try {
      const { query, userId, limit = 10 } = req.body;
      if (!query?.trim()) {
        return res.status(400).json({ status: 'error', message: 'Search query is required' });
      }
      const searchParams = chatbotService.extractSearchParams(query);
      const products = await this.searchProducts({ ...searchParams, limit });
      res.json({ status: 'success', data: { query, results: products, total: products.length } });
    } catch (error) {
      console.error('AI product search error:', error);
      res.status(500).json({ status: 'error', message: 'Search failed' });
    }
  }

  async getRecommendations(req, res) {
    try {
      const { userId, limit = 5, type = 'personal' } = req.query;
      const recommendations = await chatbotService.getPersonalizedRecommendations(userId, {
        type,
        limit: parseInt(limit),
      });
      res.json({ status: 'success', data: { recommendations, type } });
    } catch (error) {
      console.error('Recommendations error:', error);
      res.status(500).json({ status: 'error', message: 'Failed to get recommendations' });
    }
  }

  async trackAnalytics(req, res) {
    try {
      const { event, userId, sessionId, productId, value, metadata } = req.body;
      await chatbotService.trackAnalytics({
        event,
        userId,
        sessionId,
        productId,
        value,
        metadata,
        timestamp: new Date(),
      });
      res.json({ status: 'success', message: 'Analytics tracked successfully' });
    } catch (error) {
      console.error('Analytics tracking error:', error);
      res.status(500).json({ status: 'error', message: 'Failed to track analytics' });
    }
  }

  async addToCart(req, res) {
    try {
      const { productId, variantId, quantity = 1, sessionId } = req.body;
      const userId = req.user.id;

      let cart = await Cart.findOne({ userId });
      if (!cart) cart = await Cart.create({ userId });

      const cartItem = await CartItem.create({ cartId: cart._id, productId, variantId, quantity });

      await chatbotService.trackAnalytics({
        event: 'product_added_to_cart',
        userId,
        sessionId,
        productId,
        metadata: { quantity, source: 'chatbot' },
        timestamp: new Date(),
      });

      res.json({ status: 'success', message: 'Product added to cart successfully', data: { cartItem } });
    } catch (error) {
      console.error('Add to cart error:', error);
      res.status(500).json({ status: 'error', message: 'Failed to add product to cart' });
    }
  }

  async handleSimpleMessage(req, res) {
    try {
      const { message } = req.body;
      if (!message?.trim()) return res.status(400).json({ status: 'error', message: 'Message is required' });

      const response = {
        response: `Chào bạn! Bạn vừa nói: "${message}". Tôi là trợ lý AI của Shopmini! 😊`,
        suggestions: ['Tìm sản phẩm hot 🔥', 'Xem khuyến mãi 🎉', 'Sản phẩm bán chạy ⭐', 'Hỗ trợ mua hàng 💬'],
      };

      res.json({ status: 'success', data: response });
    } catch (error) {
      console.error('Simple message error:', error);
      res.status(500).json({ status: 'error', message: 'Failed to process simple message' });
    }
  }

  // Other helper methods (searchProducts, getBestDeals, getTrendingProducts, generateAIResponse, getTemplateResponse)
  // can also be converted in a similar ESM style
}

export default ChatbotController;
