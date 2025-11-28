// admin.controller.js
import { User, Product, Review, Order } from '../models/index.js';

/**
 * DASHBOARD & STATISTICS
 */
export async function getDashboardStats(req, res) {
  try {
    const now = new Date();

    const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // 👉 CHỈ ĐƠN ĐÃ THANH TOÁN THÀNH CÔNG
    const paidOrderMatch = {
      $or: [
        { paymentStatus: "paid" },                     // PayOS / online paid
        { paymentMethod: "cod", status: "completed" }, // COD đã giao thành công
      ],
      paymentStatus: { $ne: "refunded" },              // loại đơn đã hoàn tiền
    };

    const [
      totalRevenueAgg,
      thisMonthRevenueAgg,
      lastMonthRevenueAgg,
      newOrdersCount,
      productsCount,
      newProductsCount,
      customersCount,
      newCustomersCount,
      recentOrders,
    ] = await Promise.all([
      // Tổng doanh thu – chỉ đơn đã thanh toán
      Order.aggregate([
        { $match: paidOrderMatch },
        {
          $group: {
            _id: null,
            total: { $sum: "$totalAmount" },
          },
        },
      ]),

      // Doanh thu tháng này
      Order.aggregate([
        {
          $match: {
            ...paidOrderMatch,
            createdAt: { $gte: startOfThisMonth },
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: "$totalAmount" },
          },
        },
      ]),

      // Doanh thu tháng trước
      Order.aggregate([
        {
          $match: {
            ...paidOrderMatch,
            createdAt: {
              $gte: startOfLastMonth,
              $lte: endOfLastMonth,
            },
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: "$totalAmount" },
          },
        },
      ]),

      // Số đơn mới 7 ngày gần đây – tuỳ bạn muốn tính tất cả hay chỉ đơn đã thanh toán
      Order.countDocuments({
        createdAt: { $gte: sevenDaysAgo },
        ...paidOrderMatch, // nếu chỉ muốn tính đơn đã thanh toán
      }),

      Product.countDocuments({}),
      Product.countDocuments({ createdAt: { $gte: startOfThisMonth } }),

      User.countDocuments({}),
      User.countDocuments({ createdAt: { $gte: startOfThisMonth } }),

      // Đơn gần đây, thường mình muốn xem cả pending, nên có 2 lựa chọn:
      //  (a) chỉ đơn đã thanh toán: .find({...paidOrderMatch})
      //  (b) tất cả đơn: .find({})
      Order.find({ ...paidOrderMatch })
        .sort({ createdAt: -1 })
        .limit(5)
        .populate("userId", "firstName lastName email")
        .lean(),
    ]);

    const totalRevenue = totalRevenueAgg[0]?.total || 0;
    const thisMonthRevenue = thisMonthRevenueAgg[0]?.total || 0;
    const lastMonthRevenue = lastMonthRevenueAgg[0]?.total || 0;

    const revenueChangePercent =
      lastMonthRevenue > 0
        ? ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100
        : null;

    const customersChangePercent =
      customersCount > 0 ? (newCustomersCount / customersCount) * 100 : null;

    const recentOrdersFormatted = recentOrders.map((o) => ({
      id: o._id,
      orderNumber: o.orderNumber,
      customerName:
        o.shippingAddress?.fullName ||
        `${o.userId?.firstName || ""} ${o.userId?.lastName || ""}`.trim() ||
        o.userId?.email ||
        "Khách lẻ",
      totalAmount: o.totalAmount,
      status: o.status,
      createdAt: o.createdAt,
    }));

    res.status(200).json({
      status: "success",
      data: {
        cards: {
          revenue: {
            value: totalRevenue,
            thisMonth: thisMonthRevenue,
            lastMonth: lastMonthRevenue,
            changePercent: revenueChangePercent,
          },
          newOrders: {
            value: newOrdersCount,
          },
          products: {
            value: productsCount,
            newThisMonth: newProductsCount,
          },
          customers: {
            value: customersCount,
            newThisMonth: newCustomersCount,
            changePercent: customersChangePercent,
          },
        },
        recentOrders: recentOrdersFormatted,
      },
    });
  } catch (err) {
    console.error("getDashboardStats error:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
}


export async function getDetailedStats(req, res) {
  try {
    // Nếu cần thống kê chi tiết hơn, có thể mở rộng ở đây
    const data = {};
    res.status(200).json({ status: 'success', data });
  } catch (err) {
    console.error('getDetailedStats error:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
}

/**
 * USER MANAGEMENT
 */
async function getAllUsers(req, res) {
  try {
    const users = await User.find({ role: "customer" })   // 👈 chỉ lấy khách hàng
      .select(
        "firstName lastName email phone loyaltyTier loyaltyPoints role createdAt isBlocked"
      )
      .lean();


    const userIds = users.map((u) => u._id);

    const stats = await Order.aggregate([
      {
        $match: {
          userId: { $in: userIds },
          $or: [
            { paymentStatus: "paid", status: { $ne: "cancelled" } },
            { paymentMethod: "cod", status: "completed" },
          ],
          paymentStatus: { $ne: "refunded" },
        },
      },
      {
        $group: {
          _id: "$userId",
          orderCount: { $sum: 1 },
          totalSpent: { $sum: "$totalAmount" },
        },
      },
    ]);

    const statsMap = new Map(
      stats.map((s) => [
        s._id.toString(),
        { orderCount: s.orderCount, totalSpent: s.totalSpent },
      ])
    );

    const usersWithStats = users.map((u) => {
      const st =
        statsMap.get(u._id.toString()) || {
          orderCount: 0,
          totalSpent: 0,
        };

      const mergedTotalSpent = st.totalSpent || 0;

      return {
        _id: u._id,
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
        phone: u.phone,
        orderCount: st.orderCount,
        totalSpent: mergedTotalSpent,
        loyaltyTier: u.loyaltyTier || "none",
        loyaltyPoints: u.loyaltyPoints || 0,
        role: u.role,
        createdAt: u.createdAt,
        isBlocked: u.isBlocked || false,
      };
    });

    res.status(200).json({
      status: "success",
      data: usersWithStats,
    });
  } catch (err) {
    console.error("getAllUsers error:", err);
    res
      .status(500)
      .json({ status: "error", message: err.message || "Lỗi server" });
  }
}


async function updateUser(req, res) {
  try {
    const { id } = req.params;
    const user = await User.findByIdAndUpdate(id, req.body, { new: true });
    if (user) {
      res.json(user);
    } else {
      res.status(404).json({ message: "User not found" });
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}
async function deleteUser(req, res) {
  try {
    const { id } = req.params;

    // không cho tự xoá chính mình
    if (req.user?.id && req.user.id === id) {
      return res
        .status(400)
        .json({ message: "Bạn không thể tự xóa tài khoản của chính mình" });
    }

    const user = await User.findByIdAndDelete(id);
    if (user) {
      res.json({ message: "User deleted" });
    } else {
      res.status(404).json({ message: "User not found" });
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// 🔒 Khóa tài khoản
async function blockUser(req, res) {
  try {
    const { id } = req.params;

    // không cho tự khóa chính mình
    if (req.user?.id && req.user.id === id) {
      return res
        .status(400)
        .json({ message: "Bạn không thể tự khóa tài khoản của chính mình" });
    }

    const user = await User.findByIdAndUpdate(
      id,
      { isBlocked: true },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({
      status: "success",
      data: user,
    });
  } catch (err) {
    console.error("blockUser error:", err);
    res.status(500).json({ message: err.message });
  }
}

// 🔓 Mở khóa tài khoản
async function unblockUser(req, res) {
  try {
    const { id } = req.params;

    const user = await User.findByIdAndUpdate(
      id,
      { isBlocked: false },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({
      status: "success",
      data: user,
    });
  } catch (err) {
    console.error("unblockUser error:", err);
    res.status(500).json({ message: err.message });
  }
}

/**
 * PRODUCT MANAGEMENT
 */
async function getAllProducts(req, res) {
  try {
    const products = await Product.find();
    res.json(products);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

async function getProductById(req, res) {
  try {
    const { id } = req.params;
    const product = await Product.findById(id);
    if (product) res.json(product);
    else res.status(404).json({ message: 'Product not found' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

async function createProduct(req, res) {
  try {
    const product = new Product(req.body);
    await product.save();
    res.status(201).json(product);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

async function updateProduct(req, res) {
  try {
    const { id } = req.params;
    const product = await Product.findByIdAndUpdate(id, req.body, { new: true });
    if (product) {
      res.json(product);
    } else {
      res.status(404).json({ message: 'Product not found' });
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

async function deleteProduct(req, res) {
  try {
    const { id } = req.params;
    const product = await Product.findByIdAndDelete(id);
    if (product) res.json({ message: 'Product deleted' });
    else res.status(404).json({ message: 'Product not found' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

/**
 * REVIEW MANAGEMENT
 */
async function getAllReviews(req, res) {
  try {
    const reviews = await Review.find();
    res.json(reviews);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

async function deleteReview(req, res) {
  try {
    const { id } = req.params;
    const review = await Review.findByIdAndDelete(id);
    if (review) res.json({ message: 'Review deleted' });
    else res.status(404).json({ message: 'Review not found' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

/**
 * ORDER MANAGEMENT
 */
async function getAllOrders(req, res) {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      paymentStatus,
      search,
      sort = 'createdAt',
      order = 'DESC',
    } = req.query;

    const query = {};
    if (status) query.status = status;
    if (paymentStatus) query.paymentStatus = paymentStatus;
    if (search) {
      query.$or = [
        { orderNumber: { $regex: search, $options: 'i' } },
        { 'shippingAddress.fullName': { $regex: search, $options: 'i' } },
      ];
    }

    const sortOptions = {};
    sortOptions[sort] = order === 'DESC' ? -1 : 1;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [orders, total] = await Promise.all([
      Order.find(query)
        .populate('userId', 'firstName lastName email')  // 👈 lấy tên + email
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Order.countDocuments(query),
    ]);

    res.status(200).json({
      status: 'success',
      data: {
        orders,
        total,
        pages: Math.ceil(total / limit),
        currentPage: parseInt(page),
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}


async function updateOrderStatus(req, res) {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const order = await Order.findByIdAndUpdate(id, { status }, { new: true });
    if (order) {
      res.json(order);
    } else {
      res.status(404).json({ message: 'Order not found' });
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// Export default controller
export default {
  getDashboardStats,
  getDetailedStats,
  getAllUsers,
  updateUser,
  deleteUser,
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  getAllReviews,
  deleteReview,
  getAllOrders,
  updateOrderStatus,
  unblockUser,
  blockUser,
};
