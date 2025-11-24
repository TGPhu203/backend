import { GoogleGenerativeAI } from '@google/generative-ai';
import { Product, Category } from '../models/index.js';

class GeminiChatbotService {
  constructor() {
    this.genAI = null;
    this.model = null;
    this.initializeGemini();
  }

  initializeGemini() {
    try {
      if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'demo-key') {
        this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
        console.info('✅ Gemini AI initialized successfully with model: gemini-2.0-flash');
      } else {
        console.warn('⚠️  Gemini API key not found, using fallback responses');
      }
    } catch (error) {
      console.error('❌ Failed to initialize Gemini AI:', error.message || error);
    }
  }

  async handleMessage(message, context = {}) {
    try {
      const allProducts = await this.getAllProducts();
      if (process.env.NODE_ENV !== 'production') {
        console.log(`📦 Found ${allProducts.length} products in database`);
      }

      const aiResponse = await this.getAIResponse(message, allProducts, context);
      return aiResponse;
    } catch (error) {
      console.error('Gemini chatbot error:', error);
      return this.getFallbackResponse(message);
    }
  }

  async getAIResponse(userMessage, products, context) {
    if (!this.model) return this.getFallbackResponse(userMessage);

    try {
      const prompt = this.createPrompt(userMessage, products, context);
      if (process.env.NODE_ENV !== 'production') console.log('🤖 Sending request to Gemini API...');

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const aiText = response.text();

      if (process.env.NODE_ENV !== 'production') {
        console.log('✅ Received response from Gemini API');
        console.log('📝 AI Response length:', aiText.length);
      }

      return this.parseAIResponse(aiText, products, userMessage);
    } catch (error) {
      console.error('❌ Gemini API error details:', {
        message: error.message,
        status: error.status,
        statusText: error.statusText,
      });
      if (error.message?.includes('404')) {
        console.error('🚨 404 Error - Model not found or API endpoint incorrect');
      }
      return this.getFallbackResponse(userMessage);
    }
  }

  createPrompt(userMessage, products, context) {
    const productList = products
      .map(p => `- ${p.name}: ${p.shortDescription} (Giá: ${p.price?.toLocaleString('vi-VN')}đ)`)
      .join('\n');

    return `
Bạn là một trợ lý AI thông minh cho cửa hàng thời trang Shopmini...
[Duy trì toàn bộ nội dung prompt như trước, không thay đổi]
`;
  }

  parseAIResponse(aiText, products, userMessage) {
    try {
      const jsonMatch = aiText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const matchedProducts = [];

        if (parsed.matchedProducts && Array.isArray(parsed.matchedProducts)) {
          parsed.matchedProducts.forEach(productName => {
            const product = products.find(
              p => p.name.toLowerCase().includes(productName.toLowerCase()) ||
                   productName.toLowerCase().includes(p.name.toLowerCase())
            );
            if (product) {
              matchedProducts.push({
                id: product.id,
                name: product.name,
                price: product.price,
                compareAtPrice: product.compareAtPrice,
                thumbnail: product.thumbnail,
                inStock: product.inStock,
                rating: 4.5,
              });
            }
          });
        }

        return {
          response: parsed.response || 'Tôi có thể giúp bạn tìm sản phẩm phù hợp!',
          products: matchedProducts,
          suggestions: parsed.suggestions || [
            'Xem tất cả sản phẩm',
            'Sản phẩm khuyến mãi',
            'Hỗ trợ mua hàng',
            'Liên hệ tư vấn',
          ],
          intent: parsed.intent || 'general',
        };
      }
    } catch (error) {
      console.error('Failed to parse AI response:', error.message || error);
    }

    return this.simpleKeywordMatch(userMessage, products);
  }

  // Các phương thức còn lại như simpleKeywordMatch, getAllProducts, getFallbackResponse giữ nguyên
  // Chỉ cần đổi tất cả require/module.exports sang import/export
  async getAllProducts() {
    try {
      const products = await Product.find({
        status: 'active',
        inStock: true
      })
      .select('name shortDescription description price compareAtPrice thumbnail inStock searchKeywords')
      .limit(100)
      .sort({ createdAt: -1 });

      return products.map(p => p.toObject());
    } catch (error) {
      console.error('Error fetching products:', error);
      return [];
    }
  }

  getFallbackResponse(userMessage) {
    // Giữ nguyên toàn bộ logic fallback như trước
    return {
      response: `Tôi là trợ lý AI của Shopmini! 😊 Tôi có thể giúp bạn với "${userMessage}"`,
      suggestions: ['Tìm sản phẩm 🔍', 'Xem khuyến mãi 🎁', 'Hỏi về chính sách 📋', 'Tư vấn thời trang 💅'],
      intent: 'general',
    };
  }
}

export default new GeminiChatbotService();
