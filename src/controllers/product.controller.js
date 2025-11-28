// src/controllers/product.controller.js
import {
  Product,
  Category,
  ProductAttribute,
  ProductVariant,
  ProductSpecification,
  Review,
  WarrantyPackage,
  ProductWarranty,        // 👈 THÊM
} from '../models/index.js';
import { AppError } from '../middlewares/errorHandler.js';
// Các populate chung cho list sản phẩm
// Các populate chung cho list sản phẩm
const PRODUCT_LIST_POPULATE = [
  { path: "categories", select: "name slug" },
  { path: "attributes" },
  { path: "variants" },
  { path: "reviews", select: "rating" },
  {
    path: "productSpecifications",
    options: {
      sort: { section: 1, displayOrder: 1, attributeName: 1 },
    },
  },
];

// Hàm map 1 product (lean) sang dữ liệu trả về cho FE (list)
const mapProductForList = (product) => {
  // ====== RATING ======
  const ratings = { average: 0, count: 0 };
  if (Array.isArray(product.reviews) && product.reviews.length > 0) {
    const totalRating = product.reviews.reduce(
      (sum, r) => sum + r.rating,
      0
    );
    ratings.average = parseFloat(
      (totalRating / product.reviews.length).toFixed(1)
    );
    ratings.count = product.reviews.length;
  }

  // ====== GIÁ GỐC (base / variant thấp nhất) ======
  let displayPrice = product.price || 0;
  let compareAtPrice = product.compareAtPrice ?? null;

  if (Array.isArray(product.variants) && product.variants.length > 0) {
    const sortedVariants = [...product.variants].sort(
      (a, b) => (a.price || 0) - (b.price || 0)
    );
    displayPrice = sortedVariants[0].price || displayPrice;
  }

  // ====== CỘNG GIÁ THUỘC TÍNH MẶC ĐỊNH ======
  let attributeAdjustment = 0;
  if (Array.isArray(product.attributes) && product.attributes.length > 0) {
    attributeAdjustment = product.attributes.reduce((sum, attr) => {
      const options = Array.isArray(attr?.options) ? attr.options : [];
      if (options.length === 0) return sum;

      const defaultOpt =
        options.find((opt) => opt.isDefault) || options[0];

      const adj =
        defaultOpt && typeof defaultOpt.priceAdjustment === "number"
          ? defaultOpt.priceAdjustment
          : 0;

      return sum + adj;
    }, 0);
  }

  const finalPrice = displayPrice + attributeAdjustment;
  const finalCompareAtPrice =
    typeof compareAtPrice === "number"
      ? compareAtPrice + attributeAdjustment
      : null;

  // 👉 TÍNH % GIẢM GIÁ
  let discountPercent = 0;
  if (
    typeof finalCompareAtPrice === "number" &&
    finalCompareAtPrice > finalPrice
  ) {
    discountPercent = Math.round(
      ((finalCompareAtPrice - finalPrice) / finalCompareAtPrice) * 100
    );
  }

  // ====== TỒN KHO ======
  let totalStock = 0;
  if (typeof product.stockQuantity === "number") {
    totalStock = product.stockQuantity;
  }
  if (Array.isArray(product.variants) && product.variants.length > 0) {
    totalStock = product.variants.reduce(
      (sum, v) => sum + (v.stockQuantity || 0),
      0
    );
  }
  const inStockComputed = totalStock > 0;

  const specsArr = Array.isArray(product.productSpecifications)
    ? product.productSpecifications
    : [];
  const specifications = specsArr.reduce((acc, spec) => {
    if (spec.attributeName && spec.attributeValue != null) {
      acc[spec.attributeName] = spec.attributeValue;
    }
    return acc;
  }, {});

  // ====== THU THẬP CÁC ATTRIBUTE VALUE ID TỪ VARIANTS ======
  let attributeValueIds = [];
  if (Array.isArray(product.variants) && product.variants.length > 0) {
    const set = new Set();
    for (const v of product.variants) {
      if (Array.isArray(v.attributeValues)) {
        v.attributeValues.forEach((val) => {
          if (!val) return;
          // nếu đã populate thì là object, nếu không thì là ObjectId/string
          const id = typeof val === "object" ? val._id : val;
          if (id) set.add(String(id));
        });
      }
    }
    attributeValueIds = Array.from(set);
  }

  const { reviews, productSpecifications, ...productData } = product;

  return {
    ...productData,
    price: finalPrice,
    compareAtPrice: finalCompareAtPrice,

    finalPrice,
    finalCompareAtPrice,
    attributePriceAdjustment: attributeAdjustment,
    discountPercent,

    ratings,
    stockQuantity: totalStock,
    inStock: inStockComputed,
    specifications,

    // 👈 FE sẽ dùng field này để lọc
    attributeValueIds,
  };
};
export const getAllProducts = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      sort = "createdAt",
      order = "DESC",
      category,
      search,
      minPrice,
      maxPrice,
      inStock,
      featured,
      status,
      minDiscountPercent, // dùng cho deal
    } = req.query;

    const query = {};

    // ====== SEARCH ======
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { shortDescription: { $regex: search, $options: "i" } },
        { searchKeywords: { $in: [new RegExp(search, "i")] } },
      ];
    }

    // ====== PRICE FILTER (theo price gốc) ======
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = parseFloat(minPrice);
      if (maxPrice) query.price.$lte = parseFloat(maxPrice);
    }

    // ====== FILTER KHÁC ======
    if (inStock !== undefined) query.inStock = inStock === "true";
    if (featured !== undefined) query.featured = featured === "true";
    query.status = status || "active";

    // ====== CATEGORY FILTER ======
    if (category) {
      const isValidUUID =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          category
        );
      if (isValidUUID) {
        query.categories = category;
      } else {
        const categoryDoc = await Category.findOne({ slug: category });
        if (categoryDoc) {
          query.categories = categoryDoc._id;
        }
      }
    }

    const pageNumber = parseInt(page);
    const limitNumber = parseInt(limit);
    const skip = (pageNumber - 1) * limitNumber;

    // Nếu sort theo discountPercent hoặc có minDiscountPercent
    // → sort/filter ở JS rồi mới phân trang
    const needJsSortOrFilter =
      sort === "discountPercent" || minDiscountPercent !== undefined;

    let mongoQuery = Product.find(query).populate(PRODUCT_LIST_POPULATE);

    if (!needJsSortOrFilter) {
      const sortOptions = {};
      sortOptions[sort] = order === "DESC" ? -1 : 1;
      mongoQuery = mongoQuery.sort(sortOptions).skip(skip).limit(limitNumber);
    }

    const productsRaw = await mongoQuery.lean();
    const totalBeforeFilter = await Product.countDocuments(query);

    // MAP bằng hàm chung
    let mapped = productsRaw.map(mapProductForList);

    // SORT discountPercent trên JS
    if (sort === "discountPercent") {
      mapped.sort((a, b) => {
        const da = a.discountPercent || 0;
        const db = b.discountPercent || 0;
        return order === "ASC" ? da - db : db - da;
      });
    }

    // FILTER minDiscountPercent trên JS
    if (minDiscountPercent !== undefined) {
      const min = Number(minDiscountPercent);
      if (!Number.isNaN(min)) {
        mapped = mapped.filter((p) => (p.discountPercent || 0) >= min);
      }
    }

    // total sau khi filter theo % giảm
    const total =
      minDiscountPercent !== undefined || sort === "discountPercent"
        ? mapped.length
        : totalBeforeFilter;

    // Nếu có sort/filter ở JS → phân trang ở đây
    let pagedProducts = mapped;
    if (needJsSortOrFilter) {
      const start = (pageNumber - 1) * limitNumber;
      const end = start + limitNumber;
      pagedProducts = mapped.slice(start, end);
    }

    res.status(200).json({
      status: "success",
      data: {
        total,
        pages: Math.ceil(total / limitNumber),
        currentPage: pageNumber,
        products: pagedProducts,
      },
    });
  } catch (error) {
    next(error);
  }
};


