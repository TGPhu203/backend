// src/controllers/auth.controller.js
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { User } from "../models/index.js";
import { AppError } from "../middlewares/errorHandler.js";
import * as emailService from "../services/email/emailService.js";

/** Helper: sign token */
function signToken(payload, secret, expiresIn) {
  if (!secret) throw new Error("Missing JWT secret");
  return jwt.sign(payload, secret, { expiresIn });
}

/* ================= REGISTER ================= */
export const register = async (req, res, next) => {
  try {
    const { email, password, firstName, lastName, phone } = req.body;

    if (!email || !password || !firstName || !lastName)
      throw new AppError("Thiếu thông tin bắt buộc", 400);

    const exists = await User.findOne({ email });
    if (exists) throw new AppError("Email đã được sử dụng", 400);

    const verificationToken = crypto.randomBytes(32).toString("hex");

    const user = new User({
      email,
      password,
      firstName,
      lastName,
      phone,
      verificationToken,
    });

    await user.save();

    try {
      await emailService.sendVerificationEmail(user.email, verificationToken);
    } catch { }

    res.status(201).json({
      status: "success",
      data: {
        message: "Đăng ký thành công. Vui lòng kiểm tra email để xác thực.",
      },
    });
  } catch (err) {
    next(err);
  }
};
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      throw new AppError("Email và mật khẩu là bắt buộc", 400);

    // lấy thêm password để so sánh, các field khác lấy bình thường
    const user = await User.findOne({ email }).select("+password");
    if (!user) throw new AppError("Email hoặc mật khẩu không đúng", 401);
    if (!user.isActive) throw new AppError("Tài khoản bị khóa", 401);

    const match = await user.comparePassword(password);
    if (!match) throw new AppError("Email hoặc mật khẩu không đúng", 401);
    if (user.isBlocked) {
      return res.status(403).json({
        status: "error",
        message: "Tài khoản của bạn đã bị khóa. Vui lòng liên hệ hỗ trợ.",
      });
    }
    // cập nhật hạng thành viên theo totalSpent hiện tại
    user.updateLoyaltyTier();
    await user.save();

    const token = signToken(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      "1d"
    );

    const refreshToken = signToken(
      { id: user._id },
      process.env.JWT_REFRESH_SECRET,
      "7d"
    );

    // cookie
    res.cookie("token", token, {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      path: "/",
      maxAge: 24 * 3600 * 1000,
    });

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 3600 * 1000,
    });

    const safe = user.toJSON(); // đã bỏ password trong schema

    res.status(200).json({
      status: "success",
      data: {
        user: {
          id: safe._id,
          email: safe.email,
          firstName: safe.firstName,
          lastName: safe.lastName,
          fullName: safe.fullName,
          avatar: safe.avatar,
          role: safe.role,
          isActive: safe.isActive,
          isEmailVerified: safe.isEmailVerified,
          totalSpent: safe.totalSpent,
          loyaltyTier: safe.loyaltyTier,
          loyaltyPoints: safe.loyaltyPoints,
        },
        token,
        refreshToken,
      },
    });
  } catch (err) {
    next(err);
  }
};


/* ================= LOGOUT ================= */
export const logout = async (req, res, next) => {
  try {
    res.clearCookie("token");
    res.clearCookie("refreshToken");

    res.status(200).json({
      status: "success",
      message: "Đăng xuất thành công",
    });
  } catch (err) {
    next(err);
  }
};

/* ================= VERIFY EMAIL ================= */
export const verifyEmail = async (req, res, next) => {
  try {
    const { token } = req.params;
    if (!token) throw new AppError("Token không hợp lệ", 400);

    const user = await User.findOne({ verificationToken: token });
    if (!user) throw new AppError("Token không hợp lệ hoặc đã hết hạn", 400);

    user.isEmailVerified = true;
    user.verificationToken = null;
    await user.save();

    res.status(200).json({
      status: "success",
      data: { message: "Xác thực email thành công." },
    });
  } catch (err) {
    next(err);
  }
};

/* ================= VERIFY EMAIL (POST TOKEN) ================= */
export const verifyEmailWithToken = async (req, res, next) => {
  try {
    const { token } = req.body;
    if (!token) throw new AppError("Token không hợp lệ", 400);

    const user = await User.findOne({ verificationToken: token });
    if (!user) throw new AppError("Token không hợp lệ", 400);

    user.isEmailVerified = true;
    user.verificationToken = null;
    await user.save();

    res.status(200).json({
      status: "success",
      data: { message: "Xác thực email thành công." },
    });
  } catch (err) {
    next(err);
  }
};

/* ================= RESEND VERIFICATION EMAIL ================= */
export const resendVerification = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) throw new AppError("Email là bắt buộc", 400);

    const user = await User.findOne({ email });
    if (!user) throw new AppError("Không tìm thấy tài khoản với email này", 404);

    if (user.isEmailVerified)
      throw new AppError("Email đã được xác thực trước đó", 400);

    const verificationToken = crypto.randomBytes(32).toString("hex");
    user.verificationToken = verificationToken;
    await user.save();

    try {
      await emailService.sendVerificationEmail(email, verificationToken);
    } catch { }

    res.status(200).json({
      status: "success",
      data: { message: "Email xác thực đã được gửi lại." },
    });
  } catch (err) {
    next(err);
  }
};

/* ================= REFRESH TOKEN ================= */
export const refreshToken = async (req, res, next) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken)
      throw new AppError("Bạn cần đăng nhập lại", 401);

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) throw new AppError("Refresh token không hợp lệ", 401);

    const newToken = signToken(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      "1d"
    );

    res.cookie("token", newToken, {
      httpOnly: true,
      secure: false,
      sameSite: "lax",

      path: "/",
      maxAge: 24 * 3600 * 1000,
    });

    res.status(200).json({
      status: "success",
      data: { token: newToken },
    });
  } catch (err) {
    next(err);
  }
};

/* ================= FORGOT PASSWORD ================= */
export const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) throw new AppError("Email là bắt buộc", 400);

    const user = await User.findOne({ email });
    if (!user) throw new AppError("Không tìm thấy tài khoản", 404);

    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenExpires = Date.now() + 3600000;

    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = new Date(resetTokenExpires);
    await user.save();

    try {
      await emailService.sendResetPasswordEmail(email, resetToken);
    } catch { }

    res.status(200).json({
      status: "success",
      data: { message: "Đã gửi email đặt lại mật khẩu" },
    });
  } catch (err) {
    next(err);
  }
};

/* ================= RESET PASSWORD ================= */
export const resetPassword = async (req, res, next) => {
  try {
    const { token, password } = req.body;

    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: new Date() },
    });

    if (!user)
      throw new AppError("Token không hợp lệ hoặc đã hết hạn", 400);

    user.password = password;
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    await user.save();

    res.status(200).json({
      status: "success",
      data: { message: "Đổi mật khẩu thành công" },
    });
  } catch (err) {
    next(err);
  }
};

/* ================= CURRENT USER ================= */
export const getCurrentUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).populate("addresses");
    if (!user) throw new AppError("Không tìm thấy người dùng", 404);

    res.status(200).json({
      status: "success",
      data: user.toJSON(),
    });
  } catch (err) {
    next(err);
  }
};
