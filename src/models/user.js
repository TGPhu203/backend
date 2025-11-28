import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      validate: {
        validator: (v) =>
          /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(v),
        message: 'Please provide a valid email',
      },
    },

    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false,
    },

    firstName: {
      type: String,
      required: true,
      trim: true,
    },

    lastName: {
      type: String,
      required: true,
      trim: true,
    },

    phone: {
      type: String,
      trim: true,
    },

    avatar: String,

    role: {
      type: String,
      enum: ['customer', 'admin', 'manager'],
      default: 'customer',
    },

    isEmailVerified: {
      type: Boolean,
      default: false,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    verificationToken: {
      type: String,
      select: false,
    },
    totalSpent: {
      type: Number,
      default: 0, // tổng tiền đã chi (đã hoàn tất)
    },
    loyaltyPoints: {
      type: Number,
      default: 0, // điểm tích lũy
    },
    loyaltyTier: {
      type: String,
      enum: ['none', 'silver', 'gold', 'diamond'],
      default: 'none',
    },
    resetPasswordToken: {
      type: String,
      select: false,
    },
    isBlocked: {
      type: Boolean,
      default: false,
    },
    resetPasswordExpires: {
      type: Date,
      select: false,
    },

    stripeCustomerId: String,
  },
  {
    timestamps: true,

    toJSON: {
      virtuals: true,
      transform(doc, ret) {
        delete ret.password;
        delete ret.verificationToken;
        delete ret.resetPasswordToken;
        delete ret.resetPasswordExpires;
        delete ret.__v;
        return ret;
      },
    },

    toObject: { virtuals: true },
  }
);
userSchema.methods.updateLoyaltyTier = function () {
  const spent = this.totalSpent || 0;

  if (spent >= 50_000_000) {
    this.loyaltyTier = 'diamond';
  } else if (spent >= 20_000_000) {
    this.loyaltyTier = 'gold';
  } else if (spent >= 5_000_000) {
    this.loyaltyTier = 'silver';
  } else {
    this.loyaltyTier = 'none';
  }
};
/* -------------------- INDEXES -------------------- */
// Unique email index
userSchema.index({ email: 1 }, { unique: true });

// Query user list (admin)
userSchema.index({ role: 1, isActive: 1 });

// Improve login / lookup by phone
userSchema.index({ phone: 1 }, { sparse: true });

// Sort newest users
userSchema.index({ createdAt: -1 });

// Text search for name + email
userSchema.index({
  email: 'text',
  firstName: 'text',
  lastName: 'text',
});

/* -------------------- VIRTUALS -------------------- */
userSchema.virtual('fullName').get(function () {
  return `${this.firstName} ${this.lastName}`;
});

userSchema.virtual('addresses', {
  ref: 'Address',
  localField: '_id',
  foreignField: 'userId',
});

userSchema.virtual('reviews', {
  ref: 'Review',
  localField: '_id',
  foreignField: 'userId',
});

userSchema.virtual('orders', {
  ref: 'Order',
  localField: '_id',
  foreignField: 'userId',
});

userSchema.virtual('carts', {
  ref: 'Cart',
  localField: '_id',
  foreignField: 'userId',
});

/* -------------------- PASSWORD HASH -------------------- */
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();

  try {
    const salt = await bcrypt.genSalt(12); // stronger security
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

/* -------------------- PASSWORD COMPARE -------------------- */
userSchema.methods.comparePassword = function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model('User', userSchema);
export default User;
