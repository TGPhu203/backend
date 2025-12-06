// controllers/chatbot.controller.js
import {
  Product,
  Category,
  Order,
  OrderItem,
  User,
  Cart,
  CartItem,
  Coupon,          // nhớ export Coupon trong models/index.js
} from "../models/index.js";
import chatbotService from "../services/chatbot.service.js";

import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/* ================== KEYWORD + HELPER ================== */

// nhận diện mã đơn hàng kiểu ORD-2511-00025 / ord2511-00025
const ORDER_NUMBER_REGEX = /ord[-\s]?\d{4}-\d{5}/i;

// keyword nghiệp vụ shop
const SHOP_KEYWORDS = [
  "sản phẩm",
  "san pham",
  "đơn hàng",
  "don hang",
  "đặt hàng",
  "dat hang",
  "mua hàng",
  "mua hang",
  "điện thoại",
  "dien thoai",
  "bàn phím",
  "ban phim",
  "giỏ hàng",
  "gio hang",
  "thanh toán",
  "thanh toan",
  "hủy đơn",
  "huy don",
  "theo dõi đơn",
  "theo doi don",
  "vận chuyển",
  "van chuyen",
  "giao hàng",
  "giao hang",
  "ship",
  "phí ship",
  "phi ship",
  "bảo hành",
  "bao hanh",
  "đổi trả",
  "doi tra",
  "bảo trì",
  "bao tri",
  "khuyến mãi",
  "khuyen mai",
  "giảm giá",
  "giam gia",
  "mã giảm giá",
  "ma giam gia",
  "mã ưu đãi",
  "ma uu dai",
  "voucher",
  "đăng nhập",
  "dang nhap",
  "đăng ký",
  "dang ky",
  "tài khoản",
  "tai khoan",
  "quên mật khẩu",
  "quen mat khau",
  "wifi",
  "router",
  "bộ phát",
  "bo phat",
  "camera",
  "camera an ninh",
  "máy in",
  "may in",
  "laptop",
  "pc",
  "máy tính",
  "may tinh",
  "thiết bị mạng",
  "thiet bi mang",
  "trường phúc",
  "truong phuc",
];

const GREETING_KEYWORDS = [
  "chào",
  "xin chào",
  "hi",
  "hello",
  "chao",
  "shop",
  "trường phúc",
  "truong phuc",
];

