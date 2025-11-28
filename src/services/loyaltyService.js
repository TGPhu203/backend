// services/loyaltyService.js
import { User, LoyaltyConfig } from "../models/index.js";

// hard-code mặc định (fallback)
const DEFAULT_CONFIG = {
  silver: { minTotalSpent: 10_000_000, discountPercent: 2 },
  gold: { minTotalSpent: 50_000_000, discountPercent: 5 },
  diamond: { minTotalSpent: 100_000_000, discountPercent: 10 },
};

export const getDiscountPercentByTier = async (tier) => {
  if (!tier || tier === "none") return 0;

  // 1) thử lấy trong DB
  const cfg = await LoyaltyConfig.findOne({ tier, isActive: true }).lean();
  if (cfg && typeof cfg.discountPercent === "number") {
    return cfg.discountPercent;
  }

  // 2) nếu không có config → dùng mặc định
  return DEFAULT_CONFIG[tier]?.discountPercent || 0;
};

// tính tier dựa trên tổng chi tiêu, ưu tiên config, nếu không có thì fallback
export const computeTierByTotalSpent = async (totalSpent) => {
  let tier = "none";

  // 1) đọc config từ DB
  const configs = await LoyaltyConfig.find({ isActive: true }).lean();

  if (configs.length > 0) {
    // dùng cấu hình
    configs.sort((a, b) => a.minTotalSpent - b.minTotalSpent);
    for (const c of configs) {
      if (totalSpent >= (c.minTotalSpent || 0)) {
        tier = c.tier;
      }
    }
    return tier;
  }

  // 2) nếu không có config trong DB → dùng hard-code
  const entries = Object.entries(DEFAULT_CONFIG).sort(
    (a, b) => a[1].minTotalSpent - b[1].minTotalSpent
  );

  for (const [t, cfg] of entries) {
    if (totalSpent >= cfg.minTotalSpent) {
      tier = t;
    }
  }

  return tier;
};

export const applyOrderToUserLoyalty = async (userId, orderAmount) => {
  const amount = Number(orderAmount || 0);
  if (!userId || amount <= 0) return;

  const user = await User.findById(userId);
  if (!user) return;

  user.totalSpent = (user.totalSpent || 0) + amount;
  user.loyaltyPoints =
    (user.loyaltyPoints || 0) + Math.floor(amount / 1000);

  user.loyaltyTier = await computeTierByTotalSpent(user.totalSpent);

  await user.save();
  return user;
};
