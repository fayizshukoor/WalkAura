import Coupon from "../models/Coupon.model.js";
import Order from "../models/Order.model.js";
import AppError from "../utils/appError.js";
import { getReconciledCart } from "./cart.service.js";


export const getCouponsService = async ({
  page = 1,
  limit = 5,
  search = "",
}) => {
  const pageNumber = Math.max(Number(page), 1);
  const pageSize = Math.max(Number(limit), 1);
  const skip = (pageNumber - 1) * pageSize;

  const query = {isDeleted: false};

  if (search) {
    query.$or = [
        {code: { $regex: search.trim(), $options: "i" } },
        {name: { $regex: search.trim(), $options: "i" } }
      ]
  }

  const [coupons, totalCoupons] = await Promise.all([
    Coupon.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageSize)
      .lean(),
    Coupon.countDocuments(query),
  ]);

  const totalPages = Math.ceil(totalCoupons / pageSize);

  return {
    coupons,
    pagination: {
      totalCoupons,
      currentPage: pageNumber,
      totalPages,
      limit: pageSize,
    },
  };
};



export const createCouponService = async (data) => {
  const {
    name,
    code,
    expiryDate,
    discountPercentage,
    minCartValue = 0,
    maxDiscountAmount,
    usageLimit
  } = data;

  //  Basic required validations
  if (!name || !code || !expiryDate) {
    throw new AppError("Name, Code and expiry Date are required",400);
  }

  //  Validate percentage range (extra safety)
  const discount = Number(discountPercentage);

  if (isNaN(discount) || discount < 1 || discount > 90) {
    throw new AppError(
      "Discount percentage must be between 1 and 90",
      400
    );
  }

  let parsedUsageLimit;

  if (usageLimit !== undefined && usageLimit !== "") {
    parsedUsageLimit = Number(usageLimit);

    if (isNaN(parsedUsageLimit) || parsedUsageLimit <= 0) {
      throw new AppError(
        "Usage limit must be greater than 0",
        400
      );
    }
  }
  //  Validate expiry date
  const now = new Date();

  const parsedExpiry = new Date(expiryDate);

  if (isNaN(parsedExpiry.getTime())) {
     throw new AppError("Invalid expiry date format", 400);
  }
  
  if (parsedExpiry <= now) {
     throw new AppError("Expiry date must be a future date", 400);
  }

  const parsedMinCart = Number(minCartValue);

  if (isNaN(parsedMinCart) || parsedMinCart < 0) {
    throw new AppError(
      "Minimum cart value must be greater than 0",
      400
    );
  }

  let parsedMaxDiscount;

  if (maxDiscountAmount !== undefined && maxDiscountAmount !== "") {
    parsedMaxDiscount = Number(maxDiscountAmount);

    if (isNaN(parsedMaxDiscount) || parsedMaxDiscount < 0) {
      throw new AppError(
        "Max discount amount must be >= 0",
        400
      );
    }
  }

  if (
    parsedMaxDiscount !== undefined &&
    parsedMinCart > 0 &&
    parsedMaxDiscount > parsedMinCart
  ) {
    throw new AppError(
      "Max discount cannot exceed minimum cart value",
      400
    );
  }

  if (discount > 50 && parsedMaxDiscount === undefined) {
    throw new AppError(
      "Max discount amount is required for high discount coupons",
      400
    );
  }

  //  Normalize coupon code
  const normalizedCode = code.trim().toUpperCase();

  //  Check duplicate coupon
  const existingCoupon = await Coupon.findOne({ code: normalizedCode });

  if (existingCoupon && !existingCoupon.isDeleted) {
    throw new AppError("Coupon code already exists",400);
  }

  if (existingCoupon && existingCoupon.isDeleted) {
    existingCoupon.name = name;
    existingCoupon.discountPercentage = discountPercentage;
    existingCoupon.minCartValue = minCartValue;
    existingCoupon.maxDiscountAmount = maxDiscountAmount;
    existingCoupon.usageLimit = usageLimit;
    existingCoupon.expiryDate = parsedExpiry;
    existingCoupon.isDeleted = false;
    existingCoupon.isActive = true;

    await existingCoupon.save();

    return existingCoupon;
  }

  //  Create coupon
  const coupon = await Coupon.create({
    name,
    code: normalizedCode,
    discountPercentage: discount,
    minCartValue: parsedMinCart,
    maxDiscountAmount: parsedMaxDiscount,
    usageLimit: parsedUsageLimit,
    expiryDate: parsedExpiry,
  });

  return coupon;
};


