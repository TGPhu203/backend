import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      // unique: true, // BỎ để tránh trùng với userSchema.index({ email: 1 }, { unique: true })
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
      enum: ['customer', 'admin', 'manager', 'support'],
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

    verificationTokenExpires: {
      type: Date,
      select: false,
    },

    totalSpent: {
      type: Number,
      default: 0,
    },
    loyaltyPoints: {
      type: Number,
      default: 0,
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
    resetPasswordExpires: {
      type: Date,
      select: false,
    },

    isBlocked: {
      type: Boolean,
      default: false,
    },

    baseSalary: {
      type: Number,
      default: 0,
    },
    salaryType: {
      type: String,
      enum: ['monthly', 'hourly'],
      default: 'monthly',
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
        delete ret.verificationTokenExpires;
        delete ret.resetPasswordToken;
        delete ret.resetPasswordExpires;
        delete ret.__v;
        return ret;
      },
    },

    toObject: { virtuals: true },
  }
);

// ================= METHODS =================
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

// ================= INDEXES =================
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ role: 1, isActive: 1 });
userSchema.index({ phone: 1 }, { sparse: true });
userSchema.index({ createdAt: -1 });
userSchema.index({
  email: 'text',
  firstName: 'text',
  lastName: 'text',
});
userSchema.index({ verificationToken: 1 }); // thêm cho verify email

// ================= VIRTUALS =================
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

// ================= PASSWORD HOOK =================
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();

  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

userSchema.methods.comparePassword = function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model('User', userSchema);
export default User;
