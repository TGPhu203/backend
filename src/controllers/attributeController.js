// controllers/attributeController.js
import {
  AttributeGroup,
  AttributeValue,
  ProductAttributeGroup,
  Product,
  ProductVariant,
} from '../models/index.js';
import productNameGeneratorService from '../services/productNameGenerator.service.js';

// Get all attribute groups with their values
const getAttributeGroups = async (req, res) => {
  try {
    const attributeGroups = await AttributeGroup.find({ isActive: true })
      .populate({
        path: 'values',
        match: { isActive: true },
        options: { sort: { sortOrder: 1, name: 1 } },
      })
      .sort({ sortOrder: 1, name: 1 });

    res.json({
      success: true,
      data: attributeGroups,
    });
  } catch (error) {
    console.error('Error fetching attribute groups:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch attribute groups',
      error: error.message,
    });
  }
};

const getProductAttributeGroups = async (req, res) => {
  try {
    const { productId } = req.params;

    // kiểm tra product tồn tại (optional nhưng nên có)
    const productExists = await Product.exists({ _id: productId });
    if (!productExists) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    const groups = await ProductAttributeGroup.find({ productId })
      .populate({
        path: 'attributeGroupId',
        match: { isActive: true },
        populate: {
          path: 'values',
          match: { isActive: true },
          options: { sort: { sortOrder: 1, name: 1 } },
        },
      })
      .sort({ sortOrder: 1 });

    res.json({
      success: true,
      data: groups,
    });
  } catch (error) {
    console.error('Error fetching product attribute groups:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch product attribute groups',
      error: error.message,
    });
  }
};

// Create new attribute group
const createAttributeGroup = async (req, res) => {
  try {
    const { name, description, type, isRequired, sortOrder } = req.body;

    const attributeGroup = new AttributeGroup({
      name,
      description,
      type,
      isRequired,
      sortOrder,
    });
    await attributeGroup.save();

    res.status(201).json({
      success: true,
      data: attributeGroup,
      message: 'Attribute group created successfully',
    });
  } catch (error) {
    console.error('Error creating attribute group:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create attribute group',
      error: error.message,
    });
  }
};

// Add attribute value to group
const addAttributeValue = async (req, res) => {
  try {
    const { attributeGroupId } = req.params;
    const {
      name,
      value,
      colorCode,
      imageUrl,
      priceAdjustment,
      sortOrder,
      affectsName,
      nameTemplate,
    } = req.body;

    const attributeValue = new AttributeValue({
      attributeGroupId,
      name,
      value,
      colorCode,
      imageUrl,
      priceAdjustment,
      sortOrder,
      affectsName: affectsName || false,
      nameTemplate,
    });
    await attributeValue.save();

    res.status(201).json({
      success: true,
      data: attributeValue,
      message: 'Attribute value added successfully',
    });
  } catch (error) {
    console.error('Error adding attribute value:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add attribute value',
      error: error.message,
    });
  }
};
// Assign attribute group to product
const assignAttributeGroupToProduct = async (req, res) => {
  try {
    const { productId, attributeGroupId } = req.params;
    const { isRequired, sortOrder } = req.body;

    // optional: kiểm tra group tồn tại và đang active
    const group = await AttributeGroup.findOne({
      _id: attributeGroupId,
      isActive: true,
    });
    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Attribute group not found or inactive',
      });
    }

    const assignment = await ProductAttributeGroup.findOneAndUpdate(
      { productId, attributeGroupId },
      {
        productId,
        attributeGroupId,
        isRequired: !!isRequired,
        sortOrder: sortOrder ?? 0,
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      }
    );

    res.status(201).json({
      success: true,
      data: assignment,
      message: 'Attribute group assigned to product successfully',
    });
  } catch (error) {
    console.error('Error assigning attribute group to product:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to assign attribute group to product',
      error: error.message,
    });
  }
};

// Update attribute group
const updateAttributeGroup = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, type, isRequired, sortOrder, isActive } =
      req.body;

    const attributeGroup = await AttributeGroup.findByIdAndUpdate(id, {
      name,
      description,
      type,
      isRequired,
      sortOrder,
      isActive,
    }, { new: true });

    if (!attributeGroup) {
      return res.status(404).json({
        success: false,
        message: 'Attribute group not found',
      });
    }

    res.json({
      success: true,
      data: attributeGroup,
      message: 'Attribute group updated successfully',
    });
  } catch (error) {
    console.error('Error updating attribute group:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update attribute group',
      error: error.message,
    });
  }
};

// Update attribute value
const updateAttributeValue = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      value,
      colorCode,
      imageUrl,
      priceAdjustment,
      sortOrder,
      isActive,
      affectsName,
      nameTemplate,
    } = req.body;

    const attributeValue = await AttributeValue.findByIdAndUpdate(id, {
      name,
      value,
      colorCode,
      imageUrl,
      priceAdjustment,
      sortOrder,
      isActive,
      affectsName,
      nameTemplate,
    }, { new: true });

    if (!attributeValue) {
      return res.status(404).json({
        success: false,
        message: 'Attribute value not found',
      });
    }

    res.json({
      success: true,
      data: attributeValue,
      message: 'Attribute value updated successfully',
    });
  } catch (error) {
    console.error('Error updating attribute value:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update attribute value',
      error: error.message,
    });
  }
};

