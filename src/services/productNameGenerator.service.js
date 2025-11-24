// services/productNameGenerator.service.js
import { AttributeValue, AttributeGroup } from '../models/index.js';

/**
 * Service for generating dynamic product names based on selected attributes
 */
class ProductNameGeneratorService {
  /**
   * Generate product name from baseName and selected attribute IDs
   */
  async generateProductName(baseName, selectedAttributes = [], separator = ' ') {
    try {
      if (!baseName) throw new Error('Base name is required');
      if (!selectedAttributes.length) return baseName;

      const attributeValues = await AttributeValue.findAll({
        where: {
          id: selectedAttributes,
          affectsName: true,
          isActive: true,
        },
        include: [
          {
            model: AttributeGroup,
            as: 'group', // phải trùng alias trong models/index.js
            attributes: ['name', 'type', 'sortOrder'],
          },
        ],
        order: [
          [{ model: AttributeGroup, as: 'group' }, 'sortOrder', 'ASC'],
          ['sortOrder', 'ASC'],
        ],
      });

      if (!attributeValues.length) return baseName;

      const nameParts = [baseName];
      for (const attrValue of attributeValues) {
        const nameToAdd = attrValue.nameTemplate || attrValue.name;
        if (nameToAdd?.trim()) nameParts.push(nameToAdd.trim());
      }

      return nameParts.join(separator);
    } catch (error) {
      console.error('Error generating product name:', error);
      throw error;
    }
  }

  /**
   * Generate variant name from baseName and attributesCombination object
   */
  async generateVariantName(baseName, attributesCombination = {}, separator = ' ') {
    const selectedAttributeIds = Object.values(attributesCombination).filter(Boolean);
    return this.generateProductName(baseName, selectedAttributeIds, separator);
  }

  /**
   * Preview generated product name with optional details
   */
  async previewProductName(baseName, selectedAttributes = [], options = {}) {
    try {
      const { separator = ' ', includeDetails = false } = options;

      const generatedName = await this.generateProductName(baseName, selectedAttributes, separator);
      const result = {
        originalName: baseName,
        generatedName,
        hasChanges: generatedName !== baseName,
        parts: generatedName.split(separator),
      };

      if (includeDetails) {
        const attributeValues = await AttributeValue.findAll({
          where: {
            id: selectedAttributes,
            affectsName: true,
            isActive: true,
          },
          include: [
            {
              model: AttributeGroup,
              as: 'group',
              attributes: ['id', 'name', 'type'],
            },
          ],
        });

        result.affectingAttributes = attributeValues.map((attr) => ({
          id: attr.id,
          name: attr.name,
          nameTemplate: attr.nameTemplate,
          groupName: attr.group?.name,
          groupType: attr.group?.type,
        }));
      }

      return result;
    } catch (error) {
      console.error('Error previewing product name:', error);
      throw error;
    }
  }

  /**
   * Get all attributes that affect product names
   */
  async getNameAffectingAttributes(productId = null) {
    try {
      const attributeValues = await AttributeValue.findAll({
        where: { affectsName: true, isActive: true },
        include: [
          {
            model: AttributeGroup,
            as: 'group',
            attributes: ['id', 'name', 'type', 'description'],
            where: { isActive: true },
          },
        ],
        order: [
          [{ model: AttributeGroup, as: 'group' }, 'sortOrder', 'ASC'],
          ['sortOrder', 'ASC'],
        ],
      });

      return attributeValues;
    } catch (error) {
      console.error('Error getting name affecting attributes:', error);
      throw error;
    }
  }

  /**
   * Batch generate product names for multiple items
   */
  async batchGenerateNames(items = [], separator = ' ') {
    try {
      const results = [];

      for (const item of items) {
        const { baseName, selectedAttributes, id } = item;
        const generatedName = await this.generateProductName(baseName, selectedAttributes, separator);
        results.push({ id, baseName, generatedName, selectedAttributes });
      }

      return results;
    } catch (error) {
      console.error('Error batch generating names:', error);
      throw error;
    }
  }
}

export default new ProductNameGeneratorService();
