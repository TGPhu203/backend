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
// -------------------- EXPORT REVENUE REPORT (CSV) --------------------
const formatDateYYYYMMDD = (d) => {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const escapeCsv = (val) => {
  if (val === null || val === undefined) return "";
  const str = String(val);
  // escape "
  return `"${str.replace(/"/g, '""')}"`;
};

/**
 * Xuất báo cáo doanh thu (CSV)
 * GET /api/admin/stats/revenue/export?type=daily|monthly|yearly&from=YYYY-MM-DD&to=YYYY-MM-DD
 */
export const exportRevenueReport = async (req, res, next) => {
  try {
    const { type = "daily", from, to } = req.query;

    let fallbackDays;
    if (type === "daily") fallbackDays = 30;
    else if (type === "monthly") fallbackDays = 365; // ~12 tháng
    else if (type === "yearly") fallbackDays = 365 * 5;
    else {
      return res.status(400).json({
        status: "error",
        message: "Loại báo cáo không hợp lệ. Chỉ hỗ trợ: daily, monthly, yearly",
      });
    }

    const { start, end } = parseDateRange(from, to, fallbackDays);

    const match = {
      ...paidOrderMatchBase,
      createdAt: { $gte: start, $lte: end },
    };

    let pipeline;
    let header;
    let filenamePrefix;

    if (type === "daily") {
      // giống getDailyRevenue
      pipeline = [
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
      header = "date,totalRevenue,totalOrders";
      filenamePrefix = "revenue_daily";
    } else if (type === "monthly") {
      pipeline = [
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
      header = "year,month,label,totalRevenue,totalOrders";
      filenamePrefix = "revenue_monthly";
    } else {
      // yearly
      pipeline = [
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
      header = "year,totalRevenue,totalOrders";
      filenamePrefix = "revenue_yearly";
    }

    const rows = await Order.aggregate(pipeline);

    // Tính tổng (summary)
    const summaryAgg = await Order.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$totalAmount" },
          totalOrders: { $sum: 1 },
        },
      },
    ]);
    const summary = summaryAgg[0] || { totalRevenue: 0, totalOrders: 0 };

    // Build CSV
    let csv = header + "\n";

    if (type === "daily") {
      for (const r of rows) {
        csv += [
          escapeCsv(r._id),                      // date
          escapeCsv(r.totalRevenue),             // totalRevenue
          escapeCsv(r.totalOrders),              // totalOrders
        ].join(",") + "\n";
      }
    } else if (type === "monthly") {
      for (const r of rows) {
        const label = `${String(r._id.month).padStart(2, "0")}/${r._id.year}`;
        csv += [
          escapeCsv(r._id.year),
          escapeCsv(r._id.month),
          escapeCsv(label),
          escapeCsv(r.totalRevenue),
          escapeCsv(r.totalOrders),
        ].join(",") + "\n";
      }
    } else {
      // yearly
      for (const r of rows) {
        csv += [
          escapeCsv(r._id.year),
          escapeCsv(r.totalRevenue),
          escapeCsv(r.totalOrders),
        ].join(",") + "\n";
      }
    }

    // Thêm dòng tổng ở cuối
    csv += "\n";
    csv += [
      escapeCsv("TOTAL"),
      type === "monthly" ? "" : "", // chỉ chèn chỗ trống nếu cần
      type === "monthly" ? "" : "",
      escapeCsv(summary.totalRevenue),
      escapeCsv(summary.totalOrders),
    ]
      .filter((v, idx) => !(type !== "monthly" && (idx === 1 || idx === 2))) // bỏ bớt cột trống cho daily/yearly
      .join(",") + "\n";

    const fileName = `${filenamePrefix}_${formatDateYYYYMMDD(
      start
    )}_to_${formatDateYYYYMMDD(end)}.csv`;

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);

    return res.status(200).send(csv);
  } catch (error) {
    console.error("Error exportRevenueReport:", error);
    next(error);
  }
};
