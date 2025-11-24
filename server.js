import 'dotenv/config'; 

import app from './src/app.js';
import connectDB from './src/config/mongodb.js';
import logger from './src/utils/logger.js';
import process from 'process';
import morgan from "morgan";


// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error('UNCAUGHT EXCEPTION! 💥 Shutting down...');
  logger.error(err.name, err.message);
  logger.error(err.stack);
  process.exit(1);
});

// Start server
const startServer = async () => {
  // Connect to MongoDB
  await connectDB();

  const PORT = process.env.PORT || 8888;
  const server = app.listen(PORT, () => {
    logger.info(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
  });

  process.on('unhandledRejection', (err) => {
    logger.error('UNHANDLED REJECTION! 💥 Shutting down...');
    logger.error(err.name, err.message);
    server.close(() => process.exit(1));
  });

  process.on('SIGTERM', () => {
    logger.info('👋 SIGTERM RECEIVED. Shutting down gracefully');
    server.close(() => {
      logger.info('💥 Process terminated!');
    });
  });
};

app.use(morgan("dev"));


startServer();
