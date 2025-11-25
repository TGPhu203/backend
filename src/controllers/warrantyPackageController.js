import { WarrantyPackage, ProductWarranty, Product, OrderItem } from '../models/index.js';
import { validationResult } from 'express-validator';

// Get all warranty packages
export const getAllWarrantyPackages = async (req, res) => {
  try {
    const { page = 1, limit = 10, isActive } = req.query;
    const offset = (page - 1) * limit;

    const whereClause = {};
    if (isActive !== undefined) {
      whereClause.isActive = isActive === 'true';
    }

    const query = WarrantyPackage.find(whereClause)
      .sort({ displayOrder: 1, createdAt: 1 }) // dùng displayOrder
      .skip(parseInt(offset))
      .limit(parseInt(limit));

    const [rows, count] = await Promise.all([
      query.exec(),
      WarrantyPackage.countDocuments(whereClause),
    ]);

    res.json({
      status: 'success',
      data: {
        warrantyPackages: rows,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(count / limit),
        },
      },
    });
  } catch (error) {
    console.error('Error fetching warranty packages:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error',
    });
  }
};

// Get warranty packages by product ID (PUBLIC: cho FE sản phẩm)
export const getWarrantyPackagesByProduct = async (req, res) => {
  try {
    const { productId } = req.params;

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        status: 'error',
        message: 'Product not found',
      });
    }

    // Populate đúng field warrantyPackageId
    const productWarranties = await ProductWarranty.find({ productId })
      .populate({
        path: 'warrantyPackageId',
        match: { isActive: true },
      })
      .sort({
        'warrantyPackageId.displayOrder': 1, // dùng displayOrder
        'warrantyPackageId.price': 1,
      });

    const warrantyPackages = productWarranties
      .filter((pw) => pw.warrantyPackageId) // chỉ lấy những gói còn active
      .map((pw) => ({
        ...pw.warrantyPackageId.toJSON(), // dữ liệu gói
        isDefault: pw.isDefault,          // thêm cờ default của product
        productWarrantyId: pw._id,        // nếu FE cần id mapping
        productPrice: pw.price,           // giá riêng cho sản phẩm (nếu có)
      }));

    res.json({
      status: 'success',
      data: {
        warrantyPackages,
        productId,
      },
    });
  } catch (error) {
    console.error('Error fetching warranty packages for product:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error',
    });
  }
};

// Get warranty package by ID
export const getWarrantyPackageById = async (req, res) => {
  try {
    const { id } = req.params;

    const warrantyPackage = await WarrantyPackage.findById(id);

    if (!warrantyPackage) {
      return res.status(404).json({
        status: 'error',
        message: 'Warranty package not found',
      });
    }

    res.json({
      status: 'success',
      data: warrantyPackage,
    });
  } catch (error) {
    console.error('Error fetching warranty package:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error',
    });
  }
};

// Create warranty package
export const createWarrantyPackage = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation error',
        errors: errors.array(),
      });
    }

    const {
      name,
      description,
      durationMonths,
      price,
      terms,
      coverage,
      isActive = true,
      displayOrder = 0, // lấy displayOrder từ body
    } = req.body;

    const warrantyPackage = new WarrantyPackage({
      name,
      description,
      durationMonths,
      price,
      terms,
      coverage,
      isActive,
      displayOrder, // lưu vào displayOrder
    });
    await warrantyPackage.save();

    res.status(201).json({
      status: 'success',
      data: warrantyPackage,
    });
  } catch (error) {
    console.error('Error creating warranty package:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error',
    });
  }
};

// Update warranty package
export const updateWarrantyPackage = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation error',
        errors: errors.array(),
      });
    }

    const { id } = req.params;
    const {
      name,
      description,
      durationMonths,
      price,
      terms,
      coverage,
      isActive,
      displayOrder, // từ body
    } = req.body;

    const warrantyPackage = await WarrantyPackage.findByIdAndUpdate(
      id,
      {
        name,
        description,
        durationMonths,
        price,
        terms,
        coverage,
        isActive,
        displayOrder, // cập nhật displayOrder
      },
      { new: true }
    );

    if (!warrantyPackage) {
      return res.status(404).json({
        status: 'error',
        message: 'Warranty package not found',
      });
    }

    res.json({
      status: 'success',
      data: warrantyPackage,
    });
  } catch (error) {
    console.error('Error updating warranty package:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error',
    });
  }
};

// Delete warranty package
export const deleteWarrantyPackage = async (req, res) => {
  try {
    const { id } = req.params;

    const warrantyPackage = await WarrantyPackage.findById(id);

    if (!warrantyPackage) {
      return res.status(404).json({
        status: 'error',
        message: 'Warranty package not found',
      });
    }

    const isUsed = await ProductWarranty.findOne({ warrantyPackageId: id });

    if (isUsed) {
      return res.status(400).json({
        status: 'error',
        message:
          'Cannot delete warranty package that is being used by products',
      });
    }

    await WarrantyPackage.findByIdAndDelete(id);

    res.json({
      status: 'success',
      message: 'Warranty package deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting warranty package:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error',
    });
  }
};

/* ================== ADMIN: CẤU HÌNH BẢO HÀNH THEO SẢN PHẨM ================== */

