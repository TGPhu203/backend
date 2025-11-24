/**
 * Product Helper Functions
 * Utilities for managing product stock and variants
 */

import { ProductVariant } from '../models/index.js';

/**
 * Calculate total stock from variants
 * @param {Array} variants - Array of product variants
 * @returns {number} Total stock quantity
 */
export const calculateTotalStock = (variants) => {
  if (!variants || variants.length === 0) return 0;
  return variants.reduce(
    (total, variant) => total + (variant.stockQuantity || 0),
    0
  );
};

/**
 * Update product total stock based on variants
 * @param {string} productId - Product ID
 * @param {Object} Product - Product model
 * @returns {Promise<number>} Updated total stock
 */
export const updateProductTotalStock = async (productId, Product) => {
  try {
    const variants = await ProductVariant.findAll({
      where: { productId },
      attributes: ['stockQuantity'],
    });

    const totalStock = calculateTotalStock(variants);

    await Product.update(
      {
        stockQuantity: totalStock,
        inStock: totalStock > 0,
      },
      { where: { id: productId } }
    );

    return totalStock;
  } catch (error) {
    console.error('Error updating product total stock:', error);
    throw error;
  }
};

/**
 * Validate variant attributes against product attributes
 */
export const validateVariantAttributes = (productAttributes, variantAttributes) => {
  if (!productAttributes || productAttributes.length === 0) return true;
  if (!variantAttributes) return true;

  for (const productAttr of productAttributes) {
    const variantValue = variantAttributes[productAttr.name];
    if (!variantValue) continue;

    if (productAttr.values && Array.isArray(productAttr.values)) {
      if (!productAttr.values.includes(variantValue)) {
        console.log(
          `Giá trị biến thể không hợp lệ: ${variantValue} không nằm trong ${productAttr.values.join(', ')}`
        );
        return false;
      }
    }
  }

  return true;
};

/**
 * Generate variant SKU
 */
export const generateVariantSku = (productSku, attributes) => {
  const suffix = Object.values(attributes)
    .map((value) => value.toUpperCase().replace(/\s+/g, ''))
    .join('-');

  return `${productSku}-${suffix}`;
};

/**
 * Check if product has variants
 */
export const hasVariants = (product) => {
  return product.variants && product.variants.length > 0;
};

/**
 * Get available stock for specific attribute combination
 */
export const getVariantStock = (variants, selectedAttributes) => {
  if (!variants || variants.length === 0) return 0;

  const matchingVariant = variants.find((variant) => {
    return Object.entries(selectedAttributes).every(
      ([key, value]) => variant.attributes[key] === value
    );
  });

  return matchingVariant ? matchingVariant.stockQuantity : 0;
};

/**
 * Get variant by attributes
 */
export const findVariantByAttributes = (variants, selectedAttributes) => {
  if (!variants || variants.length === 0) return null;

  return variants.find((variant) => {
    return Object.entries(selectedAttributes).every(
      ([key, value]) => variant.attributes[key] === value
    );
  });
};