export const getProductById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const product = await Product.findById(id)
      .populate('categories', 'name slug')
      .populate('attributes')
      .populate('variants')
      .populate({
        path: 'productSpecifications',      // chính là ProductAttribute
        options: { sort: { section: 1, displayOrder: 1, attributeName: 1 } },
      })
      .populate({
        path: 'reviews',
        populate: { path: 'user', select: 'id firstName lastName avatar' },
      });

    if (!product) {
      throw new AppError('Không tìm thấy sản phẩm', 404);
    }

    const productJson = product.toJSON();

    // Tính rating
    const ratings = { average: 0, count: 0 };
    if (productJson.reviews && productJson.reviews.length > 0) {
      const totalRating = productJson.reviews.reduce(
        (sum, r) => sum + r.rating,
        0
      );
      ratings.average = parseFloat(
        (totalRating / productJson.reviews.length).toFixed(1)
      );
      ratings.count = productJson.reviews.length;
    }

    // Lấy bảo hành từ ProductWarranty
    let warrantyOptions = [];
    try {
      const productWarranties = await ProductWarranty.find({
        productId: product._id,
      })
        .populate({
          path: 'warrantyPackageId',
          match: { isActive: true },
        })
        .sort({
          'warrantyPackageId.displayOrder': 1,
          'warrantyPackageId.price': 1,
        })
        .lean();

      warrantyOptions = productWarranties
        .filter((pw) => pw.warrantyPackageId)
        .map((pw) => {
          const pkg = pw.warrantyPackageId;
          const base = pkg.price || 0;
          const finalPrice = pw.price && pw.price > 0 ? pw.price : base;

          return {
            _id: pkg._id,
            name: pkg.name,
            description: pkg.description,
            durationMonths: pkg.durationMonths,
            basePrice: base,
            price: finalPrice,
            isDefault: pw.isDefault,
            productWarrantyId: pw._id,
          };
        });
    } catch (e) {
      // Nếu phần bảo hành lỗi, vẫn trả về product, tránh 500
      console.error('Lỗi load warrantyOptions:', e);
    }

    res.status(200).json({
      status: 'success',
      data: {
        ...productJson,
        ratings,
        warrantyOptions,
      },
    });
  } catch (error) {
    console.error('getProductById error:', error);
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
        match: { isAvailable: true },
      })
      .populate({
        path: 'reviews',
        populate: { path: 'user', select: 'id firstName lastName avatar' },
      });
    // ⛔ BỎ populate('warrantyPackages'...) cũ

    if (!product) throw new AppError('Không tìm thấy sản phẩm', 404);

    const productJson = product.toJSON();
    const ratings = { average: 0, count: 0 };
    if (productJson.reviews && productJson.reviews.length > 0) {
      const totalRating = productJson.reviews.reduce(
        (sum, r) => sum + r.rating,
        0
      );
      ratings.average = parseFloat(
        (totalRating / productJson.reviews.length).toFixed(1)
      );
      ratings.count = productJson.reviews.length;
    }

    // ==== LẤY OPTIONS BẢO HÀNH TỪ ProductWarranty (cho trang slug) ====
    const productWarranties = await ProductWarranty.find({
      productId: product._id,
    })
      .populate({
        path: 'warrantyPackageId',
        match: { isActive: true },
      })
      .sort({
        'warrantyPackageId.displayOrder': 1,
        'warrantyPackageId.price': 1,
      })
      .lean();

    const warrantyOptions = productWarranties
      .filter((pw) => pw.warrantyPackageId)
      .map((pw) => {
        const pkg = pw.warrantyPackageId;
        const base = pkg.price || 0;
        const finalPrice = pw.price && pw.price > 0 ? pw.price : base;

        return {
          _id: pkg._id,
          name: pkg.name,
          description: pkg.description,
          durationMonths: pkg.durationMonths,
          basePrice: base,
          price: finalPrice,
          isDefault: pw.isDefault,
          productWarrantyId: pw._id,
        };
      });

    let responseData = { ...productJson, ratings, warrantyOptions };

    if (
      productJson.isVariantProduct &&
      productJson.variants &&
      productJson.variants.length > 0
    ) {
      let selectedVariant = skuId
        ? productJson.variants.find((v) => v._id.toString() === skuId)
        : null;
      if (!selectedVariant)
        selectedVariant =
          productJson.variants.find((v) => v.isDefault) ||
          productJson.variants[0];

      if (selectedVariant) {
        responseData = {
          ...responseData,
          currentVariant: {
            id: selectedVariant._id,
            name: selectedVariant.variantName,
            fullName: `${productJson.baseName || productJson.name} - ${selectedVariant.variantName
              }`,
            price: selectedVariant.price,
            compareAtPrice: selectedVariant.compareAtPrice,
            sku: selectedVariant.sku,
            stockQuantity: selectedVariant.stockQuantity,
            specifications: {
              ...productJson.specifications,
              ...selectedVariant.specifications,
            },
            images:
              selectedVariant.images && selectedVariant.images.length > 0
                ? selectedVariant.images
                : productJson.images,
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
          name: `${productJson.baseName || productJson.name} - ${selectedVariant.variantName
            }`,
          price: selectedVariant.price,
          compareAtPrice: selectedVariant.compareAtPrice,
          stockQuantity: selectedVariant.stockQuantity,
          sku: selectedVariant.sku,
          specifications: {
            ...productJson.specifications,
            ...selectedVariant.specifications,
          },
          images:
            selectedVariant.images && selectedVariant.images.length > 0
              ? selectedVariant.images
              : productJson.images,
        };
      }
    }

    res.status(200).json({ status: 'success', data: responseData });
  } catch (error) {
    next(error);
  }
};

