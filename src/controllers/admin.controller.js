// admin.controller.js
import { User, Product, Review, Order } from '../models/index.js';

/**
 * DASHBOARD & STATISTICS
 */
export async function getDashboardStats(req, res) {
  try {
    const now = new Date();

    // Thời gian cho so sánh theo tháng
    const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    // 7 ngày gần đây
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      // Tổng doanh thu (từ trước tới giờ)
      totalRevenueAgg,
      // Doanh thu tháng này
      thisMonthRevenueAgg,
      // Doanh thu tháng trước
      lastMonthRevenueAgg,
      // Đơn hàng mới 7 ngày gần đây
      newOrdersCount,
      // Tổng sản phẩm
      productsCount,
      // Sản phẩm mới trong tháng này
      newProductsCount,
      // Tổng khách hàng (loại trừ admin nếu bạn có field role)
      customersCount,
      // Khách hàng mới trong tháng này
      newCustomersCount,
      // 5 đơn gần nhất
      recentOrders,
      // Nếu có model RepairRequest thì bỏ comment và thêm import
      // serviceRequestsAgg,
    ] = await Promise.all([
      Order.aggregate([
        {
          $group: {
            _id: null,
            total: { $sum: '$totalAmount' },
          },
        },
      ]),

      Order.aggregate([
        {
          $match: {
            createdAt: { $gte: startOfThisMonth },
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$totalAmount' },
          },
        },
      ]),

      Order.aggregate([
        {
          $match: {
            createdAt: {
              $gte: startOfLastMonth,
              $lte: endOfLastMonth,
            },
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$totalAmount' },
          },
        },
      ]),

      Order.countDocuments({ createdAt: { $gte: sevenDaysAgo } }),

      Product.countDocuments({}),
      Product.countDocuments({ createdAt: { $gte: startOfThisMonth } }),

      // Nếu có field role thì lọc bỏ admin:
      // User.countDocuments({ role: { $ne: 'admin' } }),
      User.countDocuments({}),
      User.countDocuments({ createdAt: { $gte: startOfThisMonth } }),

      Order.find({})
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('userId', 'firstName lastName email')
        .lean(),

      // Ví dụ nếu sau này có RepairRequest:
      // RepairRequest.find({}).sort({ createdAt: -1 }).limit(5).lean(),
    ]);

    const totalRevenue = totalRevenueAgg[0]?.total || 0;
    const thisMonthRevenue = thisMonthRevenueAgg[0]?.total || 0;
    const lastMonthRevenue = lastMonthRevenueAgg[0]?.total || 0;

    const revenueChangePercent =
      lastMonthRevenue > 0
        ? ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100
        : null;

    // Tăng trưởng khách hàng tháng này vs tổng
    const customersChangePercent =
      customersCount > 0
        ? (newCustomersCount / customersCount) * 100
        : null;

    // Map recentOrders cho FE dùng ở phần "Đơn hàng gần đây"
    const recentOrdersFormatted = recentOrders.map((o) => ({
      id: o._id,
      orderNumber: o.orderNumber,
      customerName:
        o.shippingAddress?.fullName ||
        `${o.userId?.firstName || ''} ${o.userId?.lastName || ''}`.trim() ||
        o.userId?.email ||
        'Khách lẻ',
      totalAmount: o.totalAmount,
      status: o.status,
      createdAt: o.createdAt,
    }));

    // Nếu có RepairRequest thì có thể map thêm phần này cho "Yêu cầu dịch vụ"
    // const serviceRequests = serviceRequestsAgg.map((r) => ({
    //   id: r._id,
    //   type: r.type,        // ví dụ: 'Bảo hành', 'Sửa chữa', ...
    //   status: r.status,    // ví dụ: 'new' | 'in_progress' | 'completed'
    //   priority: r.priority // ví dụ: 'high' | 'medium' | 'low'
    // }));

    res.status(200).json({
      status: 'success',
      data: {
        // 4 card trên cùng trong FE
        cards: {
          revenue: {
            // Tổng doanh thu (có thể FE format ra ₫xx.xM)
            value: totalRevenue, // number
            thisMonth: thisMonthRevenue,
            lastMonth: lastMonthRevenue,
            changePercent: revenueChangePercent, // để FE render "+12% so với tháng trước"
          },
          newOrders: {
            value: newOrdersCount,
            // bạn có thể tính thêm so sánh với 7 ngày trước đó nếu muốn
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

        // Phần "Đơn hàng gần đây"
        recentOrders: recentOrdersFormatted,

        // Phần "Yêu cầu dịch vụ" – nếu dùng data thật thì mở comment ở trên
        // serviceRequests,
      },
    });
  } catch (err) {
    console.error('getDashboardStats error:', err);
    res.status(500).json({ status: 'error', message: err.message });
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
    // 1) Lấy tất cả user
    const users = await User.find().lean();

    // 2) Gom đơn hàng theo userId
    const stats = await Order.aggregate([
      {
        $group: {
          _id: "$userId",                  // mỗi userId 1 dòng
          orderCount: { $sum: 1 },         // số đơn
          totalSpent: { $sum: "$totalAmount" }, // tổng chi tiêu
        },
      },
    ]);

    // 3) Đưa stats vào map để tra nhanh
    const statsMap = new Map(
      stats.map((s) => [
        s._id?.toString(),                 // key: userId (string)
        { orderCount: s.orderCount, totalSpent: s.totalSpent },
      ])
    );

    // 4) Gộp user + stats
    const usersWithStats = users.map((u) => {
      const st = statsMap.get(u._id.toString()) || {
        orderCount: 0,
        totalSpent: 0,
      };
      return {
        ...u,
        orderCount: st.orderCount,
        totalSpent: st.totalSpent,
      };
    });

    // Có thể trả thẳng mảng hoặc bọc trong { status, data }
    res.status(200).json({
      status: "success",
      data: usersWithStats,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}


async function updateUser(req, res) {
  try {
    const { id } = req.params;
    const user = await User.findByIdAndUpdate(id, req.body, { new: true });
    if (user) {
      res.json(user);
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

async function deleteUser(req, res) {
  try {
    const { id } = req.params;
    const user = await User.findByIdAndDelete(id);
    if (user) {
      res.json({ message: 'User deleted' });
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (err) {
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
};
