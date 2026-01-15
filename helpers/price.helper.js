export const calculateFinalPrice = (product,category)=>{
    const now = new Date();

    const productOffer = product.offerPercent && product.offerExpiry && product.offerExpiry > now ? product.offerPercent : 0;

    const categoryOffer = category.offerPercent && category.offerExpiry && category.offerExpiry > now ? category.offerPercent : 0;

    const appliedOffer = Math.max(productOffer,categoryOffer);

    if(appliedOffer > 0){
        return Math.round(product.price - (product.price * appliedOffer)/100 );
    }
        return product.price;
}