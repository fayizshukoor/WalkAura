import { calculateCouponDiscount } from "../utils/couponDiscount.util.js";

export const validateAndApplyCoupon = async ({
    userId,
    couponCode,
    cartTotal
  }) => {
    const coupon = await Coupon.findOne({ code: couponCode });
  
    if (!coupon) throw new Error("Invalid coupon");
  
    if (!coupon.isActive) throw new Error("Coupon inactive");
  
    if (new Date() > coupon.validUntil)
      throw new Error("Coupon expired");
  
    if (cartTotal < coupon.minCartValue)
      throw new Error("Minimum cart value not met");
  
    // per user check
    // usage limit check
  
    const discount = calculateCouponDiscount(
      cartTotal,
      coupon.discountPercentage,
      coupon.maxDiscountAmount
    );
  
    return { coupon, discount };
  };
  