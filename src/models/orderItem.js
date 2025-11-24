import mongoose from 'mongoose';

const orderItemSchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: [true, 'Order ID is required'],
      index: true,
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: [true, 'Product ID is required'],
      index: true,
    },
    variantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ProductVariant',
      index: true,
    },
    productName: {
      type: String,
      required: [true, 'Product name is required'],
    },
    variantName: {
      type: String,
    },
    sku: {
      type: String,
    },
    quantity: {
      type: Number,
      required: [true, 'Quantity is required'],
      min: [1, 'Quantity must be at least 1'],
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price cannot be negative'],
    },
    totalPrice: {
      type: Number,
      required: [true, 'Total price is required'],
      min: [0, 'Total price cannot be negative'],
    },
    productImage: {
      type: String,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
orderItemSchema.index({ orderId: 1 });
orderItemSchema.index({ productId: 1 });

// Virtual for product
orderItemSchema.virtual('product', {
  ref: 'Product',
  localField: 'productId',
  foreignField: '_id',
  justOne: true,
});

// Virtual for variant
orderItemSchema.virtual('variant', {
  ref: 'ProductVariant',
  localField: 'variantId',
  foreignField: '_id',
  justOne: true,
});

// Calculate total price before save
orderItemSchema.pre('save', function (next) {
  this.totalPrice = this.price * this.quantity;
  next();
});

const OrderItem = mongoose.model('OrderItem', orderItemSchema);

export default OrderItem;
