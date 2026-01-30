import { HTTP_STATUS } from "../../constants/httpStatus.js";
import { calculateFinalPrice } from "../../helpers/price.helper.js";
import Address from "../../models/Address.model.js";
import Cart from "../../models/Cart.model.js";
import asyncHandler from "../../utils/asyncHandler.js";


const TAX_PERCENTAGE = 18;

export const getCheckoutPage = asyncHandler(async (req,res)=>{

    const userId = req.user.userId;

    // Get Cart with full details

    const cart = await Cart.findOne({user: userId})
    .populate({
        path:"items.product",
        select: "name price offerPercent offerExpiry category isListed",
        populate:{
            path: "category",
            select: "name offerPercent offerExpiry isListed isDeleted"
        }
    })
    .populate({
        path: "items.variant",
        select: "color images isActive"
    })
    .populate({
        path: "items.inventory",
        select: "size stock isActive"
    });

    // Check cart is empty

    if(!cart || cart.items.length === 0){
        return res.status(HTTP_STATUS.NOT_FOUND).json({message:"Cart is Empty"});
    }

    // Validate all cart items
    const validatedItems = [];
    const invalidItems = [];
    const hasStockIssues = false;

    for(const item of cart.items){

        // Check product validity
        if(!item.product || !item.product.isListed || !item.product.category || !item.product.category.isListed || item.product.category.isDeleted){
            invalidItems.push({
                name: item.product.name || "Unknown Product",
                reason: "Product no longer available"
            });

            continue;
        }

        // Check variant validity
        if(!item.variant || !item.variant.isActive){
            invalidItems.push({
                name: item.product.name ,
                reason: "Selected color is no longer available"
            });

            continue;
        }

        if(!item.inventory || !item.inventory.isActive){
            invalidItems.push({
                name: item.product.name ,
                reason: "Selected size is no longer available"
            });
            continue;
        }

        if(item.inventory.stock === 0){
            invalidItems.push({
                name: item.product.name,
                reason: "Out of stock",
              });
              hasStockIssues = true;
              continue;
        }

        if (item.quantity > item.inventory.stock) {
            invalidItems.push({
              name: item.product.name,
              reason: `Only ${item.inventory.stock} items available`,
            });
            hasStockIssues = true;
            continue;
          }

          // Calculate current price
          const currentPrice = calculateFinalPrice({
            price: item.product.price,
            productOffer: item.product.offerPercent,
            productOfferExpiry: item.product.offerExpiry,
            categoryOffer: item.product.category.offerPercent,
            categoryOfferExpiry: item.product.category.offerExpiry,
          });
          
          validatedItems.push({
            product: item.product._id,
            productName: item.product.name,
            variant: item.variant._id,
            color: item.variant.color,
            image: item.variant.images[0]?.url || "",
            inventory: item.inventory._id,
            size: item.inventory.size,
            quantity: item.quantity,
            price: currentPrice,
            itemTotal: currentPrice * item.quantity,
          });    
    }


    if (invalidItems.length > 0) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          message: hasStockIssues
            ? "Some items are out of stock or have insufficient stock"
            : "Some items in your cart are no longer available",
          invalidItems,
        });
    }  

    // Get user addresses
    const addresses = await Address.find({
      userId: userId
    }).sort({ isDefault: -1, createdAt: -1 });


    const subtotal = validatedItems.reduce((sum, item) => sum + item.itemTotal, 0);
    const tax = Math.round((subtotal * TAX_PERCENTAGE) / 100);; 
    const shippingCharge = 50; 
    const discount = 0; 
    const totalAmount = subtotal + tax + shippingCharge - discount;

    return res.render("user/checkout",{
        checkout: {
          items: validatedItems,
          addresses,
          pricing: {
            subtotal,
            tax,
            shippingCharge,
            discount,
            totalAmount,
          },
        },
      });
})