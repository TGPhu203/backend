import { Product, Category, Order, OrderItem, User } from '../models/index.js';

class ChatbotService {
  async analyzeIntent(message) {
    const lowerMessage = message.toLowerCase();

    if (
      this.matchesPatterns(lowerMessage, [
        'tìm', 'kiếm', 'search', 'mua', 'cần', 'muốn', 'có', 'bán', 'shop', 'store', 'sản phẩm',
      ])
    ) {
      return {
        type: 'product_search',
        confidence: 0.8,
        params: this.extractSearchParams(message),
      };
    }

    if (
      this.matchesPatterns(lowerMessage, [
        'gợi ý', 'đề xuất', 'recommend', 'tư vấn', 'nên mua', 'phù hợp', 'hot', 'trend', 'bán chạy', 'mới',
      ])
    ) {
      return { type: 'product_recommendation', confidence: 0.9, params: { type: 'general' } };
    }

    if (
      this.matchesPatterns(lowerMessage, [
        'giá', 'bao nhiêu', 'cost', 'price', 'tiền', 'rẻ', 'đắt', 'sale', 'giảm giá', 'khuyến mãi',
      ])
    ) {
      return { type: 'sales_pitch', confidence: 0.9, params: { focus: 'pricing' } };
    }

    if (
      this.matchesPatterns(lowerMessage, [
        'đơn hàng', 'order', 'mua hàng', 'thanh toán', 'ship', 'giao hàng', 'delivery',
      ])
    ) {
      return { type: 'order_inquiry', confidence: 0.7, params: {} };
    }

    if (
      this.matchesPatterns(lowerMessage, [
        'hỗ trợ', 'help', 'support', 'lỗi', 'problem', 'đổi trả', 'return', 'refund', 'bảo hành',
      ])
    ) {
      return { type: 'support', confidence: 0.8, params: {} };
    }

    return { type: 'general', confidence: 0.5, params: {} };
  }

  extractSearchParams(message) {
    const lowerMessage = message.toLowerCase();
    const params = {};

    const categoryKeywords = {
      áo: ['áo', 'shirt', 'top', 'blouse'],
      quần: ['quần', 'pants', 'jeans', 'trousers'],
      giày: ['giày', 'shoes', 'sneaker', 'boots'],
      túi: ['túi', 'bag', 'backpack', 'handbag'],
      'phụ kiện': ['phụ kiện', 'accessories', 'jewelry', 'watch'],
    };

    for (const [category, keywords] of Object.entries(categoryKeywords)) {
      if (keywords.some((keyword) => lowerMessage.includes(keyword))) {
        params.category = category;
        break;
      }
    }

    const priceMatch = lowerMessage.match(/(\d+)(?:k|000|triệu)?/g);
    if (priceMatch) {
      const prices = priceMatch.map((p) => {
        if (p.includes('k')) return parseInt(p) * 1000;
        if (p.includes('triệu')) return parseInt(p) * 1000000;
        return parseInt(p);
      });

      if (lowerMessage.includes('dưới') || lowerMessage.includes('under')) {
        params.maxPrice = Math.max(...prices);
      } else if (lowerMessage.includes('trên') || lowerMessage.includes('over')) {
        params.minPrice = Math.min(...prices);
      }
    }

    const colors = ['đỏ', 'xanh', 'đen', 'trắng', 'vàng', 'hồng', 'nâu', 'xám'];
    for (const color of colors) {
      if (lowerMessage.includes(color)) {
        params.color = color;
        break;
      }
    }

    const brands = ['nike', 'adidas', 'zara', 'h&m', 'uniqlo'];
    for (const brand of brands) {
      if (lowerMessage.includes(brand)) {
        params.brand = brand;
        break;
      }
    }

    params.keyword = message;
    return params;
  }

  async getUserProfile(userId) {
    try {
      const user = await User.findById(userId).populate({
        path: 'orders',
        options: { limit: 10, sort: { createdAt: -1 } },
        populate: {
          path: 'items',
          populate: { path: 'product' }
        }
      });

      if (!user) return null;

      const purchaseHistory = [];
      const categoryPreferences = {};
      const priceRange = { min: Infinity, max: 0 };

      user.orders?.forEach((order) => {
        order.items?.forEach((item) => {
          if (item.product) {
            purchaseHistory.push(item.product);
            item.product.categories?.forEach((cat) => {
              categoryPreferences[cat.name] = (categoryPreferences[cat.name] || 0) + 1;
            });
            if (item.product.price < priceRange.min) priceRange.min = item.product.price;
            if (item.product.price > priceRange.max) priceRange.max = item.product.price;
          }
        });
      });

      return {
        id: user._id,
        name: user.firstName + ' ' + user.lastName,
        email: user.email,
        purchaseHistory,
        categoryPreferences,
        priceRange: priceRange.min === Infinity ? null : priceRange,
        orderCount: user.orders?.length || 0,
        isVip: (user.orders?.length || 0) >= 5,
      };
    } catch (error) {
      console.error('Error getting user profile:', error);
      return null;
    }
  }

