import express from 'express';

// Import route modules
import authRoutes from './auth.routes.js';
import userRoutes from './user.routes.js';
import categoryRoutes from './category.routes.js';
import productRoutes from './product.routes.js';
import cartRoutes from './cart.routes.js';
import orderRoutes from './order.routes.js';
import reviewRoutes from './review.routes.js';
import wishlistRoutes from './wishlist.routes.js';
import adminRoutes from './admin.routes.js';
import uploadRoutes from './upload.routes.js';
import paymentRoutes from './payment.routes.js';
import chatbotRoutes from './chatbot.routes.js';
import warrantyPackageRoutes from './warrantyPackages.js';
import attributeRoutes from './attributeRoutes.js';
import imageRoutes from './image.routes.js';
import repairRequestsRouter from './repairRequests.js'
// THÊM: route cấu hình bảo hành theo sản phẩm
import productWarrantyRoutes from './productWarranties.js';
import productAttributeRoutes from './productAttribute.Routes.js';
import couponRoutes from './couponUser.routes.js.js'
const router = express.Router();

// API routes
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/categories', categoryRoutes);
router.use('/products', productRoutes);
router.use('/cart', cartRoutes);
router.use('/orders', orderRoutes);
router.use('/reviews', reviewRoutes);
router.use('/wishlist', wishlistRoutes);
router.use('/upload', uploadRoutes);
router.use('/admin', adminRoutes);
router.use('/payments', paymentRoutes);
router.use('/chatbot', chatbotRoutes);
router.use('/warranty-packages', warrantyPackageRoutes);
router.use('/attributes', attributeRoutes);
router.use('/images', imageRoutes);
router.use('/coupons', couponRoutes);

// THÊM DÒNG NÀY
router.use('/product-warranties', productWarrantyRoutes);
router.use("/repair-requests", repairRequestsRouter);
router.use('/product-attributes', productAttributeRoutes);
// Health check route
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'API is running',
    timestamp: new Date().toISOString(),
  });
});

export default router;
