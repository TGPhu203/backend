import { WarrantyPackage, ProductWarranty, Product } from '../models/index.js';
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
      .sort({ sortOrder: 1, createdAt: 1 })
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

// Get warranty packages by product ID
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

    const productWarranties = await ProductWarranty.find({ productId })
      .populate({
        path: 'warrantyPackage',
        match: { isActive: true },
      })
      .sort({ 'warrantyPackage.sortOrder': 1, 'warrantyPackage.price': 1 });

    const warrantyPackages = productWarranties
      .filter(pw => pw.warrantyPackage)
      .map((pw) => ({
        ...pw.warrantyPackage.toJSON(),
        isDefault: pw.isDefault,
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
      sortOrder = 0,
    } = req.body;

    const warrantyPackage = new WarrantyPackage({
      name,
      description,
      durationMonths,
      price,
      terms,
      coverage,
      isActive,
      sortOrder,
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
      sortOrder,
    } = req.body;

    const warrantyPackage = await WarrantyPackage.findByIdAndUpdate(id, {
      name,
      description,
      durationMonths,
      price,
      terms,
      coverage,
      isActive,
      sortOrder,
    }, { new: true });

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
