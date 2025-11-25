// controllers/user.controller.js
import { User, Address } from '../models/index.js';
import { AppError } from '../middlewares/errorHandler.js';

// Lấy thông tin profile user hiện tại
export const getProfile = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId).select('-password');
    if (!user) {
      throw new AppError('Không tìm thấy người dùng', 404);
    }

    res.status(200).json({
      status: 'success',
      data: user.toJSON(),
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

// Add new address
export const addAddress = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const addressData = req.body;

    const addressCount = await Address.countDocuments({ userId });
    if (addressCount === 0) {
      addressData.isDefault = true;
    }

    if (addressData.isDefault) {
      await Address.updateMany(
        { userId, isDefault: true },
        { isDefault: false }
      );
    }

    const address = new Address({
      ...addressData,
      userId,
    });

    await address.save();

    res.status(201).json({
      status: 'success',
      data: address,
    });
  } catch (error) {
    next(error);
  }
};

// Update address
export const updateAddress = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const addressData = req.body;

    const address = await Address.findOne({ _id: id, userId });

    if (!address) {
      throw new AppError('Không tìm thấy địa chỉ', 404);
    }

    if (addressData.isDefault && !address.isDefault) {
      await Address.updateMany(
        { userId, isDefault: true },
        { isDefault: false }
      );
    }

    Object.assign(address, addressData);
    await address.save();

    res.status(200).json({
      status: 'success',
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
