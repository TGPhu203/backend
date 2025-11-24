import { Sequelize } from 'sequelize';
import config from './database.js'; // lưu ý thêm .js

const env = process.env.NODE_ENV || 'development';
const dbConfig = config[env];

const sequelize = new Sequelize(
  dbConfig.database,
  dbConfig.username,
  dbConfig.password,
  {
    host: dbConfig.host,
    port: dbConfig.port,
    dialect: dbConfig.dialect,
    logging: dbConfig.logging,
    define: dbConfig.define,
    pool: dbConfig.pool,
  }
);

// Test kết nối
sequelize.authenticate()
  .then(() => console.log(`MySQL database connected (${env} environment)`))
  .catch(err => console.error('Unable to connect to the database:', err));

export default sequelize;
