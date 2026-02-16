export const calculateShipping = (subtotal) => {
    const FREE_SHIPPING_THRESHOLD = 10000;
    const FLAT_SHIPPING_RATE = 50;
  
    if (subtotal >= FREE_SHIPPING_THRESHOLD) {
      return 0;
    }
  
    return FLAT_SHIPPING_RATE;
  };