export const editCouponService = async (couponId, data) => {
  const {
    name,
    discountPercentage,
    expiryDate,
    minCartValue,
    maxDiscountAmount,
    usageLimit
  } = data;

  const coupon = await Coupon.findById(couponId);

  if (!coupon) {
    throw new AppError("Coupon not found", 404);
  }

  if (coupon.isDeleted) {
    throw new AppError("Cannot edit deleted coupon", 400);
  }

  // Name
  if (name !== undefined) {
    if (!name.trim()) {
      throw new AppError("Coupon name cannot be empty", 400);
    }
    coupon.name = name.trim();
  }

  // Discount
  if (discountPercentage !== undefined) {
    const discount = Number(discountPercentage);
  
    if (isNaN(discount)) {
      throw new AppError("Invalid discount value", 400);
    }
  
    if (discount < 1 || discount > 90) {
      throw new AppError("Discount must be between 1 and 90", 400);
    }
  
    coupon.discountPercentage = discount;
  }

  // Usage Limit
  if (usageLimit !== undefined && usageLimit !== "") {
    const parsedUsageLimit = Number(usageLimit);
  
    if (isNaN(parsedUsageLimit) || parsedUsageLimit <= 0) {
      throw new AppError("Usage limit must be greater than 0", 400);
    }
  
    if (parsedUsageLimit < coupon.usedCount) {
      throw new AppError(
        "Usage limit cannot be less than already used count",
        400
      );
    }
  
    coupon.usageLimit = parsedUsageLimit;
  }

  // Expiry
  if (expiryDate !== undefined) {
    const parsedExpiry = new Date(expiryDate);

    if (isNaN(parsedExpiry.getTime())) {
      throw new AppError("Invalid expiry date", 400);
    }

    if (parsedExpiry <= new Date()) {
      throw new AppError("Expiry must be future date", 400);
    }

    coupon.expiryDate = parsedExpiry;
  }

  // Min Cart Value
  if (minCartValue !== undefined) {
    const parsedMinCart = Number(minCartValue);

    if (isNaN(parsedMinCart) || parsedMinCart < 0) {
      throw new AppError(
        "Minimum cart value must be greater than 0",
        400
      );
    }

    coupon.minCartValue = parsedMinCart;
  }

  // Max Discount
  if (maxDiscountAmount !== undefined && maxDiscountAmount !== "") {
    const parsedMaxDiscount = Number(maxDiscountAmount);

    if (isNaN(parsedMaxDiscount) || parsedMaxDiscount < 0) {
      throw new AppError(
        "Max discount amount must be greater than 0",
        400
      );
    }

    coupon.maxDiscountAmount = parsedMaxDiscount;
  }

  // Logical consistency check

  if (
    coupon.maxDiscountAmount !== undefined &&
    coupon.minCartValue > 0 &&
    coupon.maxDiscountAmount > coupon.minCartValue
  ) {
    throw new AppError(
      "Max discount cannot exceed minimum cart value",
      400
    );
  }

  // safeguard for high discount
  if (
    coupon.discountPercentage > 50 &&
    coupon.maxDiscountAmount === undefined
  ) {
    throw new AppError(
      "Max discount amount is required for high discount coupons",
      400
    );
  }

  await coupon.save();

  return coupon;
};


export const toggleCouponStatusService = async (couponId)=>{

  const coupon = await Coupon.findById(couponId);

  if(!coupon){
    throw new AppError("Coupon not found",404);
  }

  coupon.isActive = !coupon.isActive;
  await coupon.save();

  return coupon;
}