  async getPersonalizedRecommendations(userId, params = {}) {
    try {
      const { type = 'personal', limit = 5 } = params;
      let products = [];

      if (type === 'personal' && userId) {
        const userProfile = await this.getUserProfile(userId);
        if (userProfile?.categoryPreferences) {
          const preferredCategories = Object.keys(userProfile.categoryPreferences);
          products = await Product.find({
            status: 'active',
            inStock: true,
            categories: { $in: preferredCategories }
          })
          .populate('categories')
          .limit(limit * 2)
          .sort({ createdAt: -1 });

          const purchasedProductIds = userProfile.purchaseHistory.map((p) => p._id.toString());
          products = products.filter((p) => !purchasedProductIds.includes(p._id.toString()));
        }
      }

      if (products.length < limit) {
        const fallbackProducts = await Product.find({
          status: 'active',
          inStock: true,
          $or: [{ featured: true }, { compareAtPrice: { $gt: 0 } }]
        })
        .sort({ featured: -1, createdAt: -1 })
        .limit(limit - products.length);

        products = [...products, ...fallbackProducts];
      }

      return products.slice(0, limit).map((product) => ({
        id: product._id,
        name: product.name,
        price: product.price,
        compareAtPrice: product.compareAtPrice,
        thumbnail: product.thumbnail,
        inStock: product.inStock,
        rating: 4.5,
        discount: product.compareAtPrice ? Math.round(((product.compareAtPrice - product.price) / product.compareAtPrice) * 100) : 0,
      }));
    } catch (error) {
      console.error('Error getting recommendations:', error);
      return [];
    }
  }

  async generateSalesPitch({ userProfile, message, bestDeals, trendingProducts, context }) {
    try {
      const templates = this.getSalesPitchTemplates();
      const pitchType = this.selectPitchType(userProfile, message, context);

      let pitch = templates[pitchType];
      let products = [];

      switch (pitchType) {
        case 'urgency':
          products = bestDeals.slice(0, 3);
          pitch = pitch.replace('{discount}', products[0]?.discount || '50%');
          break;
        case 'personal':
          products = await this.getPersonalizedRecommendations(userProfile?.id, { limit: 3 });
          pitch = pitch.replace('{name}', userProfile?.name || 'bạn');
          break;
        case 'social_proof':
          products = trendingProducts.slice(0, 3);
          break;
        case 'value':
          products = bestDeals.slice(0, 3);
          const totalSavings = products.reduce((sum, p) => sum + (p.compareAtPrice - p.price), 0);
          pitch = pitch.replace('{savings}', this.formatPrice(totalSavings));
          break;
        default:
          products = [...bestDeals.slice(0, 2), ...trendingProducts.slice(0, 1)];
      }

      return { text: pitch, products, type: pitchType };
    } catch (error) {
      console.error('Error generating sales pitch:', error);
      return { text: '🌟 Chúng tôi có nhiều sản phẩm tuyệt vời đang được khuyến mãi! Bạn có muốn xem không?', products: bestDeals.slice(0, 3), type: 'fallback' };
    }
  }

  async findSalesOpportunity(message, userProfile) {
    const lowerMessage = message.toLowerCase();
    const salesKeywords = ['chán', 'buồn', 'stress', 'mệt', 'cuối tuần', 'weekend', 'rảnh', 'shopping', 'mua sắm', 'tiền', 'sinh nhật', 'party', 'date', 'work', 'công việc', 'interview'];
    const opportunity = salesKeywords.find((keyword) => lowerMessage.includes(keyword));
    if (opportunity) return { found: true, intent: { type: 'sales_pitch', confidence: 0.7, params: { trigger: opportunity } } };
    return { found: false };
  }

  async trackConversation(data) {
    try { console.log('Tracking conversation:', data); } catch (error) { console.error('Error tracking conversation:', error); }
  }

  async trackAnalytics(data) {
    try { console.log('Tracking analytics:', data); } catch (error) { console.error('Error tracking analytics:', error); }
  }

  matchesPatterns(text, patterns) {
    return patterns.some((pattern) => text.includes(pattern));
  }

  getSalesPitchTemplates() {
    return {
      urgency: '⏰ CẢNH BÁO: Chỉ còn vài giờ để nhận ưu đãi {discount}! Đừng bỏ lỡ cơ hội này nhé! 🔥',
      personal: 'Chào {name}! 😊 Dựa trên sở thích của bạn, tôi có một vài sản phẩm tuyệt vời muốn giới thiệu!',
      social_proof: '🌟 Những sản phẩm này đang được rất nhiều khách hàng yêu thích và mua! Bạn cũng thử xem nhé!',
      value: '💎 Cơ hội tuyệt vời! Bạn có thể tiết kiệm tới {savings} với các deal hôm nay!',
      scarcity: '⚡ Chỉ còn số lượng có hạn! Nhiều khách hàng đang quan tâm đến những sản phẩm này!',
      seasonal: '🎉 Ưu đãi đặc biệt mùa này! Đây là thời điểm tốt nhất để shopping đấy!',
    };
  }

  selectPitchType(userProfile, message, context) {
    const lowerMessage = message.toLowerCase();
    if (userProfile?.isVip) return 'personal';
    if (lowerMessage.includes('giá') || lowerMessage.includes('rẻ')) return 'value';
    if (lowerMessage.includes('hot') || lowerMessage.includes('trend')) return 'social_proof';
    if (context.timeOfDay === 'evening') return 'urgency';
    const types = ['urgency', 'social_proof', 'value', 'scarcity'];
    return types[Math.floor(Math.random() * types.length)];
  }

  formatPrice(price) {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
  }
}

export default new ChatbotService();
