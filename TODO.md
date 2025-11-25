# MIGRATION FROM MySQL TO MongoDB - TODO LIST

## Phase 1: Dependencies ✅
- [x] Install mongoose
- [x] Uninstall sequelize, mysql2, pg, pg-hstore

## Phase 2: Database Configuration
- [ ] Create MongoDB configuration file
- [ ] Update environment variables documentation
- [ ] Update server.js connection logic

## Phase 3: Convert Models (22 models) ✅
- [x] User model
- [x] Address model
- [x] Category model
- [x] Product model
- [x] ProductVariant model
- [x] ProductAttribute model
- [x] ProductSpecification model
- [x] ProductCategory model (junction → reference)
- [x] ProductAttributeGroup model (junction)
- [x] ProductWarranty model (junction)
- [x] Review model
- [x] ReviewFeedback model
- [x] Cart model
- [x] CartItem model
- [x] Order model
- [x] OrderItem model
- [x] Wishlist model (junction → embedded)
- [x] WarrantyPackage model
- [x] AttributeGroup model
- [x] AttributeValue model
- [x] Image model
- [x] Update models/index.js

## Phase 4: Update Controllers (13 controllers)
- [x] product.controller.js
- [x] 
- [x] cart.controller.js
- [x] order.controller.js
- [x] user.controller.js
- [x] category.controller.js
- [x] review.controller.js
- [x] admin.controller.js
- [x] chatbot.controller.js
- [x] attributeController.js
- [x] imageController.js
- [x] payment.controller.js
- [x] warrantyPackageController.js
- [x] wishlist.controller.js
- [x] upload.controller.js

## Phase 5: Update Services
- [x] chatbot.service.js
- [x] geminiChatbot.service.js
- [x] imageService.js - Có thể sử dụng models
- [x] keywordGenerator.service.js - Có thể sử dụng models

## Phase 6: Update Middleware
- [x] errorHandler.js (Sequelize errors → Mongo errors)

## Phase 7: Testing
- [ ] Test all endpoints
- [ ] Verify data integrity
- [ ] Performance testing

## Phase 8: Cleanup
- [ ] Remove old Sequelize config files
- [ ] Update package.json scripts
- [ ] Update documentation
