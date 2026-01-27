export const calculateFinalPrice = ({
    price,
    productOffer = 0,
    productOfferExpiry,
    categoryOffer = 0,
    categoryOfferExpiry
  }) => {
    const now = new Date();
  
    const validProductOffer =
      productOfferExpiry && productOfferExpiry > now
        ? productOffer
        : 0;
  
    const validCategoryOffer =
      categoryOfferExpiry && categoryOfferExpiry > now
        ? categoryOffer
        : 0;
        console.log(validCategoryOffer);
  
    const appliedOffer = Math.max(validProductOffer, validCategoryOffer);
  
    if (appliedOffer > 0) {
      return Math.round(price - (price * appliedOffer) / 100);
    }
  
    return price;
  };
  