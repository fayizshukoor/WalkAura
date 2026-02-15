import Coupon from "../models/Coupon.model.js";
import AppError from "../utils/appError.js";


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
  if (!name || !code || !discountPercentage || !expiryDate) {
    throw new AppError("Name, Code, discount and expiry Date are required",400);
  }

  //  Validate percentage range (extra safety)
  if (discountPercentage < 1 || discountPercentage > 90) {
    throw new AppError("Discount percentage must be between 1 and 90",400);
  }

  if(usageLimit!== undefined && usageLimit <= 0){
    throw new AppError("Usage Limit should be greater than Zero",400);
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

  if (maxDiscountAmount !== undefined) {
    parsedMaxDiscount = Number(maxDiscountAmount);

    if (isNaN(parsedMaxDiscount) || parsedMaxDiscount < 0) {
      throw new AppError(
        "Max discount amount must be greater than 0",
        400
      );
    }
  }

  if (
    parsedMaxDiscount !== undefined &&
    parsedMaxDiscount > parsedMinCart &&
    parsedMinCart > 0
  ) {
    throw new AppError(
      "Max discount cannot exceed minimum cart value",
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
    discountPercentage,
    minCartValue,
    maxDiscountAmount,
    usageLimit,
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
  if (usageLimit !== undefined) {
    const limit = Number(usageLimit);
  
    if (isNaN(limit) || limit <= 0) {
      throw new AppError("Usage limit must be greater than 0", 400);
    }
  
    if (limit < coupon.usedCount) {
      throw new AppError(
        "Usage limit cannot be less than already used count",
        400
      );
    }
  
    coupon.usageLimit = limit;
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

    if (isNaN(parsedMinCart) || parsedMinCart <= 0) {
      throw new AppError(
        "Minimum cart value must be greater than 0",
        400
      );
    }

    coupon.minCartValue = parsedMinCart;
  }

  // Max Discount
  if (maxDiscountAmount !== undefined) {
    const parsedMaxDiscount = Number(maxDiscountAmount);

    if (isNaN(parsedMaxDiscount) || parsedMaxDiscount <= 0) {
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