export const softDeleteCouponService = async (couponId) => {
  const coupon = await Coupon.findById(couponId);

  if (!coupon) {
    throw new AppError("Coupon not found", 404);
  }

  if (coupon.isDeleted) {
    throw new AppError("Coupon already deleted", 400);
  }

  coupon.isDeleted = true;
  coupon.isActive = false;

  await coupon.save();

  return coupon;
};



// User Side Services

export const getAvailableCouponsForCheckoutService = async ({
  userId,
  cartSubtotal
}) => {
  const now = new Date();

  // Fetch globally valid coupons
  const coupons = await Coupon.find({
    isActive: true,
    isDeleted: false,
    expiryDate: { $gt: now },
    $or: [
      { usageLimit: { $exists: false } }, // unlimited
      { $expr: { $lt: ["$usedCount", "$usageLimit"] } }
    ],
    minCartValue: { $lte: cartSubtotal }
  })
    .select(
      "code name discountPercentage minCartValue maxDiscountAmount usageLimit perUserLimit expiryDate"
    )
    .lean();

  if (!coupons.length) return [];

  // Get user's previous usage
  const userOrders = await Order.aggregate([
    {
      $match: {
        user: userId,
        "appliedCoupon.coupon": { $exists: true },
        orderStatus: { $ne: "CANCELLED" }
      }
    },
    {
      $group: {
        _id: "$appliedCoupon.coupon",
        count: { $sum: 1 }
      }
    }
  ]);

  const userUsageMap = {};
  userOrders.forEach(order => {
    userUsageMap[order._id.toString()] = order.count;
  });

  // Filter per-user limit
  const eligibleCoupons = coupons.filter(coupon => {
    const usageCount = userUsageMap[coupon._id?.toString()] || 0;

    if (coupon.perUserLimit !== undefined) {
      return usageCount < coupon.perUserLimit;
    }

    return true;
  });

  return eligibleCoupons;
};


export const applyCouponService = async ({
  userId,
  couponCode
}) => {


  // Reconcile Cart
  const result = await getReconciledCart(userId);


  if (!result || !result.cart || result.cart.items.length === 0) {
    throw new AppError("Cart is empty", 400);
  }

  const { cart } = result;

  const subtotal = cart.items.reduce(
    (sum, item) => sum + item.priceAtAdd * item.quantity,
    0
  );

  // Fetch Coupon
  const coupon = await Coupon.findOne({
    code: couponCode.trim().toUpperCase(),
    isActive: true,
    isDeleted: false
  });

  if (!coupon) {
    throw new AppError("Invalid or inactive coupon", 400);
  }

  // Expiry Validation
  if (coupon.expiryDate <= new Date()) {
    throw new AppError("Coupon has expired", 400);
  }

  //  Minimum Cart Validation
  if (subtotal < coupon.minCartValue) {
    throw new AppError(
      `Minimum cart value of ₹${coupon.minCartValue} required`,
      400
    );
  }

  // Global Usage Limit Check
  if (
    coupon.usageLimit !== undefined &&
    coupon.usedCount >= coupon.usageLimit
  ) {
    throw new AppError("Coupon usage limit exceeded", 400);
  }

  // Per User Limit Check
  const userUsageCount = await Order.countDocuments({
    user: userId,
    "appliedCoupon.coupon": coupon._id,
    orderStatus: { $ne: "CANCELLED" }
  });

  if (
    coupon.perUserLimit !== undefined &&
    userUsageCount >= coupon.perUserLimit
  ) {
    throw new AppError("You have already used this coupon", 400);
  }

  // Calculate Discount
  let discount =
    Math.floor((subtotal * coupon.discountPercentage) / 100);

  if (
    coupon.maxDiscountAmount !== undefined &&
    discount > coupon.maxDiscountAmount
  ) {
    discount = coupon.maxDiscountAmount;
  }

  if (discount > subtotal) {
    discount = subtotal;
  }

  //  Return Pricing
  return {
    coupon: {
      _id: coupon._id,
      code: coupon.code,
      discountPercentage: coupon.discountPercentage
    },
    pricing: {
      subtotal,
      discount,
      finalSubtotal: subtotal - discount
    }
  };
};