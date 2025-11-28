// controllers/user.controller.js
import { User, Address, Order } from '../models/index.js';
import { AppError } from '../middlewares/errorHandler.js';
const calcLoyaltyTier = (totalSpent = 0) => {
  if (totalSpent >= 100_000_000) return "diamond";
  if (totalSpent >= 50_000_000)  return "gold";
  if (totalSpent >= 10_000_000)  return "silver";
  return "none";
};

const calcLoyaltyPoints = (totalSpent = 0) => {
  // ví dụ: 1 điểm cho mỗi 100.000đ
  return Math.floor(totalSpent / 100_000);
};
export const getProfile = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId).select("-password");
    if (!user) {
      throw new AppError("Không tìm thấy người dùng", 404);
    }

    // ✅ CHỈ LẤY ĐƠN ĐÃ THANH TOÁN THÀNH CÔNG
    const orders = await Order.find({
      userId,
      paymentStatus: { $ne: "refunded" }, // loại đơn đã hoàn tiền (nếu có)
      $or: [
        // Đơn ONLINE: không phải COD và đã thanh toán
        {
          paymentMethod: { $ne: "cod" },
          paymentStatus: "paid",
        },
    
        // Đơn COD: phương thức COD và đã hoàn tất đơn
        {
          paymentMethod: "cod",
          status: "completed",
        },
      ],
    }).select("totalAmount status paymentStatus paymentMethod");
    

    let totalSpent = 0;
    let orderCount = 0;

    for (const o of orders) {
      totalSpent += o.totalAmount || 0;
      orderCount += 1;
    }

    const currentTier = user.loyaltyTier || "none";
    const loyaltyTier =
      currentTier !== "none" ? currentTier : calcLoyaltyTier(totalSpent);

    const storedPoints =
      typeof user.loyaltyPoints === "number" ? user.loyaltyPoints : null;
    const loyaltyPoints =
      storedPoints !== null ? storedPoints : calcLoyaltyPoints(totalSpent);

    const json = user.toJSON();

    res.status(200).json({
      status: "success",
      data: {
        ...json,
        totalSpent,
        orderCount,
        loyaltyTier,
        loyaltyPoints,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Update user profile
export const updateProfile = async (req, res, next) => {
  try {
    const { firstName, lastName, phone, avatar } = req.body;
    const userId = req.user.id;

    // Find user
    const user = await User.findById(userId);
    if (!user) {
      throw new AppError('Không tìm thấy người dùng', 404);
    }

    // Update user
    if (firstName !== undefined) user.firstName = firstName;
    if (lastName !== undefined) user.lastName = lastName;
    if (phone !== undefined) user.phone = phone;
    if (avatar !== undefined) user.avatar = avatar;

    await user.save();

    res.status(200).json({
      status: 'success',
      data: user.toJSON(),
    });
  } catch (error) {
    next(error);
  }
};

// Change password
export const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    const user = await User.findById(userId);
    if (!user) {
      throw new AppError('Không tìm thấy người dùng', 404);
    }

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      throw new AppError('Mật khẩu hiện tại không đúng', 401);
    }

    user.password = newPassword;
    await user.save();

    res.status(200).json({
      status: 'success',
      message: 'Đổi mật khẩu thành công',
    });
  } catch (error) {
    next(error);
  }
};

// Get user addresses
export const getAddresses = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const addresses = await Address.find({ userId }).sort({
      isDefault: -1,
      createdAt: -1,
    });

    res.status(200).json({
      status: 'success',
      data: addresses,
    });
  } catch (error) {
    next(error);
  }
};
export const addAddress = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { fullName, phone, street, ward, district, province, isDefault } =
      req.body;

    const addressCount = await Address.countDocuments({ userId });
    const willDefault = addressCount === 0 ? true : !!isDefault;

    if (willDefault) {
      await Address.updateMany(
        { userId, isDefault: true },
        { isDefault: false }
      );
    }

    const address = new Address({
      userId,
      fullName,
      phone,
      street,
      ward,
      district,
      province,
      isDefault: willDefault,
      // các field cũ sẽ được pre('save') tự map thêm (addressLine1, city, state, ...)
    });

    await address.save();

    res.status(201).json({
      status: "success",
      data: address,
    });
  } catch (error) {
    next(error);
  }
};
export const updateAddress = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { fullName, phone, street, ward, district, province, isDefault } =
      req.body;

    const address = await Address.findOne({ _id: id, userId });
    if (!address) {
      throw new AppError("Không tìm thấy địa chỉ", 404);
    }

    // nếu set mặc định => bỏ mặc định ở địa chỉ khác
    if (typeof isDefault === "boolean" && isDefault && !address.isDefault) {
      await Address.updateMany(
        { userId, isDefault: true },
        { isDefault: false }
      );
    }

    if (fullName !== undefined) address.fullName = fullName;
    if (phone !== undefined) address.phone = phone;
    if (street !== undefined) address.street = street;
    if (ward !== undefined) address.ward = ward;
    if (district !== undefined) address.district = district;
    if (province !== undefined) address.province = province;
    if (isDefault !== undefined) address.isDefault = !!isDefault;

    await address.save();

    res.status(200).json({
      status: "success",
      data: address,
    });
  } catch (error) {
    next(error);
  }
};

// Delete address
export const deleteAddress = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const address = await Address.findOne({ _id: id, userId });

    if (!address) {
      throw new AppError('Không tìm thấy địa chỉ', 404);
    }

    await address.deleteOne();

    if (address.isDefault) {
      const anotherAddress = await Address.findOne({ userId }).sort({
        createdAt: -1,
      });

      if (anotherAddress) {
        anotherAddress.isDefault = true;
        await anotherAddress.save();
      }
    }

    res.status(200).json({
      status: 'success',
      message: 'Xóa địa chỉ thành công',
    });
  } catch (error) {
    next(error);
  }
};

// Set default address
export const setDefaultAddress = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const address = await Address.findOne({ _id: id, userId });

    if (!address) {
      throw new AppError('Không tìm thấy địa chỉ', 404);
    }

    await Address.updateMany(
      { userId, isDefault: true },
      { isDefault: false }
    );

    address.isDefault = true;
    await address.save();

    res.status(200).json({
      status: 'success',
      data: address,
    });
  } catch (error) {
    next(error);
  }
};
