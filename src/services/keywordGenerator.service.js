class KeywordGeneratorService {
  generateKeywords(productData) {
    const keywords = new Set();

    if (productData.name) {
      this.extractWords(productData.name).forEach((w) => keywords.add(w));
    }
    if (productData.shortDescription) {
      this.extractWords(productData.shortDescription).forEach((w) => keywords.add(w));
    }
    if (productData.description) {
      this.extractWords(productData.description).forEach((w) => keywords.add(w));
    }
    if (productData.category) {
      this.extractWords(productData.category).forEach((w) => keywords.add(w));
    }

    this.extractBrandKeywords(productData.name).forEach((w) => keywords.add(w));
    this.getCategoryKeywords(productData).forEach((w) => keywords.add(w));

    return Array.from(keywords)
      .filter((k) => k.length > 2)
      .map((k) => k.toLowerCase())
      .slice(0, 20);
  }

  extractWords(text) {
    if (!text) return [];
    const words = text
      .toLowerCase()
      .replace(/[^\w\sàáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2);

    const stopWords = ['của','với','cho','và','hoặc','the','for','with','and','or'];
    return words.filter((w) => !stopWords.includes(w));
  }

  extractBrandKeywords(productName) {
    if (!productName) return [];
    const brandMappings = {
      nike: ['nike', 'swoosh', 'just do it'],
      adidas: ['adidas', '3-stripes', 'three stripes'],
      converse: ['converse', 'chuck taylor', 'all star'],
      vans: ['vans', 'off the wall'],
      puma: ['puma', 'suede'],
      uniqlo: ['uniqlo', 'ut', 'heattech'],
      champion: ['champion', 'reverse weave'],
      'louis vuitton': ['lv','louis vuitton','neverfull','monogram'],
      gucci: ['gucci','gg','marmont'],
      'michael kors': ['mk','michael kors','jet set'],
      rolex: ['rolex','submariner','datejust','oyster'],
      casio: ['casio','g-shock','edifice'],
      'ray-ban': ['ray-ban','rayban','aviator','wayfarer'],
      oakley: ['oakley','holbrook','frogskins'],
    };

    const keywords = [];
    const lowerName = productName.toLowerCase();
    for (const [brand, ks] of Object.entries(brandMappings)) {
      if (lowerName.includes(brand)) keywords.push(...ks);
    }
    return keywords;
  }

  getCategoryKeywords(productData) {
    const keywords = [];
    const name = (productData.name || '').toLowerCase();
    const category = (productData.category || '').toLowerCase();
    const desc = (productData.shortDescription || '').toLowerCase();

    if (name.includes('giày') || name.includes('shoe') || name.includes('sneaker') || category.includes('giày') || desc.includes('giày')) {
      keywords.push('giày','shoes','sneaker','footwear','thể thao','sport');
    }
    if (name.includes('áo') || name.includes('shirt') || name.includes('tshirt') || category.includes('áo') || desc.includes('áo')) {
      keywords.push('áo','shirt','tshirt','top','clothing','fashion');
    }
    if (name.includes('túi') || name.includes('bag') || category.includes('túi') || desc.includes('túi')) {
      keywords.push('túi','bag','handbag','purse','accessory');
    }
    if (name.includes('balo') || name.includes('backpack') || category.includes('balo') || desc.includes('balo')) {
      keywords.push('balo','backpack','bag','school','travel');
    }
    if (name.includes('đồng hồ') || name.includes('watch') || category.includes('đồng hồ') || desc.includes('đồng hồ')) {
      keywords.push('đồng hồ','watch','timepiece','accessory');
    }
    if (name.includes('kính') || name.includes('glasses') || name.includes('sunglasses') || category.includes('kính') || desc.includes('kính')) {
      keywords.push('kính','glasses','sunglasses','eyewear','accessory');
    }

    return keywords;
  }

  async updateProductKeywords(product) {
    const keywords = this.generateKeywords({
      name: product.name,
      shortDescription: product.shortDescription,
      description: product.description,
      category: product.category,
    });
    await product.updateOne({ searchKeywords: keywords });
    return keywords;
  }

  async updateAllProductKeywords() {
    const { Product } = await import('../models/index.js');

    const products = await Product.find({ status: 'active' });
    console.log(`🔄 Updating keywords for ${products.length} products...`);

    for (const product of products) {
      const keywords = this.generateKeywords({
        name: product.name,
        shortDescription: product.shortDescription,
        description: product.description,
        category: product.category,
      });
      await product.updateOne({ searchKeywords: keywords });
      console.log(`✅ Updated keywords for: ${product.name}`);
    }

    console.log('🎉 All product keywords updated successfully!');
    return true;
  }
}

export default new KeywordGeneratorService();
