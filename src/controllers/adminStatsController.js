// src/controllers/adminStatsController.js
import { Order } from "../models/index.js";

/**
 * Parse from/to trong query, fallback:
 * - daily: 30 ngày gần nhất
 * - monthly: 12 tháng gần nhất
 * - yearly: 5 năm gần nhất
 */
const paidOrderMatchBase = {
  $or: [
    { paymentStatus: "paid", status: { $ne: "cancelled" } }, // online đã thanh toán, không tính cancelled
    { paymentMethod: "cod", status: "completed" },           // COD đã giao xong
  ],
  paymentStatus: { $ne: "refunded" }, // loại đơn đã hoàn tiền
};
const parseDateRange = (from, to, fallbackDays = 30) => {
  let start;
  let end;

  if (from) {
    start = new Date(from);
  } else {
    start = new Date();
    start.setDate(start.getDate() - (fallbackDays - 1)); // ví dụ 30 ngày gần nhất
  }

  if (to) {
    end = new Date(to);
  } else {
    end = new Date();
  }

  // đưa end tới cuối ngày
  end.setHours(23, 59, 59, 999);

  return { start, end };
};

/**
 * Doanh thu theo NGÀY
 * GET /api/admin/stats/revenue/daily?from=2025-01-01&to=2025-01-31
 */
export const getDailyRevenue = async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const { start, end } = parseDateRange(from, to, 30);

    const match = {
      ...paidOrderMatchBase,
      createdAt: { $gte: start, $lte: end },
    };

    const pipeline = [
      { $match: match },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
          },
          totalRevenue: { $sum: "$totalAmount" },
          totalOrders: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ];

    const summaryPipeline = [
      { $match: match },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$totalAmount" },
          totalOrders: { $sum: 1 },
        },
      },
    ];

    const [rows, summaryArr] = await Promise.all([
      Order.aggregate(pipeline),
      Order.aggregate(summaryPipeline),
    ]);

    const summary = summaryArr[0] || { totalRevenue: 0, totalOrders: 0 };

    return res.status(200).json({
      status: "success",
      data: {
        from: start,
        to: end,
        items: rows.map((r) => ({
          date: r._id, // YYYY-MM-DD
          totalRevenue: r.totalRevenue,
          totalOrders: r.totalOrders,
        })),
        summary: {
          totalRevenue: summary.totalRevenue,
          totalOrders: summary.totalOrders,
        },
      },
    });
  } catch (error) {
    console.error("Error getDailyRevenue:", error);
    next(error);
  }
};

/**
 * Doanh thu theo THÁNG
 * GET /api/admin/stats/revenue/monthly?from=2024-01-01&to=2024-12-31
 */
export const getMonthlyRevenue = async (req, res, next) => {
  try {
    const { from, to } = req.query;
    // fallback 12 tháng gần nhất
    const { start, end } = parseDateRange(from, to, 365);

    const match = {
      ...paidOrderMatchBase,
      createdAt: { $gte: start, $lte: end },
    };

    const pipeline = [
      { $match: match },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
          },
          totalRevenue: { $sum: "$totalAmount" },
          totalOrders: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ];

    const summaryPipeline = [
      { $match: match },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$totalAmount" },
          totalOrders: { $sum: 1 },
        },
      },
    ];

    const [rows, summaryArr] = await Promise.all([
      Order.aggregate(pipeline),
      Order.aggregate(summaryPipeline),
    ]);

    const summary = summaryArr[0] || { totalRevenue: 0, totalOrders: 0 };

    return res.status(200).json({
      status: "success",
      data: {
        from: start,
        to: end,
        items: rows.map((r) => ({
          year: r._id.year,
          month: r._id.month,
          label: `${String(r._id.month).padStart(2, "0")}/${r._id.year}`, // 01/2025
          totalRevenue: r.totalRevenue,
          totalOrders: r.totalOrders,
        })),
        summary: {
          totalRevenue: summary.totalRevenue,
          totalOrders: summary.totalOrders,
        },
      },
    });
  } catch (error) {
    console.error("Error getMonthlyRevenue:", error);
    next(error);
  }
};

/**
 * Doanh thu theo NĂM
 * GET /api/admin/stats/revenue/yearly?from=2020-01-01&to=2025-12-31
 */
export const getYearlyRevenue = async (req, res, next) => {
  try {
    const { from, to } = req.query;
    // fallback 5 năm gần nhất
    const { start, end } = parseDateRange(from, to, 365 * 5);

    const match = {
      ...paidOrderMatchBase,
      createdAt: { $gte: start, $lte: end },
    };

    const pipeline = [
      { $match: match },
      {
        $group: {
          _id: { year: { $year: "$createdAt" } },
          totalRevenue: { $sum: "$totalAmount" },
          totalOrders: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1 } },
    ];

    const summaryPipeline = [
      { $match: match },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$totalAmount" },
          totalOrders: { $sum: 1 },
        },
      },
    ];

    const [rows, summaryArr] = await Promise.all([
      Order.aggregate(pipeline),
      Order.aggregate(summaryPipeline),
    ]);

    const summary = summaryArr[0] || { totalRevenue: 0, totalOrders: 0 };

    return res.status(200).json({
      status: "success",
      data: {
        from: start,
        to: end,
        items: rows.map((r) => ({
          year: r._id.year,
          totalRevenue: r.totalRevenue,
          totalOrders: r.totalOrders,
        })),
        summary: {
          totalRevenue: summary.totalRevenue,
          totalOrders: summary.totalOrders,
        },
      },
    });
  } catch (error) {
    console.error("Error getYearlyRevenue:", error);
    next(error);
  }
};
