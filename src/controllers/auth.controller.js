// src/controllers/auth.controller.js
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { User } from "../models/index.js";
import { AppError } from "../middlewares/errorHandler.js";
import * as emailService from "../services/email/emailService.js";

/**
 * Helper: sign token (throws if secret missing)
 */
function signToken(payload, secret, expiresIn) {
  if (!secret) throw new Error("Missing JWT secret in environment variables");
  return jwt.sign(payload, secret, { expiresIn });
}

// ================= REGISTER =================
export const register = async (req, res, next) => {
  try {
    const { email, password, firstName, lastName, phone } = req.body;
    if (!email || !password || !firstName || !lastName) {
      throw new AppError("Thiếu thông tin bắt buộc", 400);
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      throw new AppError("Email đã được sử dụng", 400);
    }

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

    // send verification email (don't block response if email fails)
    try {
      await emailService.sendVerificationEmail(user.email, verificationToken);
    } catch (err) {
      // log but don't fail registration just because email failed
      // console.error("Failed to send verification email:", err);
    }

    res.status(201).json({
      status: "success",
      data: {
        message:
          "Đăng ký thành công. Vui lòng kiểm tra email để xác thực tài khoản.",
      },
    });
  } catch (error) {
    next(error);
  }
};

// ================= LOGIN =================
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      throw new AppError("Email và mật khẩu là bắt buộc", 400);
    }

    // select password explicitly because schema has select:false
    const user = await User.findOne({ email }).select("+password");
    if (!user) throw new AppError("Email hoặc mật khẩu không đúng", 401);

    /*
      Nếu bạn muốn bắt buộc verify email, bỏ comment đoạn này:
    if (!user.isEmailVerified)
      throw new AppError('Vui lòng xác thực email trước khi đăng nhập', 401);
    */

    if (!user.isActive)
      throw new AppError(
        "Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên",
        401
      );

    const isMatch = await user.comparePassword(password);
    if (!isMatch) throw new AppError("Email hoặc mật khẩu không đúng", 401);

    // Tạo token (bảo đảm tồn tại secret)
    let token;
    let refreshToken;
    try {
      token = signToken(
        { id: user._id, role: user.role },
        process.env.JWT_SECRET,
        process.env.JWT_EXPIRES_IN || "1h"
      );

      refreshToken = signToken(
        { id: user._id },
        process.env.JWT_REFRESH_SECRET,
        process.env.JWT_REFRESH_EXPIRES_IN || "7d"
      );
    } catch (err) {
      return next(new AppError("Server cấu hình token chưa đúng", 500));
    }

    // trả user không kèm password (model toJSON đã loại password)
    res.status(200).json({
      status: "success",
      data: {
        user: {
          _id: user._id,
          email: user.email,
          fullName: `${user.firstName} ${user.lastName}`,
          role: user.role,
          isEmailVerified: user.isEmailVerified,
          isActive: user.isActive,
        },
        token,
        refreshToken,
      }

    });
  } catch (error) {
    next(error);
  }
};

// ================= LOGOUT =================
export const logout = async (req, res, next) => {
  try {
    // Nếu dùng cookie: res.clearCookie('jwt')
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

// ================= VERIFY EMAIL (GET :token) =================
export const verifyEmail = async (req, res, next) => {
  try {
    const { token } = req.params;
    if (!token) throw new AppError("Token xác thực bắt buộc", 400);

    const user = await User.findOne({ verificationToken: token });
    if (!user) throw new AppError("Token không hợp lệ hoặc đã hết hạn", 400);

    user.isEmailVerified = true;
    user.verificationToken = null;
    await user.save();

    res.status(200).json({
      status: "success",
      data: { message: "Xác thực email thành công. Bạn có thể đăng nhập ngay bây giờ." },
    });
  } catch (error) {
    next(error);
  }
};

// ================= VERIFY EMAIL (POST body.token) =================
export const verifyEmailWithToken = async (req, res, next) => {
  try {
    const { token } = req.body;
    if (!token) throw new AppError("Token xác thực bắt buộc", 400);

    const user = await User.findOne({ verificationToken: token });
    if (!user) throw new AppError("Token không hợp lệ hoặc đã hết hạn", 400);

    user.isEmailVerified = true;
    user.verificationToken = null;
    await user.save();

    res.status(200).json({
      status: "success",
      data: { message: "Xác thực email thành công. Bạn có thể đăng nhập ngay bây giờ." },
    });
  } catch (error) {
    next(error);
  }
};

// ================= RESEND VERIFICATION =================
export const resendVerification = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) throw new AppError("Email là bắt buộc", 400);

    const user = await User.findOne({ email });
    if (!user) throw new AppError("Không tìm thấy tài khoản với email này", 404);

    if (user.isEmailVerified) throw new AppError("Email đã được xác thực", 400);

    const verificationToken = crypto.randomBytes(32).toString("hex");
    user.verificationToken = verificationToken;
    await user.save();

    try {
      await emailService.sendVerificationEmail(user.email, verificationToken);
    } catch (err) {
      // log but don't fail
    }

    res.status(200).json({
      status: "success",
      data: { message: "Đã gửi lại email xác thực. Vui lòng kiểm tra email của bạn." },
    });
  } catch (error) {
    next(error);
  }
};

// ================= REFRESH TOKEN =================
export const refreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) throw new AppError("Refresh token là bắt buộc", 401);

    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    } catch (err) {
      return next(new AppError("Refresh token không hợp lệ hoặc đã hết hạn", 401));
    }

    const user = await User.findById(decoded.id);
    if (!user) throw new AppError("Refresh token không hợp lệ", 401);

    if (!user.isActive)
      throw new AppError(
        "Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên",
        401
      );

    let token;
    try {
      token = signToken(
        { id: user._id, role: user.role },
        process.env.JWT_SECRET,
        process.env.JWT_EXPIRES_IN || "1h"
      );
    } catch (err) {
      return next(new AppError("Server cấu hình token chưa đúng", 500));
    }

    res.status(200).json({
      status: "success",
      data: { token },
    });
  } catch (error) {
    next(error);
  }
};

// ================= FORGOT PASSWORD =================
export const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) throw new AppError("Email là bắt buộc", 400);

    const user = await User.findOne({ email });
    if (!user) throw new AppError("Không tìm thấy tài khoản với email này", 404);

    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenExpires = Date.now() + 3600000;

    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = new Date(resetTokenExpires);
    await user.save();

    try {
      await emailService.sendResetPasswordEmail(user.email, resetToken);
    } catch (err) {
      // log but continue
    }

    res.status(200).json({
      status: "success",
      data: { message: "Đã gửi email đặt lại mật khẩu. Vui lòng kiểm tra email." },
    });
  } catch (error) {
    next(error);
  }
};

// ================= RESET PASSWORD =================
export const resetPassword = async (req, res, next) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) throw new AppError("Token và mật khẩu mới là bắt buộc", 400);

    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: new Date() },
    });

    if (!user) throw new AppError("Token không hợp lệ hoặc đã hết hạn", 400);

    user.password = password;
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    await user.save();

    res.status(200).json({
      status: "success",
      data: { message: "Đặt lại mật khẩu thành công. Bạn có thể đăng nhập." },
    });
  } catch (error) {
    next(error);
  }
};

// ================= CURRENT USER =================
export const getCurrentUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).populate("addresses");

    if (!user) throw new AppError("Không tìm thấy người dùng", 404);

    res.status(200).json({
      status: "success",
      data: user.toJSON(),
    });
  } catch (error) {
    next(error);
  }
};
