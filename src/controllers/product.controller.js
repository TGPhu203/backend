// src/controllers/product.controller.js
import {
  Product,
  Category,
  ProductAttribute,
  ProductVariant,
  ProductSpecification,
  Review,
  WarrantyPackage,
} from '../models/index.js';
import { AppError } from '../middlewares/errorHandler.js';

// =================== USER ROUTES ===================

// Get all products with pagination and filters
export const getAllProducts = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      sort = 'createdAt',
      order = 'DESC',
      category,
      search,
      minPrice,
      maxPrice,
      inStock,
      featured,
      status,
    } = req.query;

    const query = {};
    const populateOptions = [];

    // Build search query
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { shortDescription: { $regex: search, $options: 'i' } },
        { searchKeywords: { $in: [new RegExp(search, 'i')] } },
      ];
    }

    // Price filters
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = parseFloat(minPrice);
      if (maxPrice) query.price.$lte = parseFloat(maxPrice);
    }

    // Other filters
    if (inStock !== undefined) query.inStock = inStock === 'true';
    if (featured !== undefined) query.featured = featured === 'true';
    query.status = status || 'active';

    // Category filter
    if (category) {
      const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(category);
      if (isValidUUID) {
        query.categories = category;
      } else {
        // Find category by slug and filter products
        const categoryDoc = await Category.findOne({ slug: category });
        if (categoryDoc) {
          query.categories = categoryDoc._id;
        }
      }
    }

    // Populate options
    populateOptions.push(
      { path: 'categories', select: 'name slug' },
      { path: 'attributes' },
      { path: 'variants' },
      { path: 'reviews', select: 'rating' }
    );

    // Sort options
    const sortOptions = {};
    sortOptions[sort] = order === 'DESC' ? -1 : 1;

    // Execute query
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const productsRaw = await Product.find(query)
      .populate(populateOptions)
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await Product.countDocuments(query);

    // Process products for display
    const products = productsRaw.map((product) => {
      const ratings = { average: 0, count: 0 };
      if (product.reviews && product.reviews.length > 0) {
        const totalRating = product.reviews.reduce((sum, r) => sum + r.rating, 0);
        ratings.average = parseFloat((totalRating / product.reviews.length).toFixed(1));
        ratings.count = product.reviews.length;
      }

      let displayPrice = product.price || 0;
      let compareAtPrice = product.compareAtPrice || null;

      if (product.variants && product.variants.length > 0) {
        const sortedVariants = product.variants.sort((a, b) => a.price - b.price);
        displayPrice = sortedVariants[0].price || displayPrice;
      }

      const { reviews, ...productData } = product;
      return { ...productData, price: displayPrice, compareAtPrice, ratings };
    });

    res.status(200).json({
      status: 'success',
      data: {
        total,
        pages: Math.ceil(total / limit),
        currentPage: parseInt(page),
        products
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get product by ID
export const getProductById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const product = await Product.findById(id)
      .populate('categories', 'name slug')
      .populate('attributes')
      .populate('variants')
      .populate('productSpecifications')
      .populate({
        path: 'reviews',
        populate: { path: 'user', select: 'id firstName lastName avatar' }
      })
      .populate({
        path: 'warrantyPackages',
        match: { isActive: true },
        populate: { path: 'warrantyPackage', select: 'name durationMonths price' }
      });

    if (!product) throw new AppError('Không tìm thấy sản phẩm', 404);

    const productJson = product.toJSON();
    const ratings = { average: 0, count: 0 };
    if (productJson.reviews && productJson.reviews.length > 0) {
      const totalRating = productJson.reviews.reduce((sum, r) => sum + r.rating, 0);
      ratings.average = parseFloat((totalRating / productJson.reviews.length).toFixed(1));
      ratings.count = productJson.reviews.length;
    }

    res.status(200).json({ status: 'success', data: { ...productJson, ratings } });
  } catch (error) {
    next(error);
  }
};

// Get product by slug
export const getProductBySlug = async (req, res, next) => {
  try {
    const { slug } = req.params;
    const { skuId } = req.query;

    const product = await Product.findOne({ slug })
      .populate('categories', 'name slug')
      .populate('attributes')
      .populate({
        path: 'variants',
        match: { isAvailable: true }
      })
      .populate({
        path: 'reviews',
        populate: { path: 'user', select: 'id firstName lastName avatar' }
      })
      .populate({
        path: 'warrantyPackages',
        match: { isActive: true },
        populate: { path: 'warrantyPackage', select: 'name durationMonths price' }
      });

    if (!product) throw new AppError('Không tìm thấy sản phẩm', 404);

    const productJson = product.toJSON();
    const ratings = { average: 0, count: 0 };
    if (productJson.reviews && productJson.reviews.length > 0) {
      const totalRating = productJson.reviews.reduce((sum, r) => sum + r.rating, 0);
      ratings.average = parseFloat((totalRating / productJson.reviews.length).toFixed(1));
      ratings.count = productJson.reviews.length;
    }

    let responseData = { ...productJson, ratings };

    if (productJson.isVariantProduct && productJson.variants && productJson.variants.length > 0) {
      let selectedVariant = skuId ? productJson.variants.find((v) => v._id.toString() === skuId) : null;
      if (!selectedVariant) selectedVariant = productJson.variants.find((v) => v.isDefault) || productJson.variants[0];

      if (selectedVariant) {
        responseData = {
          ...responseData,
          currentVariant: {
            id: selectedVariant._id,
            name: selectedVariant.variantName,
            fullName: `${productJson.baseName || productJson.name} - ${selectedVariant.variantName}`,
            price: selectedVariant.price,
            compareAtPrice: selectedVariant.compareAtPrice,
            sku: selectedVariant.sku,
            stockQuantity: selectedVariant.stockQuantity,
            specifications: { ...productJson.specifications, ...selectedVariant.specifications },
            images: selectedVariant.images && selectedVariant.images.length > 0 ? selectedVariant.images : productJson.images,
          },
          availableVariants: productJson.variants.map((v) => ({
            id: v._id,
            name: v.variantName,
            price: v.price,
            compareAtPrice: v.compareAtPrice,
            stockQuantity: v.stockQuantity,
            isDefault: v.isDefault,
            sku: v.sku,
          })),
          name: `${productJson.baseName || productJson.name} - ${selectedVariant.variantName}`,
          price: selectedVariant.price,
          compareAtPrice: selectedVariant.compareAtPrice,
          stockQuantity: selectedVariant.stockQuantity,
          sku: selectedVariant.sku,
          specifications: { ...productJson.specifications, ...selectedVariant.specifications },
          images: selectedVariant.images && selectedVariant.images.length > 0 ? selectedVariant.images : productJson.images,
        };
      }
    }

    res.status(200).json({ status: 'success', data: responseData });
  } catch (error) {
    next(error);
  }
};

// =================== ADDITIONAL USER ROUTES ===================

export const getFeaturedProducts = async (req, res, next) => {
  try {
    const products = await Product.find({ featured: true, status: 'active' }).limit(20);
    res.status(200).json({ status: 'success', data: products });
  } catch (error) {
    next(error);
  }
};

export const getNewArrivals = async (req, res, next) => {
  try {
    const products = await Product.find({ status: 'active' }).sort({ createdAt: -1 }).limit(10);
    res.status(200).json({ status: 'success', data: products });
  } catch (error) {
    next(error);
  }
};

export const getBestSellers = async (req, res, next) => {
  // Placeholder logic, bạn có thể thay bằng thực tế
  res.status(200).json({ status: 'success', data: [] });
};

export const getDeals = async (req, res, next) => {
  // Placeholder logic
  res.status(200).json({ status: 'success', data: [] });
};

export const getProductFilters = async (req, res, next) => {
  // Placeholder logic
  res.status(200).json({ status: 'success', data: {} });
};

export const searchProducts = async (req, res, next) => {
  await getAllProducts(req, res, next);
};

export const getRelatedProducts = async (req, res, next) => {
  res.status(200).json({ status: 'success', data: [] });
};

export const getProductVariants = async (req, res, next) => {
  try {
    const { id } = req.params;
    const product = await Product.findById(id).populate('variants');
    res.status(200).json({ status: 'success', data: product?.variants || [] });
  } catch (error) {
    next(error);
  }
};

export const getProductReviewsSummary = async (req, res, next) => {
  try {
    const { id } = req.params;
    const product = await Product.findById(id).populate('reviews');
    const reviews = product?.reviews || [];
    const averageRating = reviews.length > 0 ? reviews.reduce((a, r) => a + r.rating, 0) / reviews.length : 0;
    res.status(200).json({ status: 'success', data: { averageRating, count: reviews.length } });
  } catch (error) {
    next(error);
  }
};

// =================== ADMIN ROUTES ===================

export const createProduct = async (req, res, next) => {
  try {
    const newProduct = new Product(req.body);
    await newProduct.save();
    res.status(201).json({ status: 'success', data: newProduct });
  } catch (error) {
    next(error);
  }
};

export const updateProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    const product = await Product.findById(id);
    if (!product) throw new AppError('Không tìm thấy sản phẩm', 404);

    Object.assign(product, req.body);
    await product.save();

    res.status(200).json({ status: 'success', data: product });
  } catch (error) {
    next(error);
  }
};

export const deleteProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    const product = await Product.findById(id);
    if (!product) throw new AppError('Không tìm thấy sản phẩm', 404);

    await product.deleteOne();
    res.status(204).json({ status: 'success', data: null });
  } catch (error) {
    next(error);
  }
};
