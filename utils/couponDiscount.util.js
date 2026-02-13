export const calculateCouponDiscount = (
    cartTotal,
    discountPercentage,
    maxDiscountAmount
  ) => {
    let discount = (cartTotal * discountPercentage) / 100;
  
    if (maxDiscountAmount) {
      discount = Math.min(discount, maxDiscountAmount);
    }
  
    return Math.min(discount, cartTotal);
  };
  