// GET /api/product-warranties?productId=xxx
export const getProductWarrantiesConfig = async (req, res) => {
  try {
    const { productId } = req.query;
    if (!productId) {
      return res.status(400).json({
        status: 'error',
        message: 'productId is required',
      });
    }

    const product = await Product.findById(productId).select('_id name');
    if (!product) {
      return res.status(404).json({
        status: 'error',
        message: 'Product not found',
      });
    }

    const productWarranties = await ProductWarranty.find({ productId })
      .populate('warrantyPackageId')
      .sort({ createdAt: 1 })
      .lean();

    res.json({
      status: 'success',
      data: {
        product,
        productWarranties,
      },
    });
  } catch (error) {
    console.error('Error fetching product warranties config:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error',
    });
  }
};

// POST /api/product-warranties
// body: { productId, warrantyPackageId, isDefault?, price? }
export const createProductWarrantyConfig = async (req, res) => {
  try {
    const { productId, warrantyPackageId, isDefault = false, price = 0 } =
      req.body || {};

    if (!productId || !warrantyPackageId) {
      return res.status(400).json({
        status: 'error',
        message: 'productId and warrantyPackageId are required',
      });
    }

    const [product, pkg] = await Promise.all([
      Product.findById(productId).select('_id'),
      WarrantyPackage.findById(warrantyPackageId).select('_id isActive'),
    ]);

    if (!product) {
      return res.status(404).json({
        status: 'error',
        message: 'Product not found',
      });
    }

    if (!pkg) {
      return res.status(404).json({
        status: 'error',
        message: 'Warranty package not found',
      });
    }

    const doc = new ProductWarranty({
      productId,
      warrantyPackageId,
      isDefault: !!isDefault,
      price: Number(price) || 0,
    });

    await doc.save(); // pre('save') xử lý unset default gói khác

    const populated = await doc.populate('warrantyPackageId');

    res.status(201).json({
      status: 'success',
      data: populated,
    });
  } catch (error) {
    console.error('Error creating product warranty config:', error);
    if (error.code === 11000) {
      return res.status(400).json({
        status: 'error',
        message: 'Gói bảo hành này đã được gán cho sản phẩm',
      });
    }
    res.status(500).json({
      status: 'error',
      message: 'Server error',
    });
  }
};

// PUT /api/product-warranties/:id
// body: { price?, isDefault? }
export const updateProductWarrantyConfig = async (req, res) => {
  try {
    const { id } = req.params;
    const { price, isDefault } = req.body || {};

    const doc = await ProductWarranty.findById(id);
    if (!doc) {
      return res.status(404).json({
        status: 'error',
        message: 'ProductWarranty not found',
      });
    }

    if (price !== undefined) {
      doc.price = Number(price) || 0;
    }

    if (isDefault === true) {
      doc.isDefault = true;
      await doc.save();
    } else if (isDefault === false) {
      doc.isDefault = false;
      await doc.save();
    } else {
      await doc.save();
    }

    const populated = await doc.populate('warrantyPackageId');

    res.json({
      status: 'success',
      data: populated,
    });
  } catch (error) {
    console.error('Error updating product warranty config:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error',
    });
  }
};

// DELETE /api/product-warranties/:id
export const deleteProductWarrantyConfig = async (req, res) => {
  try {
    const { id } = req.params;

    const doc = await ProductWarranty.findById(id);
    if (!doc) {
      return res.status(404).json({
        status: 'error',
        message: 'ProductWarranty not found',
      });
    }

    await doc.remove();

    res.json({
      status: 'success',
      message: 'Xóa cấu hình bảo hành cho sản phẩm thành công',
    });
  } catch (error) {
    console.error('Error deleting product warranty config:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error',
    });
  }
};
export const getWarrantyByImei = async (req, res) => {
  try {
    const { imei } = req.params;

    if (!imei) {
      return res.status(400).json({
        status: "error",
        message: "IMEI is required",
      });
    }

    const item = await OrderItem.findOne({ imei })
      .populate("productId", "name slug thumbnail")
      .populate("orderId", "orderNumber createdAt status")
      .populate("warrantyPackageId", "name durationMonths price")
      .lean();

    if (!item) {
      return res.status(404).json({
        status: "error",
        message: "Không tìm thấy bảo hành cho IMEI này",
      });
    }

    const product = item.productId || null;
    const pkg = item.warrantyPackageId || null;

    // fallback an toàn
    const productName = item.name || product?.name || null;
    const productImage = item.image || product?.thumbnail || null;

    res.status(200).json({
      status: "success",
      data: {
        imei: item.imei,

        // thông tin sản phẩm
        product,
        productName,
        productImage,

        // thông tin đơn hàng
        order: item.orderId,

        // gói bảo hành
        warrantyPackage: pkg,     
        warrantyPackageName: pkg?.name ?? null,
        warrantyDurationMonths: pkg?.durationMonths ?? null,
        warrantyPackagePrice: pkg?.price ?? null,

        // trạng thái bảo hành
        warrantyStatus: item.warrantyStatus,
        warrantyStartAt: item.warrantyStartAt,
        warrantyEndAt: item.warrantyEndAt,
      },
    });
  } catch (error) {
    console.error("Error fetching warranty by IMEI:", error);
    res.status(500).json({
      status: "error",
      message: "Server error",
    });
  }
};