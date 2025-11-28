// controllers/coupon.controller.js
import Coupon from "../models/coupon.js";

export async function adminGetCoupons(req, res) {
  try {
    const coupons = await Coupon.find().sort({ createdAt: -1 }).lean();
    res.status(200).json({
      status: "success",
      data: coupons,
    });
  } catch (err) {
    console.error("adminGetCoupons error:", err);
    res
      .status(500)
      .json({ status: "error", message: err.message || "Lỗi server" });
  }
}

export async function adminCreateCoupon(req, res) {
  try {
    const payload = {
      ...req.body,
      code: req.body.code?.toUpperCase(),
      createdBy: req.user?.id,
    };

    const coupon = await Coupon.create(payload);

    res.status(201).json({
      status: "success",
      data: coupon,
    });
  } catch (err) {
    console.error("adminCreateCoupon error:", err);
    // xử lý trùng mã
    if (err.code === 11000 && err.keyPattern?.code) {
      return res
        .status(400)
        .json({ status: "error", message: "Mã ưu đãi đã tồn tại" });
    }
    res
      .status(500)
      .json({ status: "error", message: err.message || "Lỗi server" });
  }
}

export async function adminUpdateCoupon(req, res) {
  try {
    const { id } = req.params;
    const update = { ...req.body };
    if (update.code) update.code = update.code.toUpperCase();

    const coupon = await Coupon.findByIdAndUpdate(id, update, {
      new: true,
    });

    if (!coupon) {
      return res
        .status(404)
        .json({ status: "error", message: "Không tìm thấy mã ưu đãi" });
    }

    res.status(200).json({
      status: "success",
      data: coupon,
    });
  } catch (err) {
    console.error("adminUpdateCoupon error:", err);
    if (err.code === 11000 && err.keyPattern?.code) {
      return res
        .status(400)
        .json({ status: "error", message: "Mã ưu đãi đã tồn tại" });
    }
    res
      .status(500)
      .json({ status: "error", message: err.message || "Lỗi server" });
  }
}

export async function adminDeleteCoupon(req, res) {
  try {
    const { id } = req.params;
    const coupon = await Coupon.findByIdAndDelete(id);
    if (!coupon) {
      return res
        .status(404)
        .json({ status: "error", message: "Không tìm thấy mã ưu đãi" });
    }
    res.status(200).json({
      status: "success",
      message: "Xoá mã ưu đãi thành công",
    });
  } catch (err) {
    console.error("adminDeleteCoupon error:", err);
    res
      .status(500)
      .json({ status: "error", message: err.message || "Lỗi server" });
  }
}
export async function applyCoupon(req, res) {
    try {
      const { code, orderAmount } = req.body;
  
      if (!code || typeof orderAmount !== "number") {
        return res.status(400).json({
          status: "error",
          message: "Thiếu mã ưu đãi hoặc số tiền đơn hàng",
        });
      }
  
      const upperCode = code.toUpperCase();
      const coupon = await Coupon.findOne({ code: upperCode, isActive: true });
  
      if (!coupon) {
        return res.status(404).json({
          status: "error",
          message: "Mã ưu đãi không tồn tại hoặc đã tắt",
        });
      }
  
      const now = new Date();
      if (coupon.startDate && now < coupon.startDate) {
        return res.status(400).json({
          status: "error",
          message: "Mã ưu đãi chưa đến thời gian áp dụng",
        });
      }
      if (coupon.endDate && now > coupon.endDate) {
        return res.status(400).json({
          status: "error",
          message: "Mã ưu đãi đã hết hạn",
        });
      }
  
      if (coupon.minOrderAmount && orderAmount < coupon.minOrderAmount) {
        return res.status(400).json({
          status: "error",
          message: `Đơn hàng phải từ ${coupon.minOrderAmount.toLocaleString(
            "vi-VN"
          )}₫ mới được áp dụng mã này`,
        });
      }
  
      // Tính số tiền giảm
      let discountAmount = 0;
      if (coupon.type === "percent") {
        discountAmount = (orderAmount * coupon.value) / 100;
      } else {
        // fixed
        discountAmount = coupon.value;
      }
  
      // Giới hạn bởi maxDiscount (nếu có)
      if (coupon.maxDiscount && discountAmount > coupon.maxDiscount) {
        discountAmount = coupon.maxDiscount;
      }
  
      // Không giảm quá số tiền đơn
      if (discountAmount > orderAmount) {
        discountAmount = orderAmount;
      }
  
      discountAmount = Math.round(discountAmount);
      const finalAmount = orderAmount - discountAmount;
  
      return res.status(200).json({
        status: "success",
        data: {
          coupon,
          discountAmount,
          finalAmount,
        },
      });
    } catch (err) {
      console.error("applyCoupon error:", err);
      return res
        .status(500)
        .json({ status: "error", message: err.message || "Lỗi server" });
    }
  }
  // controllers/coupon.controller.js
export async function getAvailableCoupons(req, res) {
  try {
    const orderAmount = Number(req.query.orderAmount) || 0;
    const now = new Date();

    const coupons = await Coupon.find({ isActive: true })
      .sort({ createdAt: -1 })
      .lean();

    const data = coupons.map((c) => {
      // ép kiểu cho chắc chắn
      const value = c.value != null ? Number(c.value) : 0;
      const maxDiscount =
        c.maxDiscount != null ? Number(c.maxDiscount) : 0;
      const minOrderAmount =
        c.minOrderAmount != null ? Number(c.minOrderAmount) : 0;

      const startOk = !c.startDate || new Date(c.startDate) <= now;
      const endOk = !c.endDate || new Date(c.endDate) >= now;
      const minOk =
        !orderAmount || !minOrderAmount || orderAmount >= minOrderAmount;

      return {
        ...c,
        value,
        maxDiscount,
        minOrderAmount,
        isEligible: startOk && endOk && minOk,
      };
    });

    return res.status(200).json({
      status: "success",
      data,
    });
  } catch (err) {
    console.error("getAvailableCoupons error:", err);
    return res
      .status(500)
      .json({ status: "error", message: err.message || "Lỗi server" });
  }
}
