import asyncHandler from "../../utils/asyncHandler.js";
import Cart from "../../models/Cart.model.js";
import Product from "../../models/Product.model.js";
import ProductVariant from "../../models/ProductVariant.model.js";
import Inventory from "../../models/Inventory.model.js";
import Category from "../../models/Category.model.js";
import { calculateFinalPrice } from "../../helpers/price.helper.js";
import Wishlist from "../../models/Wishlist.model.js";
import { HTTP_STATUS } from "../../constants/httpStatus.js";

const MAX_QUANTITY_PER_ITEM = 10;

// Add to cart
export const addToCart = asyncHandler(async (req, res) => {
  const { productId, variantId, inventoryId, quantity = 1 } = req.body;

  const userId = req?.user?.userId;

 if(!userId){
    return res.status(404).json({message : "Please Login first"});
 }

  // Validate quantity
  if (quantity < 1 || quantity > MAX_QUANTITY_PER_ITEM) {
    return res.status(400).json({ message: `Quantity must be between 1 and ${MAX_QUANTITY_PER_ITEM}`});
  }

  // Check product, variant, inventory with all validations
  const [product, variant, inventory] = await Promise.all([
    Product.findById(productId).populate("category"),
    ProductVariant.findById(variantId),
    Inventory.findById(inventoryId),
  ]);

  // Product validations
  if (!product) {
    return res.status(HTTP_STATUS.NOT_FOUND).json({ message: "Product not found"});
  }

  if (!product.isListed) {
    return res.status(400).json({ message: "This product is currently unavailable"});
  }

  // Category validations
  if (!product.category || !product.category.isListed || product.category.isDeleted) {
    return res.status(400).json({ message: "This product category is currently unavailable" });
  }

  // Variant validations
  if (!variant || !variant.isActive) {
    return res.status(400).json({ message: "Selected color variant is not available" });
  }

  // Inventory validations
  if (!inventory || !inventory.isActive) {
    return res.status(400).json({ message: "Selected size is not available"});
  }

  if (inventory.stock < quantity) {
    return res.status(400).json({ message: `Only ${inventory.stock} items available in stock`});
  }

  // Calculate final price
  const finalPrice = calculateFinalPrice({
    price: product.price,
    productOffer: product.offerPercent,
    productOfferExpiry: product.offerExpiry,
    categoryOffer: product.category.offerPercent,
    categoryOfferExpiry: product.category.offerExpiry,
  });

 
  const appliedOfferPercent =  Math.round(((product.price - finalPrice) / product.price) * 100)

  // Find or create cart
  let cart = await Cart.findOne({ user: userId });

  if (!cart) {
    cart = new Cart({
      user: userId,
      items: [],
      totalItems: 0,
      totalAmount: 0,
    });
  }

  // Check if item already exists
  const existingItemIndex = cart.items.findIndex(
    (item) => item.inventory.toString() === inventoryId
  );

  if (existingItemIndex > -1) {
    const newQuantity = cart.items[existingItemIndex].quantity + quantity;

    if (newQuantity > MAX_QUANTITY_PER_ITEM) {
      return res.status(400).json({ message: `Cannot add more than ${MAX_QUANTITY_PER_ITEM} items of the same product`});
    }

    if (newQuantity > inventory.stock) {
      return res.status(400).json({ message: `Only ${inventory.stock} items available in stock`});
    }

    cart.items[existingItemIndex].quantity = newQuantity;
    cart.items[existingItemIndex].priceAtAdd = finalPrice;
    cart.items[existingItemIndex].offerPercentAtAdd = appliedOfferPercent;
  } else {
    cart.items.push({
      product: productId,
      variant: variantId,
      inventory: inventoryId,
      quantity: quantity,
      priceAtAdd: finalPrice,
      offerPercentAtAdd: appliedOfferPercent,
    });
  }

  // Update totals
  cart.totalItems = cart.items.reduce((sum, item) => sum + item.quantity, 0);
  cart.totalAmount = cart.items.reduce(
    (sum, item) => sum + item.priceAtAdd * item.quantity,
    0
  );

  await cart.save();

  // Remove from wishlist 
  await Wishlist.findOneAndUpdate(
    { user: userId },
    { $pull: { items: { product: productId, variant: variantId } } }
  ).catch(() => {});

  // Populate and return
  const populatedCart = await Cart.findById(cart._id)
    .populate({
      path: "items.product",
      select: "name slug price offerPercent offerExpiry category gender",
      populate: {
        path: "category",
        select: "name offerPercent offerExpiry isListed isDeleted",
      },
    })
    .populate({
      path: "items.variant",
      select: "color images",
    })
    .populate({
      path: "items.inventory",
      select: "size stock sku",
    });


  res.status(200).json({ message: "Item added to cart successfully" });
});