// Delete attribute group
const deleteAttributeGroup = async (req, res) => {
  try {
    const { id } = req.params;

    const attributeGroup = await AttributeGroup.findByIdAndUpdate(id, { isActive: false }, { new: true });

    if (!attributeGroup) {
      return res.status(404).json({
        success: false,
        message: 'Attribute group not found',
      });
    }

    res.json({
      success: true,
      message: 'Attribute group deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting attribute group:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete attribute group',
      error: error.message,
    });
  }
};

// Delete attribute value
const deleteAttributeValue = async (req, res) => {
  try {
    const { id } = req.params;

    const attributeValue = await AttributeValue.findByIdAndUpdate(id, { isActive: false }, { new: true });

    if (!attributeValue) {
      return res.status(404).json({
        success: false,
        message: 'Attribute value not found',
      });
    }

    res.json({
      success: true,
      message: 'Attribute value deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting attribute value:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete attribute value',
      error: error.message,
    });
  }
};

// Preview product name with selected attributes
const previewProductName = async (req, res) => {
  try {
    const { baseName, selectedAttributes, separator, includeDetails } =
      req.body;

    if (!baseName) {
      return res.status(400).json({
        success: false,
        message: 'Base name is required',
      });
    }

    const preview = await productNameGeneratorService.previewProductName(
      baseName,
      selectedAttributes || [],
      {
        separator: separator || ' ',
        includeDetails: includeDetails || false,
      }
    );

    res.json({
      success: true,
      data: preview,
      message: 'Product name preview generated successfully',
    });
  } catch (error) {
    console.error('Error previewing product name:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to preview product name',
      error: error.message,
    });
  }
};

// Get attributes that affect product names
const getNameAffectingAttributes = async (req, res) => {
  try {
    const { productId } = req.query;

    const attributes =
      await productNameGeneratorService.getNameAffectingAttributes(productId);

    res.json({
      success: true,
      data: attributes,
      message: 'Name affecting attributes retrieved successfully',
    });
  } catch (error) {
    console.error('Error getting name affecting attributes:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get name affecting attributes',
      error: error.message,
    });
  }
};

// Batch generate product names
const batchGenerateProductNames = async (req, res) => {
  try {
    const { items, separator } = req.body;

    if (!Array.isArray(items)) {
      return res.status(400).json({
        success: false,
        message: 'Items must be an array',
      });
    }

    const results = await productNameGeneratorService.batchGenerateNames(
      items,
      separator || ' '
    );

    res.json({
      success: true,
      data: results,
      message: 'Product names generated successfully',
    });
  } catch (error) {
    console.error('Error batch generating product names:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate product names',
      error: error.message,
    });
  }
};

// Real-time name generation for dynamic forms
const generateNameRealTime = async (req, res) => {
  try {
    const { baseName, attributeValues, productId } = req.body;

    if (!baseName) {
      return res.status(400).json({
        success: false,
        message: 'Base name is required',
      });
    }

    const selectedAttributes = Array.isArray(attributeValues)
      ? attributeValues
      : Object.values(attributeValues || {}).filter((id) => id);

    const preview = await productNameGeneratorService.previewProductName(
      baseName,
      selectedAttributes,
      {
        separator: ' ',
        includeDetails: true,
      }
    );

    let suggestions = [];
    if (productId) {
      suggestions = await getPopularAttributeCombinations(productId);
    }

    res.json({
      success: true,
      data: {
        ...preview,
        suggestions,
        timestamp: new Date().toISOString(),
      },
      message: 'Real-time name generated successfully',
    });
  } catch (error) {
    console.error('Error generating real-time name:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate real-time name',
      error: error.message,
    });
  }
};

// Helper function to get popular attribute combinations
const getPopularAttributeCombinations = async (productId) => {
  try {
    const existingVariants = await ProductVariant.find({ productId })
      .select('attributeValues displayName name')
      .sort({ createdAt: -1 })
      .limit(10);

    return existingVariants.map((variant) => ({
      attributeValues: variant.attributeValues,
      displayName: variant.displayName,
      fullName: variant.name,
    }));
  } catch (error) {
    console.log('Could not get popular combinations:', error.message);
    return [];
  }
};
const removeAttributeGroupFromProduct = async (req, res) => {
  try {
    const { productId, attributeGroupId } = req.params;

    const deleted = await ProductAttributeGroup.findOneAndDelete({
      productId,
      attributeGroupId,
    });

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Product attribute group not found',
      });
    }

    res.json({
      success: true,
      message: 'Attribute group removed from product successfully',
    });
  } catch (error) {
    console.error('Error removing attribute group from product:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove attribute group from product',
      error: error.message,
    });
  }
};
const getAttributeValuesByGroup = async (req, res) => {
  try {
    const { attributeGroupId } = req.params;

    const values = await AttributeValue.find({
      attributeGroupId,
      isActive: { $ne: false },
    }).sort({ sortOrder: 1, name: 1 });

    res.json({
      success: true,
      data: values,
      message: 'Attribute values fetched successfully',
    });
  } catch (error) {
    console.error('Error fetching attribute values:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch attribute values',
      error: error.message,
    });
  }
};
export default {
  getAttributeGroups,
  getProductAttributeGroups,
  createAttributeGroup,
  addAttributeValue,
  assignAttributeGroupToProduct,
  updateAttributeGroup,
  updateAttributeValue,
  deleteAttributeGroup,
  deleteAttributeValue,
  previewProductName,
  getNameAffectingAttributes,
  batchGenerateProductNames,
  generateNameRealTime,
  removeAttributeGroupFromProduct,
  getAttributeValuesByGroup
};
