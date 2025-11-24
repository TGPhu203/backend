import { Category, Product } from '../models/index.js';
import { AppError } from '../middlewares/errorHandler.js';

// Get all categories
export const getAllCategories = async (req, res, next) => {
  try {
    const categories = await Category.find()
      .sort({ sortOrder: 1, name: 1 });

    // Get product counts for each category using aggregation
    const categoryCounts = await Product.aggregate([
      { $unwind: '$categories' },
      {
        $group: {
          _id: '$categories',
          count: { $sum: 1 }
        }
      }
    ]);

    const countMap = {};
    categoryCounts.forEach((item) => {
      countMap[item._id.toString()] = item.count;
    });

    const categoriesWithCount = categories.map((category) => {
      const categoryData = category.toObject();
      categoryData.productCount = countMap[category._id.toString()] || 0;
      return categoryData;
    });

    res.status(200).json({
      status: 'success',
      data: categoriesWithCount,
    });
  } catch (error) {
    next(error);
  }
};

// Get category tree
export const getCategoryTree = async (req, res, next) => {
  try {
    const allCategories = await Category.find({ isActive: true })
      .sort({ sortOrder: 1, name: 1 });

    const rootCategories = [];
    const categoryMap = {};

    allCategories.forEach((category) => {
      categoryMap[category._id.toString()] = {
        ...category.toObject(),
        children: [],
      };
    });

    allCategories.forEach((category) => {
      if (category.parentId) {
        const parentIdStr = category.parentId.toString();
        if (categoryMap[parentIdStr]) {
          categoryMap[parentIdStr].children.push(categoryMap[category._id.toString()]);
        }
      } else {
        rootCategories.push(categoryMap[category._id.toString()]);
      }
    });

    res.status(200).json({
      status: 'success',
      data: rootCategories,
    });
  } catch (error) {
    next(error);
  }
};

// Get category by ID
export const getCategoryById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const category = await Category.findById(id)
      .populate('parentId', 'name slug')
      .populate('children', 'name slug image', { isActive: true });

    if (!category) throw new AppError('Không tìm thấy danh mục', 404);

    res.status(200).json({
      status: 'success',
      data: category,
    });
  } catch (error) {
    next(error);
  }
};

// Get category by slug
export const getCategoryBySlug = async (req, res, next) => {
  try {
    const { slug } = req.params;

    const category = await Category.findOne({ slug })
      .populate('parentId', 'name slug')
      .populate('children', 'name slug image', { isActive: true });

    if (!category) throw new AppError('Không tìm thấy danh mục', 404);

    res.status(200).json({
      status: 'success',
      data: category,
    });
  } catch (error) {
    next(error);
  }
};

// Create category
export const createCategory = async (req, res, next) => {
  try {
    const { name, description, image, parentId, isActive, sortOrder } = req.body;

    if (parentId) {
      const parentCategory = await Category.findById(parentId);
      if (!parentCategory) throw new AppError('Danh mục cha không tồn tại', 400);
    }

    const category = new Category({
      name,
      description,
      image,
      parentId,
      isActive,
      sortOrder,
      level: parentId ? 2 : 1,
    });

    await category.save();

    res.status(201).json({
      status: 'success',
      data: category,
    });
  } catch (error) {
    next(error);
  }
};

// Update category
export const updateCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, description, image, parentId, isActive, sortOrder } = req.body;

    const category = await Category.findById(id);
    if (!category) throw new AppError('Không tìm thấy danh mục', 404);

    if (parentId && parentId !== category.parentId?.toString()) {
      if (parentId === id) throw new AppError('Danh mục không thể là danh mục cha của chính nó', 400);

      const parentCategory = await Category.findById(parentId);
      if (!parentCategory) throw new AppError('Danh mục cha không tồn tại', 400);

      const childCategories = await Category.find({ parentId: id });
      const childIds = childCategories.map((child) => child._id.toString());
      if (childIds.includes(parentId)) throw new AppError('Không thể chọn danh mục con làm danh mục cha', 400);
    }

    if (name !== undefined) category.name = name;
    if (description !== undefined) category.description = description;
    if (image !== undefined) category.image = image;
    if (parentId !== undefined) category.parentId = parentId;
    if (isActive !== undefined) category.isActive = isActive;
    if (sortOrder !== undefined) category.sortOrder = sortOrder;
    category.level = parentId ? 2 : 1;

    await category.save();

    res.status(200).json({
      status: 'success',
      data: category,
    });
  } catch (error) {
    next(error);
  }
};

// Delete category
export const deleteCategory = async (req, res, next) => {
  try {
    const { id } = req.params;

    const category = await Category.findById(id);
    if (!category) throw new AppError('Không tìm thấy danh mục', 404);

    const childCategories = await Category.find({ parentId: id });
    if (childCategories.length > 0) throw new AppError('Không thể xóa danh mục có danh mục con', 400);

    // Check if category has products
    const productCount = await Product.countDocuments({ categories: id });
    if (productCount > 0) throw new AppError('Không thể xóa danh mục có sản phẩm', 400);

    await category.deleteOne();

    res.status(200).json({
      status: 'success',
      message: 'Xóa danh mục thành công',
    });
  } catch (error) {
    next(error);
  }
};

// Get products by category
export const getProductsByCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 10, sort = 'createdAt', order = 'DESC' } = req.query;

    const category = await Category.findById(id);
    if (!category) throw new AppError('Không tìm thấy danh mục', 404);

    const childCategories = await Category.find({ parentId: id });
    const categoryIds = [id, ...childCategories.map((cat) => cat._id)];

    const sortOptions = {};
    sortOptions[sort] = order === 'DESC' ? -1 : 1;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const products = await Product.find({ categories: { $in: categoryIds } })
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit))
      .populate('categories', 'name slug');

    const total = await Product.countDocuments({ categories: { $in: categoryIds } });

    res.status(200).json({
      status: 'success',
      data: {
        total,
        pages: Math.ceil(total / limit),
        currentPage: parseInt(page),
        products,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get featured categories
export const getFeaturedCategories = async (req, res, next) => {
  try {
    // Find categories that have featured products
    const categoriesWithFeatured = await Product.distinct('categories', { featured: true });

    if (categoriesWithFeatured.length === 0) {
      // If no featured products, return top 5 root categories
      const topCategories = await Category.find({ isActive: true, parentId: null })
        .sort({ sortOrder: 1, name: 1 })
        .limit(5);
      return res.status(200).json({ status: 'success', data: topCategories });
    }

    // Get categories that have featured products
    const categories = await Category.find({
      _id: { $in: categoriesWithFeatured },
      isActive: true
    })
      .sort({ sortOrder: 1, name: 1 });

    res.status(200).json({ status: 'success', data: categories });
  } catch (error) {
    next(error);
  }
};
