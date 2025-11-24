const dotenv = require('dotenv');
const connectDB = require('../config/mongodb.js');

// Load test environment variables
dotenv.config({ path: '.env.test' });

// Set test environment
process.env.NODE_ENV = 'test';

// Connect to test database
beforeAll(async () => {
  await connectDB();
});

// Clean up after each test
afterEach(async () => {
  // Add cleanup logic if needed
});

// Close database connection after all tests
afterAll(async () => {
  // Add cleanup logic if needed
});
