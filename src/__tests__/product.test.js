const request = require('supertest');
const app = require('../app.js');
const { Product, Category } = require('../models/index.js');

describe('Product API', () => {
  let authToken;
  let testCategory;

  beforeAll(async () => {
    // Setup test data
    await Product.deleteMany({});
    await Category.deleteMany({});

    // Create test category
    testCategory = await Category.create({
      name: 'Test Category',
      slug: 'test-category',
      description: 'Test category description'
    });

    // Register and login to get token
    const userData = {
      firstName: 'Test',
      lastName: 'User',
      email: 'test@example.com',
      password: 'password123',
      phone: '1234567890'
    };

    await request(app)
      .post('/api/auth/register')
      .send(userData);

    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: userData.email,
        password: userData.password
      });

    authToken = loginResponse.body.data.token;
  });

  afterAll(async () => {
    // Cleanup
    await Product.deleteMany({});
    await Category.deleteMany({});
  });

  describe('POST /api/products', () => {
    it('should create a new product', async () => {
      const productData = {
        name: 'Test Product',
        description: 'Test product description',
        price: 99.99,
        categoryId: testCategory._id.toString(),
        stockQuantity: 100,
        inStock: true,
        sku: 'TEST-001'
      };

      const response = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${authToken}`)
        .send(productData)
        .expect(201);

      expect(response.body.status).toBe('success');
      expect(response.body.data.product).toHaveProperty('id');
      expect(response.body.data.product.name).toBe(productData.name);
    });
  });

  describe('GET /api/products', () => {
    it('should get all products', async () => {
      const response = await request(app)
        .get('/api/products')
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(Array.isArray(response.body.data.products)).toBe(true);
    });
  });

  describe('GET /api/products/:id', () => {
    let productId;

    beforeAll(async () => {
      // Create a product for testing
      const product = await Product.create({
        name: 'Test Product for Get',
        description: 'Test description',
        price: 49.99,
        categoryId: testCategory._id,
        stockQuantity: 50,
        inStock: true,
        sku: 'TEST-GET-001'
      });
      productId = product._id.toString();
    });

    it('should get product by id', async () => {
      const response = await request(app)
        .get(`/api/products/${productId}`)
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.product._id).toBe(productId);
    });
  });
});