// =================== ADDITIONAL USER ROUTES ===================


export const getNewArrivals = async (req, res, next) => {
  try {
    const products = await Product.find({ status: 'active' })
      .sort({ createdAt: -1 })
      .limit(10);
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

export const getFeaturedProducts = async (req, res, next) => {
  try {
    const raw = await Product.find({
      featured: true,
      status: "active",
    })
      .populate(PRODUCT_LIST_POPULATE)
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    const products = raw.map(mapProductForList);

    res.status(200).json({ status: "success", data: products });
  } catch (error) {
    next(error);
  }
};

export const getProductVariants = async (req, res, next) => {
  try {
    const { id } = req.params;
    const product = await Product.findById(id)

      .populate('variants');
    res
      .status(200)
      .json({ status: 'success', data: product?.variants || [] });
  } catch (error) {
    next(error);
  }
};

export const getProductReviewsSummary = async (req, res, next) => {
  try {
    const { id } = req.params;
    const product = await Product.findById(id).populate('reviews');
    const reviews = product?.reviews || [];
    const averageRating =
      reviews.length > 0
        ? reviews.reduce((a, r) => a + r.rating, 0) / reviews.length
        : 0;
    res.status(200).json({
      status: 'success',
      data: { averageRating, count: reviews.length },
    });
  } catch (error) {
    next(error);
  }
};

// =================== ADMIN ROUTES ===================

export const createProduct = async (req, res, next) => {
  try {
    const { name } = req.body;

    if (!name || !name.trim()) {
      throw new AppError('Tên sản phẩm là bắt buộc', 400);
    }

    const normalizedName = name.trim();

    // ✅ Kiểm tra trùng tên (có thể thêm điều kiện status nếu bạn có soft-delete)
    const existing = await Product.findOne({
      name: normalizedName,
      // status: { $ne: 'deleted' }  // nếu bạn có trạng thái xoá mềm
    });

    if (existing) {
      throw new AppError('Tên sản phẩm đã tồn tại', 400);
    }

    const newProduct = new Product({
      ...req.body,
      name: normalizedName,
    });

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
    if (!product) throw new AppError("Không tìm thấy sản phẩm", 404);

    console.log("🛠 updateProduct body:", req.body);

    if (req.body.name && req.body.name.trim()) {
      const newName = req.body.name.trim();

      if (newName !== product.name) {
        const existed = await Product.findOne({
          _id: { $ne: id },
          name: newName,
        });

        if (existed) {
          throw new AppError("Tên sản phẩm đã tồn tại", 400);
        }

        product.name = newName;
      }
    }

    Object.assign(product, { ...req.body, name: product.name });

    await product.save();

    res.status(200).json({ status: "success", data: product });
  } catch (error) {
    console.error("❌ updateProduct error:", error);
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
