export const calculateItemRefund = (order, item) => {
    const { subtotal, discount, taxPercentage } = order.pricing;
  
    const itemBase = item.itemTotal;
  
    // Proportion of item in subtotal
    const ratio = itemBase / subtotal;
  
    // Discount share for this item
    const itemDiscountShare = discount * ratio;
  
    // Discounted base
    const itemDiscountedBase = itemBase - itemDiscountShare;
  
    // Tax on discounted base
    const itemTax = Math.round(
      (itemDiscountedBase * taxPercentage) / 100
    );
  
    const refundAmount = Math.round(
      itemDiscountedBase + itemTax
    );
  
    return refundAmount;
  };
  