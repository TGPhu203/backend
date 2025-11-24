import swaggerJsdoc from 'swagger-jsdoc';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'E-commerce API Documentation (Web & Mobile)',
      version: '1.0.0',
      description: `
API documentation cho Website ReactJS và React Native app.
Endpoints hỗ trợ: sản phẩm, user, order, dịch vụ kỹ thuật, chatbot AI, thanh toán...
      `,
      contact: {
        name: 'API Support',
        email: 'support@example.com',
      },
    },
    servers: [
      {
        url: process.env.API_URL || 'http://10.0.2.2:5000',
        description: 'Development server for Web & React Native',
      },
      {
        url: process.env.PROD_API_URL || 'https://api.yourdomain.com',
        description: 'Production server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: [
    './src/routes/*.js',
    './src/controllers/*.js',
    './src/models/*.js',
  ],
};

const swaggerSpec = swaggerJsdoc(options);

export default swaggerSpec;
