import Coupon from "../models/Coupon.model.js";
import AppError from "../utils/appError.js";

export const createCouponService = async (data) => {
  const {
    name,
    code,
    discountPercentage,
    minCartValue = 0,
    maxDiscountAmount,
    usageLimit,
    perUserLimit = 1,
    expiryDate,
  } = data;

  //  Basic required validations
  if (!name || !code || !discountPercentage || !expiryDate) {
    throw new AppError("Name, Code, discount and expiry Date are required",400);
  }

  //  Validate percentage range (extra safety)
  if (discountPercentage < 1 || discountPercentage > 90) {
    throw new AppError("Discount percentage must be between 1 and 90",400);
  }

  if(usageLimit && usageLimit < 0){
    throw new AppError("Usage Limit should be greater than Zero",400);
  }

  //  Validate expiry date
  const now = new Date();

  if (new Date(expiryDate) <= now) {
    throw new AppError("Expiry Date must be a future date",400);
  }

  //  Normalize coupon code
  const normalizedCode = code.trim().toUpperCase();

  //  Check duplicate coupon
  const existingCoupon = await Coupon.findOne({ code: normalizedCode });

  if (existingCoupon) {
    throw new AppError("Coupon code already exists",400);
  }

  //  Create coupon
  const coupon = await Coupon.create({
    name: name,
    code: normalizedCode,
    discountPercentage,
    minCartValue,
    maxDiscountAmount,
    usageLimit,
    perUserLimit,
    expiryDate,
  });

  return coupon;
};



export const getCouponsService = async ({
  page = 1,
  limit = 10,
  search = "",
}) => {
  const pageNumber = Math.max(Number(page), 1);
  const pageSize = Math.max(Number(limit), 1);
  const skip = (pageNumber - 1) * pageSize;

  const filter = {};

  if (search) {
    filter.code = { $regex: search.trim(), $options: "i" };
  }

  const [coupons, totalCoupons] = await Promise.all([
    Coupon.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageSize)
      .lean(),
    Coupon.countDocuments(filter),
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
