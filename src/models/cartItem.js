import mongoose from 'mongoose';

const cartItemSchema = new mongoose.Schema(
  {
    cartId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Cart',
      required: [true, 'Cart ID is required'],
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
      default: 0,
      min: [0, 'Total price cannot be negative'],
    },
    
    addedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
cartItemSchema.index({ cartId: 1, productId: 1, variantId: 1 }, { unique: true });

// Virtual for product
cartItemSchema.virtual('product', {
  ref: 'Product',
  localField: 'productId',
  foreignField: '_id',
  justOne: true,
});

// Virtual for variant
cartItemSchema.virtual('variant', {
  ref: 'ProductVariant',
  localField: 'variantId',
  foreignField: '_id',
  justOne: true,
});

// Calculate total price before save
cartItemSchema.pre('save', function (next) {
  this.totalPrice = this.price * this.quantity;
  next();
});

const CartItem = mongoose.model('CartItem', cartItemSchema);

export default CartItem;
