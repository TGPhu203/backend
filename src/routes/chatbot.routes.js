import express from 'express';
import ChatbotController from '../controllers/chatbot.controller.js';
import { authenticate } from '../middlewares/authenticate.js';

const router = express.Router();
const chatbotController = new ChatbotController();

/**
 * @swagger
 * tags:
 *   name: Chatbot
 *   description: AI Chatbot for sales and customer support
 */

router.post('/message', (req, res) => chatbotController.handleMessage(req, res));
router.post('/products/search', (req, res) => chatbotController.aiProductSearch(req, res));
router.get('/recommendations', (req, res) => chatbotController.getRecommendations(req, res));
router.post('/analytics', (req, res) => chatbotController.trackAnalytics(req, res));
router.post('/cart/add', authenticate, (req, res) => chatbotController.addToCart(req, res));

// Test endpoints
router.get('/test', (req, res) => {
  res.json({
    status: 'success',
    message: 'Chatbot API is working!',
    timestamp: new Date().toISOString(),
  });
});

router.post('/test-message', async (req, res) => {
  try {
    const { message } = req.body;
    res.json({
      status: 'success',
      data: {
        response: `Bạn vừa nói: "${message}". Tôi đã nhận được tin nhắn! 😊`,
        suggestions: ['Tìm sản phẩm', 'Xem khuyến mãi', 'Liên hệ hỗ trợ'],
      },
    });
  } catch (error) {
    console.error('Test message error:', error);
    res.status(500).json({ status: 'error', message: 'Test failed' });
  }
});

router.post('/simple-message', (req, res) => chatbotController.handleSimpleMessage(req, res));

export default router;
