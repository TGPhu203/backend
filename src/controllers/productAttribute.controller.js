// src/controllers/productAttribute.controller.js
import ProductAttribute from '../models/productAttribute.js';
import { AppError } from '../middlewares/errorHandler.js'; // nếu bạn có, nếu không thì dùng Error thường.

export const getProductSpecs = async (req, res, next) => {
  try {
    const { productId } = req.params;

    const specs = await ProductAttribute.find({ productId })
      .sort({ section: 1, displayOrder: 1, attributeName: 1 })
      .lean();

    // group theo section: general, detail...
    const grouped = specs.reduce((acc, item) => {
      const key = item.section || 'general';
      if (!acc[key]) acc[key] = [];
      acc[key].push({
        _id: item._id,
        attributeName: item.attributeName,
        attributeValue: item.attributeValue,
        section: item.section,
        displayOrder: item.displayOrder,
      });
      return acc;
    }, {});

    return res.status(200).json({
      status: 'success',
      data: grouped,
    });
  } catch (err) {
    next(err);
  }
};

// Tạo 1 dòng thông số
export const createProductSpec = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const { attributeName, attributeValue, section, displayOrder } = req.body;

    if (!attributeName || !attributeValue) {
      return res.status(400).json({
        status: 'fail',
        message: 'attributeName và attributeValue là bắt buộc',
      });
    }

    const spec = new ProductAttribute({
      productId,
      attributeName,
      attributeValue,
      section: section || 'general',
      displayOrder: displayOrder ?? 0,
    });

    await spec.save();

    return res.status(201).json({
      status: 'success',
      data: spec,
    });
  } catch (err) {
    // unique index trùng (productId+attributeName+attributeValue)
    if (err.code === 11000) {
      return res.status(400).json({
        status: 'fail',
        message: 'Thông số này đã tồn tại cho sản phẩm',
      });
    }
    next(err);
  }
};

// Cập nhật 1 dòng thông số
export const updateProductSpec = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { attributeName, attributeValue, section, displayOrder } = req.body;

    const spec = await ProductAttribute.findByIdAndUpdate(
      id,
      {
        ...(attributeName !== undefined && { attributeName }),
        ...(attributeValue !== undefined && { attributeValue }),
        ...(section !== undefined && { section }),
        ...(displayOrder !== undefined && { displayOrder }),
      },
      { new: true }
    );

    if (!spec) {
      return res
        .status(404)
        .json({ status: 'fail', message: 'Không tìm thấy thông số' });
    }

    return res.status(200).json({
      status: 'success',
      data: spec,
    });
  } catch (err) {
    next(err);
  }
};

// Xoá 1 dòng thông số
export const deleteProductSpec = async (req, res, next) => {
  try {
    const { id } = req.params;

    const spec = await ProductAttribute.findByIdAndDelete(id);
    if (!spec) {
      return res
        .status(404)
        .json({ status: 'fail', message: 'Không tìm thấy thông số' });
    }

    return res.status(200).json({
      status: 'success',
      message: 'Đã xoá thông số',
    });
  } catch (err) {
    next(err);
  }
};