export const getCart = asyncHandler(async (req,res)=>{

    const userId = req?.user?.userId;

    if(!userId){
        return res.redirect("/login");
    }

    const cart = await Cart.findOne({user : userId})
    .populate({
        path:"items.product",
        select: "name slug price offerPercent offerExpiry category gender isListed",
        populate:{
            path:"category",
            select: "name offerPercent offerExpiry isListed isDeleted"
        }
    })
    .populate({
        path: "items.variant",
        select: "color images isActive"
    })
    .populate({
        path: "items.inventory",
        select: "size stock sku isActive"
    });

    if(!cart){
        return res.render("user/cart",{
            cart: {
                items: [],
                totalItems: 0,
                totalAmount: 0,
              }
        })
    }
    //Filter invalid items

    const validItems = [];
    let hasChanges = false;

    for(const item of cart.items){
        // Checking product/variant/inventory active
        if(!item.product || !item.variant || !item.inventory || !item.product.isListed || !item.variant.isActive || !item.inventory.isActive){
            hasChanges = true;
            continue; // skip items
        }

        // Checking category active 
        if (!item.product.category || !item.product.category.isListed || item.product.category.isDeleted ) {
            hasChanges = true;
            continue; // Skip items
          }

          if (item.inventory.stock === 0) {
            item.isOutOfStock = true;
          } else if (item.quantity > item.inventory.stock) {
            // Adjust quantity if exceeds stock
            item.quantity = item.inventory.stock;
            hasChanges = true;
          }
    
          const currentPrice = calculateFinalPrice({
            price: item.product.price,
            productOffer: item.product.offerPercent,
            productOfferExpiry: item.product.offerExpiry,
            categoryOffer: item.product.category.offerPercent,
            categoryOfferExpiry: item.product.category.offerExpiry,
          });

          item.priceChanged = currentPrice !== item.priceAtAdd;
          item.priceAtAdd = currentPrice;
    
          validItems.push(item);
        }
    
        // Update cart if changes
        if (hasChanges) {
          cart.items = validItems;
          cart.totalItems = cart.items.reduce((sum, item) => sum + item.quantity, 0);
          cart.totalAmount = cart.items.reduce(
            (sum, item) => sum + item.priceAtAdd * item.quantity,
            0
          );
          await cart.save();
        }

        return res.render("user/cart",{cart});
})


// Update cart item 
export const updateCartItemQuantity = asyncHandler(async (req, res) => {
   
    const { inventoryId, action } = req.body; // 'increment' or 'decrement'
    const userId = req.user.userId;

    const cart = await Cart.findOne({ user: userId });

    if (!cart) {
      return res.status(404).json({
        message: "Cart not found"
      });
    }

    const itemIndex = cart.items.findIndex(
      (item) => item.inventory.toString() === inventoryId
    );


    if (itemIndex === -1) {
      return res.status(404).json({
        message: "Item not found in cart"
      });
    }

    // Get product with category for validation
    const product = await Product.findById(
      cart.items[itemIndex].product
    ).populate("category");

    if (!product || !product.isListed) {
      return res.status(400).json({
        message: "Product is no longer available",
      });
    }

    // Check category validity
    if (
      !product.category ||
      !product.category.isListed ||
      product.category.isDeleted
    ) {
      return res.status(400).json({
        message: "Product category is no longer available",
      });
    }

    // Get inventory for stock check
    const inventory = await Inventory.findById(inventoryId);
    if (!inventory || !inventory.isActive) {
      return res.status(400).json({
        message: "Product is no longer available",
      });
    }

    const currentQuantity = cart.items[itemIndex].quantity;
    let newQuantity = currentQuantity;

    if (action === "increment") {
      newQuantity = currentQuantity + 1;

      // Check max quantity limit
      if (newQuantity > MAX_QUANTITY_PER_ITEM) {
        return res.status(400).json({
          message: `Maximum ${MAX_QUANTITY_PER_ITEM} items allowed`,
        });
      }

      // Check stock
      if (newQuantity > inventory.stock) {
        return res.status(400).json({
          message: `Only ${inventory.stock} items available in stock`,
        });
      }

      cart.items[itemIndex].quantity = newQuantity;
    } else if (action === "decrement") {
      newQuantity = currentQuantity - 1;

      if (newQuantity < 1) {
        return res.status(400).json({
          message: "Quantity cannot be less than 1",
        });
      }

      cart.items[itemIndex].quantity = newQuantity;
    } else {
      return res.status(400).json({
        message: "Invalid action. Use 'increment' or 'decrement'",
      });
    }

    // Update cart totals
    cart.totalItems = cart.items.reduce((sum, item) => sum + item.quantity, 0);
    cart.totalAmount = cart.items.reduce(
      (sum, item) => sum + item.priceAtAdd * item.quantity,
      0
    );

    await cart.save();     

    res.status(200).json({success: true});
  });


// Remove Item from cart
export const removeCartItem = asyncHandler(async (req, res) => {

        const { inventoryId } = req.params;
        const userId = req.user.userId;

    
        const cart = await Cart.findOne({ user: userId });
    
        if (!cart) {
          return res.status(404).json({
            message: "Cart not found",
          });
        }
    
        const itemIndex = cart.items.findIndex(
          (item) => item.inventory.toString() === inventoryId
        );
    
        if (itemIndex === -1) {
          return res.status(404).json({
            message: "Item not found in cart",
          });
        }
    
        // Remove item
        cart.items.splice(itemIndex, 1);
    
        // Update cart totals
        cart.totalItems = cart.items.reduce((sum, item) => sum + item.quantity, 0);
        cart.totalAmount = cart.items.reduce(
          (sum, item) => sum + item.priceAtAdd * item.quantity,
          0
        );
    
        await cart.save();
    
        res.status(200).json({
          message: "Item removed from cart"
        });  
      })
      
      
export const clearCart = asyncHandler(async (req, res) => {
    const userId = req.user.userId;
    
    const cart = await Cart.findOne({ user: userId });
    
    if (!cart) {
      return res.status(404).json({
        message: "Cart not found"
      });
    }
    
    cart.items = [];
    cart.totalItems = 0;
    cart.totalAmount = 0;
    
    await cart.save();
    
    res.status(200).json({
      message: "Cart cleared successfully"
    });
  })