function normalizeVN(str = "") {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function containsOrderNumber(message = "") {
  return ORDER_NUMBER_REGEX.test(message);
}

function isShopRelated(message = "") {
  const text = normalizeVN(message);

  // có mã đơn hàng => chắc chắn liên quan
  if (containsOrderNumber(message)) return true;

  // chào hỏi -> cho phép
  if (
    GREETING_KEYWORDS.some(
      (k) => normalizeVN(k) && text.includes(normalizeVN(k)),
    )
  ) {
    return true;
  }

  // phải chứa ít nhất 1 keyword nghiệp vụ
  return SHOP_KEYWORDS.some((k) => text.includes(normalizeVN(k)));
}
// Tách keyword sản phẩm từ câu hỏi người dùng
function extractProductKeyword(message = "") {
  let kw = message.trim();

  // bỏ các cụm mở đầu thường gặp
  const patterns = [
    /^tìm( kiếm)?( các)? (sản phẩm|san pham)\s*(là)?\s*/i,
    /^cho mình xem( các)? (sản phẩm|san pham)\s*/i,
    /^mua( các)? (sản phẩm|san pham)\s*/i,
    /^tư vấn( về)?( các)? (sản phẩm|san pham)\s*/i,
  ];
  for (const re of patterns) {
    kw = kw.replace(re, "");
  }

  kw = kw.trim();
  if (!kw) return null;

  return kw;
}
function buildProductSearchFilterFromMessage(message = "") {
  const keyword = extractProductKeyword(message) || message.trim();
  const normalized = normalizeVN(message);

  // luôn chỉ lấy sản phẩm đang active
  const filter = {
    status: "active",
  };

  // 1) Câu kiểu "liệt kê / xem tất cả sản phẩm"
  if (
    (normalized.includes("liet ke") && normalized.includes("san pham")) ||
    normalized.includes("tat ca san pham") ||
    normalized.includes("toan bo san pham")
  ) {
    // không áp regex => lấy toàn bộ sản phẩm active
    return filter;
  }

  // 2) Map nhanh một số nhóm sản phẩm phổ biến
  if (normalized.includes("dien thoai")) {
    filter.$or = [{ name: { $regex: "điện thoại", $options: "i" } }];
    return filter;
  }

  if (normalized.includes("ban phim")) {
    filter.$or = [{ name: { $regex: "bàn phím", $options: "i" } }];
    return filter;
  }

  if (normalized.includes("may tinh")) {
    filter.$or = [{ name: { $regex: "máy tính", $options: "i" } }];
    return filter;
  }

  // 3) Search chung theo tên / mô tả / shortDescription / searchKeywords
  filter.$or = [
    { name: { $regex: keyword, $options: "i" } },
    { description: { $regex: keyword, $options: "i" } },
    { shortDescription: { $regex: keyword, $options: "i" } },
    { searchKeywords: { $in: [new RegExp(keyword, "i")] } },
  ];

  return filter;
}


/* ================== CONTROLLER ================== */

class ChatbotController {
  // ====== HÀM CHÍNH ======
  async handleMessage(req, res) {
    try {
      const { message, userId, sessionId, context = {} } = req.body;

      if (!message?.trim()) {
        return res.status(400).json({
          status: "error",
          message: "Message is required",
        });
      }

      const normalized = normalizeVN(message);

      /* ===========================================
       * 1. LẤY DỮ LIỆU THẬT TỪ DATABASE THEO Ý ĐỊNH
       * ===========================================
       */
      const dbContext = {}; // tất cả data thật đưa vào đây

      // 1.1. Nếu user gửi mã đơn hàng -> lấy thông tin chi tiết 1 đơn
      const orderNumberMatch = message.match(ORDER_NUMBER_REGEX);
      if (orderNumberMatch && userId) {
        const orderNumber = orderNumberMatch[0]
          .toUpperCase()
          .replace(/\s/g, "");

        const order = await Order.findOne({
          orderNumber,
          userId,
        })
          .populate({
            path: "items",
            populate: [
              { path: "productId", select: "name slug thumbnail images" },
              { path: "variantId", select: "name" },
              { path: "warrantyPackageId", select: "name durationMonths price" },
            ],
          })
          .lean();

        dbContext.orderByNumber = order || null;
        dbContext.orderNumberQuery = orderNumber;
      }

      // 1.2. “đơn hàng của tôi / xem đơn hàng” -> lấy danh sách đơn gần đây
      if (
        normalized.includes("don hang cua toi") ||
        normalized.includes("xem don hang") ||
        normalized.includes("lich su mua hang")
      ) {
        if (userId) {
          const orders = await Order.find({ userId })
            .sort({ createdAt: -1 })
            .limit(5)
            .lean();
          dbContext.userRecentOrders = orders;
        } else {
          dbContext.needLoginForOrders = true;
        }
      }

      // 1.3. Hỏi về khuyến mãi / mã giảm giá -> lấy coupon đang active
      if (
        normalized.includes("khuyen mai") ||
        normalized.includes("giam gia") ||
        normalized.includes("voucher") ||
        normalized.includes("ma giam gia") ||
        normalized.includes("ma uu dai")
      ) {
        const now = new Date();
        const coupons = await Coupon.find({
          isActive: true,
          $or: [
            { startDate: null },
            { startDate: { $lte: now } },
          ],
          $or: [
            { endDate: null },
            { endDate: { $gte: now } },
          ],
        })
          .sort({ priority: -1, createdAt: -1 })
          .limit(10)
          .lean();

        dbContext.activeCoupons = coupons;
      }

      // 1.4. Tìm sản phẩm theo keyword (wifi, camera, “tìm sản phẩm …”)
      if (
        normalized.includes("san pham") ||
        normalized.includes("wifi") ||
        normalized.includes("router") ||
        normalized.includes("camera") ||
        normalized.includes("may in") ||
        normalized.includes("laptop") ||
        normalized.includes("pc") ||
        normalized.includes("may tinh") ||
        normalized.includes("thiet bi mang") ||
        normalized.includes("dien thoai") ||
        normalized.includes("ban phim")
      ) {

        // dùng extractSearchParams của bạn nếu có
        const searchParams = chatbotService.extractSearchParams
          ? chatbotService.extractSearchParams(message)
          : { keyword: message };

        const filter = buildProductSearchFilterFromMessage(message);

        if (searchParams.keyword) {
          filter.name = {
            $regex: searchParams.keyword,
            $options: "i",
          };
        }

        if (searchParams.categorySlug) {
          const cat = await Category.findOne({
            slug: searchParams.categorySlug,
          }).lean();
          if (cat) filter.categoryId = cat._id;
        }

        const products = await Product.find(filter)
          .select("name slug price thumbnail images inStock stockQuantity")
          .sort({ createdAt: -1 })
          .limit(20)
          .lean();

        dbContext.productSearch = {
          queryMessage: message,
          filterUsed: filter,
          results: products,
        };
      }

      /* ===========================================
       * 2. NẾU HOÀN TOÀN KHÔNG LIÊN QUAN SHOP
       * ===========================================
       */
      if (!isShopRelated(message) && Object.keys(dbContext).length === 0) {
        return res.json({
          status: "success",
          data: {
            response:
              "Mình chỉ hỗ trợ các nội dung liên quan đến mua sắm tại Trường Phúc (sản phẩm, giá, đơn hàng, khuyến mãi, bảo hành, thanh toán...). " +
              'Bạn hãy thử hỏi: "Hiện có khuyến mãi gì?", "Có loại wifi nào phù hợp nhà 3 tầng?", "Chính sách bảo hành camera như thế nào?"',
            suggestions: [
              "Cho mình xem các sản phẩm Wifi",
              "Khuyến mãi hiện tại là gì?",
              "Chính sách bảo hành tại Trường Phúc?",
              "Hướng dẫn theo dõi đơn hàng của tôi",
            ],
          },
        });
      }

      /* ===========================================
       * 3. GỌI OPENAI – CHO NÓ XEM DB_CONTEXT
       * ===========================================
       */
      const systemPrompt =
        "Bạn là trợ lý AI của cửa hàng Trường Phúc (bán thiết bị công nghệ: wifi, router, camera, máy in, laptop, PC, thiết bị mạng...). " +
        "Bạn PHẢI ưu tiên sử dụng dữ liệu JSON được cung cấp trong phần 'DỮ LIỆU TỪ DATABASE' để trả lời. " +
        "Không tự bịa số liệu sản phẩm, giá, trạng thái đơn hàng hay mã giảm giá nếu không có trong dữ liệu. " +
        "Nếu thiếu dữ liệu thì nói rõ cho khách biết. " +
        "Luôn trả lời bằng tiếng Việt, lịch sự, ngắn gọn, dễ hiểu. " +
        'ĐỊNH DẠNG TRẢ LỜI BẮT BUỘC là JSON: {"answer": "...", "suggestions": ["...", "..."]}.';

      const dbJson = JSON.stringify(dbContext);

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0.4,
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "system",
            content:
              "DỮ LIỆU TỪ DATABASE (JSON, có thể rỗng nếu không tra được gì): " +
              dbJson,
          },
          { role: "user", content: message },
        ],
      });

      let rawText =
        completion.choices?.[0]?.message?.content ??
        '{"answer":"Xin lỗi, hiện không trả lời được.","suggestions":[]}';

      if (Array.isArray(rawText)) {
        rawText = rawText.map((c) => c.text ?? c).join("");
      }

      let parsed;
      try {
        parsed = JSON.parse(rawText);
      } catch {
        parsed = {
          answer:
            typeof rawText === "string"
              ? rawText
              : "Xin lỗi, tôi chưa xử lý được yêu cầu này.",
          suggestions: [
            "Cho mình xem sản phẩm Wifi",
            "Khuyến mãi hiện tại là gì?",
            "Chính sách bảo hành tại Trường Phúc?",
          ],
        };
      }

      const finalResponse = {
        response:
          parsed.answer ||
          parsed.response ||
          "Xin lỗi, tôi chưa xử lý được yêu cầu này.",
        suggestions: Array.isArray(parsed.suggestions)
          ? parsed.suggestions
          : [],
      };

      return res.json({ status: "success", data: finalResponse });
    } catch (error) {
      console.error("Chatbot error:", error);
      return res.status(500).json({
        status: "error",
        message: "Failed to process message",
        data: {
          response:
            "Xin lỗi, tôi đang gặp một chút vấn đề. Vui lòng thử lại sau ít phút nhé! 😅",
          suggestions: ["Xem sản phẩm hot", "Tìm khuyến mãi", "Liên hệ hỗ trợ"],
        },
      });
    }
  }

  // các hàm aiProductSearch, getRecommendations, trackAnalytics, addToCart, handleSimpleMessage
  // có thể giữ nguyên như bạn đang dùng.
}

export default ChatbotController;
