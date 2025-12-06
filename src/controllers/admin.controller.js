// admin.controller.js
import { User, Product, Review, Order, Attendance, Payroll,AppError } from '../models/index.js';
import ExcelJS from "exceljs";
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
// controllers/adminUser.controller.js
export const createSupportUser = async (req, res, next) => {
  try {
    const { email, password, firstName, lastName, phone } = req.body;

    const exists = await User.findOne({ email });
    if (exists) throw new AppError("Email đã được sử dụng", 400);

    const user = new User({
      email,
      password,
      firstName,
      lastName,
      phone,
      role: "support",              // fix role
      isEmailVerified: true,        // nếu tạo nội bộ
    });

    await user.save();

    res.status(201).json({
      status: "success",
      data: user.toJSON(),
    });
  } catch (err) {
    next(err);
  }
};
/**
 * SUPPORT STAFF MANAGEMENT
 */
async function getSupportUsers(req, res) {
  try {
    const users = await User.find({ role: "support" })
      .select(
        "firstName lastName email phone role createdAt isBlocked"
      )
      .lean();

    res.status(200).json({
      status: "success",
      data: users,
    });
  } catch (err) {
    console.error("getSupportUsers error:", err);
    res
      .status(500)
      .json({ status: "error", message: err.message || "Lỗi server" });
  }
}
async function getEmployees(req, res) {
  try {
    const roles = ["admin", "manager", "support"]; // support = CSKH
    const employees = await User.find({ role: { $in: roles } })
      .select(
        "firstName lastName email phone role baseSalary salaryType isBlocked createdAt"
      )
      .lean();

    res.status(200).json({ status: "success", data: employees });
  } catch (err) {
    console.error("getEmployees error:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
}


// Tạo mới nhân viên
async function createEmployee(req, res) {
  try {
    const { email, password, firstName, lastName, phone, role, baseSalary, salaryType } = req.body;

    const exists = await User.findOne({ email });
    if (exists) {
      return res.status(400).json({ status: "error", message: "Email đã được sử dụng" });
    }

    // role chỉ cho phép trong nhóm nhân viên
    const allowedRoles = ["admin", "manager", "support"];
    const safeRole = allowedRoles.includes(role) ? role : "support";

    const user = new User({
      email,
      password,
      firstName,
      lastName,
      phone,
      role: safeRole,
      isEmailVerified: true,
      baseSalary: baseSalary ?? 0,
      salaryType: salaryType || "monthly",
    });

    await user.save();

    res.status(201).json({
      status: "success",
      data: user.toJSON(),
    });
  } catch (err) {
    console.error("createEmployee error:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
}

// Cập nhật thông tin / lương nhân viên
async function updateEmployee(req, res) {
  try {
    const { id } = req.params;

    const allowedFields = [
      "firstName",
      "lastName",
      "phone",
      "role",
      "baseSalary",
      "salaryType",
      "isBlocked",
    ];

    const update = {};
    for (const key of allowedFields) {
      if (req.body[key] !== undefined) update[key] = req.body[key];
    }

    const user = await User.findByIdAndUpdate(id, update, { new: true });
    if (!user) {
      return res.status(404).json({ status: "error", message: "User not found" });
    }

    res.status(200).json({ status: "success", data: user });
  } catch (err) {
    console.error("updateEmployee error:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
}
/**
 * ATTENDANCE (CHẤM CÔNG)
 */

// chuẩn hoá ngày về 00:00 để unique (userId + date)
function normalizeDateToDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Check-in cho nhân viên (dùng cho chính nhân viên hoặc admin chấm hộ)
async function checkIn(req, res) {
  try {
    const { userId } = req.body;
    const currentUserId = req.user?.id;

    const targetUserId = userId || currentUserId;
    if (!targetUserId) {
      return res.status(400).json({ status: "error", message: "Thiếu userId" });
    }

    const now = new Date();
    const day = normalizeDateToDay(now);

    let attendance = await Attendance.findOne({ userId: targetUserId, date: day });

    if (!attendance) {
      attendance = new Attendance({
        userId: targetUserId,
        date: day,
        checkIn: now,
        status: "present",
      });
    } else {
      // Nếu đã có checkIn thì không cho check lại
      if (attendance.checkIn) {
        return res.status(400).json({
          status: "error",
          message: "Hôm nay đã check-in rồi",
        });
      }
      attendance.checkIn = now;
      attendance.status = "present";
    }

    // Ví dụ: đi muộn nếu sau 9:15
    const shiftStart = new Date(day);
    shiftStart.setHours(9, 15, 0, 0);
    if (now > shiftStart) {
      attendance.status = "late";
    }

    await attendance.save();

    res.status(200).json({
      status: "success",
      data: attendance,
    });
  } catch (err) {
    console.error("checkIn error:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
}

// Check-out + tính số giờ làm
async function checkOut(req, res) {
  try {
    const { userId } = req.body;
    const currentUserId = req.user?.id;

    const targetUserId = userId || currentUserId;
    if (!targetUserId) {
      return res.status(400).json({ status: "error", message: "Thiếu userId" });
    }

    const now = new Date();
    const day = normalizeDateToDay(now);

    const attendance = await Attendance.findOne({ userId: targetUserId, date: day });

    if (!attendance || !attendance.checkIn) {
      return res.status(400).json({
        status: "error",
        message: "Chưa check-in nên không thể check-out",
      });
    }

    // nếu đã checkout rồi
    if (attendance.checkOut) {
      return res.status(400).json({
        status: "error",
        message: "Hôm nay đã check-out rồi",
      });
    }

    attendance.checkOut = now;

    const diffMs = attendance.checkOut.getTime() - attendance.checkIn.getTime();
    const hours = diffMs / (1000 * 60 * 60);
    attendance.workHours = Number(hours.toFixed(2));

    await attendance.save();

    res.status(200).json({
      status: "success",
      data: attendance,
    });
  } catch (err) {
    console.error("checkOut error:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
}

// Lấy bảng chấm công theo user + khoảng thời gian
async function getAttendance(req, res) {
  try {
    const { userId, from, to } = req.query;

    const query = {};
    if (userId) query.userId = userId;

    if (from || to) {
      query.date = {};
      if (from) query.date.$gte = normalizeDateToDay(new Date(from));
      if (to) query.date.$lte = normalizeDateToDay(new Date(to));
    }

    const data = await Attendance.find(query)
      .populate("userId", "firstName lastName email")
      .sort({ date: -1 })
      .lean();

    res.status(200).json({
      status: "success",
      data,
    });
  } catch (err) {
    console.error("getAttendance error:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
}
/**
 * PAYROLL (BẢNG LƯƠNG)
 */

const STANDARD_WORK_DAYS = 30; // số ngày công chuẩn (tuỳ bạn)

async function generatePayroll(req, res) {
  try {
    const { userId, month, year, bonus = 0, deductions = 0 } = req.body;

    if (!userId || !month || !year) {
      return res
        .status(400)
        .json({ status: "error", message: "Thiếu userId / month / year" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ status: "error", message: "User not found" });
    }

    const m = Number(month) - 1; // JS month 0-11
    const start = new Date(Number(year), m, 1);
    const end = new Date(Number(year), m + 1, 0);
    end.setHours(23, 59, 59, 999);

    // Lấy tất cả chấm công trong tháng
    const attendances = await Attendance.find({
      userId,
      date: { $gte: normalizeDateToDay(start), $lte: normalizeDateToDay(end) },
    }).lean();

    const totalWorkDays = attendances.filter(
      (a) => a.status !== "absent"
    ).length;

    const totalWorkHours = attendances.reduce(
      (sum, a) => sum + (a.workHours || 0),
      0
    );

    const baseSalary = user.baseSalary || 0;
    let finalSalary = 0;

    if (user.salaryType === "monthly") {
      const ratio =
        STANDARD_WORK_DAYS > 0
          ? totalWorkDays / STANDARD_WORK_DAYS
          : 0;
      finalSalary = Math.round(baseSalary * ratio + bonus - deductions);
    } else {
      // hourly: baseSalary là lương theo giờ
      finalSalary = Math.round(baseSalary * totalWorkHours + bonus - deductions);
    }

    // tìm hoặc tạo mới
    let payroll = await Payroll.findOne({ userId, month: Number(month), year: Number(year) });

    if (!payroll) {
      payroll = new Payroll({
        userId,
        month: Number(month),
        year: Number(year),
        totalWorkDays,
        totalWorkHours,
        baseSalary,
        bonus,
        deductions,
        finalSalary,
      });
    } else {
      payroll.totalWorkDays = totalWorkDays;
      payroll.totalWorkHours = totalWorkHours;
      payroll.baseSalary = baseSalary;
      payroll.bonus = bonus;
      payroll.deductions = deductions;
      payroll.finalSalary = finalSalary;
    }

    await payroll.save();

    res.status(200).json({
      status: "success",
      data: payroll,
    });
  } catch (err) {
    console.error("generatePayroll error:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
}

// Lấy bảng lương (filter theo user/tháng/năm)
async function getPayrolls(req, res) {
  try {
    const { userId, month, year } = req.query;

    const query = {};
    if (userId) query.userId = userId;
    if (month) query.month = Number(month);
    if (year) query.year = Number(year);

    const data = await Payroll.find(query)
      .populate("userId", "firstName lastName email")
      .sort({ year: -1, month: -1 })
      .lean();

    res.status(200).json({
      status: "success",
      data,
    });
  } catch (err) {
    console.error("getPayrolls error:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
}

// Đánh dấu đã trả lương
async function markPayrollPaid(req, res) {
  try {
    const { id } = req.params;

    const payroll = await Payroll.findByIdAndUpdate(
      id,
      { status: "paid", paidAt: new Date() },
      { new: true }
    );

    if (!payroll) {
      return res.status(404).json({ status: "error", message: "Payroll not found" });
    }

    res.status(200).json({
      status: "success",
      data: payroll,
    });
  } catch (err) {
    console.error("markPayrollPaid error:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
}
// Xuất Excel bảng lương
async function exportPayrollReport(req, res) {
  try {
    const { userId, month, year } = req.query;

    if (!month || !year) {
      return res
        .status(400)
        .json({ status: "error", message: "Thiếu month / year" });
    }

    const query = {
      month: Number(month),
      year: Number(year),
    };
    if (userId) query.userId = userId;

    const data = await Payroll.find(query)
      .populate("userId", "firstName lastName email role")
      .sort({ year: -1, month: -1 })
      .lean();

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Bang luong");

    sheet.columns = [
      { header: "STT", key: "stt", width: 6 },
      { header: "Họ tên", key: "name", width: 25 },
      { header: "Email", key: "email", width: 28 },
      { header: "Vai trò", key: "role", width: 12 },
      { header: "Tháng", key: "month", width: 8 },
      { header: "Năm", key: "year", width: 8 },
      { header: "Ngày công", key: "days", width: 10 },
      { header: "Giờ làm", key: "hours", width: 10 },
      { header: "Lương cơ bản", key: "baseSalary", width: 15 },
      { header: "Thưởng", key: "bonus", width: 12 },
      { header: "Khấu trừ", key: "deductions", width: 12 },
      { header: "Thực lĩnh", key: "finalSalary", width: 15 },
      { header: "Trạng thái", key: "status", width: 12 },
      { header: "Ngày trả", key: "paidAt", width: 18 },
    ];

    data.forEach((p, index) => {
      sheet.addRow({
        stt: index + 1,
        name: `${p.userId?.firstName || ""} ${p.userId?.lastName || ""}`.trim(),
        email: p.userId?.email || "",
        role: p.userId?.role || "",
        month: p.month,
        year: p.year,
        days: p.totalWorkDays,
        hours: p.totalWorkHours?.toFixed(2),
        baseSalary: p.baseSalary || 0,
        bonus: p.bonus || 0,
        deductions: p.deductions || 0,
        finalSalary: p.finalSalary || 0,
        status: p.status === "paid" ? "Đã trả" : "Chưa trả",
        paidAt: p.paidAt
          ? new Date(p.paidAt).toLocaleString("vi-VN")
          : "",
      });
    });

    // style header
    sheet.getRow(1).font = { bold: true };

    const buffer = await workbook.xlsx.writeBuffer();
    const fileName = `bang-luong-thang-${month}-${year}.xlsx`;

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${fileName}"`
    );

    res.send(Buffer.from(buffer));
  } catch (err) {
    console.error("exportPayrollReport error:", err);
    res.status(500).json({ status: "error", message: err.message });
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
  createSupportUser,
  getSupportUsers,
  // NEW: employee
  getEmployees,
  createEmployee,
  updateEmployee,

  // NEW: attendance
  checkIn,
  checkOut,
  getAttendance,

  // NEW: payroll
  generatePayroll,
  getPayrolls,
  markPayrollPaid,
  exportPayrollReport,
};
