import asyncHandler from "../../utils/asyncHandler.js";
import Cart from "../../models/Cart.model.js";
import Product from "../../models/Product.model.js";
import ProductVariant from "../../models/ProductVariant.model.js";
import Inventory from "../../models/Inventory.model.js";
import { calculateFinalPrice } from "../../helpers/price.helper.js";
import Wishlist from "../../models/Wishlist.model.js";
import { HTTP_STATUS } from "../../constants/httpStatus.js";
import { getReconciledCart } from "../../services/cart.services.js";

const MAX_QUANTITY_PER_ITEM = 3;
const MAX_CART_QUANTITY = 10;

// Add to cart
export const addToCart = asyncHandler(async (req, res) => {
  const { productId, variantId, inventoryId, quantity = 1 } = req.body;

  const userId = req?.user?.userId;

  if (!userId) {
    return res.status(404).json({ message: "Please Login first" });
  }

  // Validate quantity
  if (quantity < 1 || quantity > MAX_QUANTITY_PER_ITEM) {
    return res
      .status(400)
      .json({
        message: `Quantity must be between 1 and ${MAX_QUANTITY_PER_ITEM}`,
      });
  }

  // Check product, variant, inventory with all validations
  const [product, variant, inventory] = await Promise.all([
    Product.findById(productId).populate("category"),
    ProductVariant.findById(variantId),
    Inventory.findById(inventoryId),
  ]);

  // Product validations
  if (!product) {
    return res
      .status(HTTP_STATUS.NOT_FOUND)
      .json({ message: "Product not found" });
  }

  if (!product.isListed) {
    return res
      .status(400)
      .json({ message: "This product is currently unavailable" });
  }

  // Category validations
  if (
    !product.category ||
    !product.category.isListed ||
    product.category.isDeleted
  ) {
    return res
      .status(400)
      .json({ message: "This product category is currently unavailable" });
  }

  // Variant validations
  if (!variant || !variant.isActive) {
    return res
      .status(400)
      .json({ message: "Selected color variant is not available" });
  }

  // Inventory validations
  if (!inventory || !inventory.isActive) {
    return res.status(400).json({ message: "Selected size is not available" });
  }

  if (inventory.stock < quantity) {
    return res
      .status(400)
      .json({ message: `Only ${inventory.stock} items available in stock` });
  }

  // Calculate final price
  const finalPrice = calculateFinalPrice({
    price: product.price,
    productOffer: product.offerPercent,
    productOfferExpiry: product.offerExpiry,
    categoryOffer: product.category.offerPercent,
    categoryOfferExpiry: product.category.offerExpiry,
  });

  const appliedOfferPercent = Math.round(
    ((product.price - finalPrice) / product.price) * 100,
  );

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
    (item) => item.inventory.toString() === inventoryId,
  );

  if (existingItemIndex > -1) {
    const newQuantity = cart.items[existingItemIndex].quantity + quantity;

    if (newQuantity > MAX_QUANTITY_PER_ITEM) {
      return res
        .status(400)
        .json({
          message: `Maximum ${MAX_QUANTITY_PER_ITEM} items of the same product.Already ${cart.items[existingItemIndex].quantity} added`,
        });
    }

    if (newQuantity > inventory.stock) {
      return res
        .status(400)
        .json({ message: `Only ${inventory.stock} items available in stock` });
    }

    const currentTotal = cart.items.reduce((sum, item) => sum + item.quantity, 0);
    const newTotal = currentTotal - cart.items[existingItemIndex].quantity + newQuantity;

    if (newTotal > MAX_CART_QUANTITY) {
      return res.status(400).json({
        message: `Cart limit exceeded. Maximum ${MAX_CART_QUANTITY} items allowed in cart`,
      });
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
    0,
  );

  await cart.save();

  res.locals.cartCount = cart.totalItems;

  // Remove from wishlist
  await Wishlist.findOneAndUpdate(
    { user: userId },
    { $pull: { items: { product: productId, variant: variantId } } },
  ).catch(() => {});


  return res.status(200).json({ message: "Item added to cart successfully", newCount: cart.totalItems});
});




export const getCart = asyncHandler(async (req, res) => {
  const userId = req.user?.userId;
  if (!userId){
    return res.redirect("/login");
  } 

  const result = await getReconciledCart(userId);

  if (!result || !result.cart) {
    res.locals.cartCount = 0;
    return res.render("user/cart", {
      cart: { items: [], totalItems: 0, totalAmount: 0 },
      changes: [],
    });
  }

  const { cart, hasChanges, changes } = result;

  // Navbar count 
  res.locals.cartCount = cart.totalItems || 0;

  const cartChanges = req.session.cartChanges || (hasChanges ? changes : []);

  delete req.session.cartChanges;

  return res.render("user/cart", {
    cart,
    changes: cartChanges,
  });
});



// Update cart quantity
export const updateCartItemQuantity = asyncHandler(async (req, res) => {
  const { inventoryId, action } = req.body; // 'increment' or 'decrement'
  const userId = req?.user?.userId;

  const cart = await Cart.findOne({ user: userId });

  if (!cart) {
    return res.status(404).json({
      message: "Cart not found",
    });
  }

  const itemIndex = cart.items.findIndex(
    (item) => item.inventory.toString() === inventoryId,
  );

  if (itemIndex === -1) {
    return res.status(404).json({
      message: "Item not found in cart",
    });
  }

  // Get product with category for validation
  const product = await Product.findById(
    cart.items[itemIndex].product,
  ).populate("category");

  if (!product || !product.isListed) {
    return res.status(409).json({
      message: "Product is no longer available",
      code: "ITEM_UNAVAILABLE"
    });
  }

  // Check category validity
  if (
    !product.category ||
    !product.category.isListed ||
    product.category.isDeleted
  ) {

    return res.status(409).json({
      message: "Item is no longer available.Please review your cart",
      code: "ITEM_UNAVAILABLE"
    });
  }


  // Get inventory for stock check
  const inventory = await Inventory.findById(inventoryId);
  if (!inventory || !inventory.isActive) {
    return res.status(409).json({
      message: "Product is no longer available",
      code: "ITEM_UNAVAILABLE"
    });
  }

  if(inventory.stock === 0){
    return res.status(409).json({
      message: `Size UK ${inventory.size} is out of stock`,
      code: "OUT_OF_STOCK"
    })
  }

  const currentQuantity = cart.items[itemIndex].quantity;
  let newQuantity;

  if (action === "increment") {
    newQuantity = currentQuantity + 1;

    // Check max quantity limit
    if (newQuantity > MAX_QUANTITY_PER_ITEM) {
      return res.status(400).json({
        message: `Maximum ${MAX_QUANTITY_PER_ITEM} items allowed.Already added ${currentQuantity}`,
      });
    }

    // Check stock
    if (newQuantity > inventory.stock) {
      return res.status(400).json({
        message: `Only ${inventory.stock} items available in stock`,
      });
    }

    const currentTotal = cart.items.reduce((sum, item) => sum + item.quantity, 0);
    const newTotal = currentTotal - cart.items[itemIndex].quantity + newQuantity;

    if (newTotal > MAX_CART_QUANTITY) {
      return res.status(400).json({
        message: `Cart limit exceeded. Maximum ${MAX_CART_QUANTITY} items allowed in cart`,
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
  cart.totalAmount = cart.items.reduce((sum, item) => sum + item.priceAtAdd * item.quantity, 0);

  await cart.save();

  const updatedItem = cart.items[itemIndex];

  return res.status(200).json({ 
    success: true, 
    newCount: cart.totalItems,
    cart: {
      totalItems: cart.totalItems,
      totalAmount: cart.totalAmount
    },
    updatedItem:{
      inventoryId: updatedItem.inventory,
      quantity: updatedItem.quantity,
      priceAtAdd: updatedItem.priceAtAdd,
      itemTotal: updatedItem.priceAtAdd * updatedItem.quantity
    }
  });
});

// Remove Item from cart
export const removeCartItem = asyncHandler(async (req, res) => {
  const { inventoryId } = req.params;
  const userId = req?.user?.userId;

  const cart = await Cart.findOne({ user: userId });

  if (!cart) {
    return res.status(404).json({
      message: "Cart not found",
    });
  }

  const itemIndex = cart.items.findIndex(
    (item) => item.inventory.toString() === inventoryId,
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
  cart.totalAmount = cart.items.reduce((sum, item) => sum + item.priceAtAdd * item.quantity, 0);

  await cart.save();

  // Navbar count
  res.locals.cartCount = cart.totalItems;

  return res.status(200).json({
    message: "Item removed from cart",
    newCount: cart.totalItems
  });
});

export const clearCart = asyncHandler(async (req, res) => {
  const userId = req.user.userId;

  const cart = await Cart.findOne({ user: userId });

  if (!cart) {
    return res.status(404).json({
      success: false,
      message: "Cart not found",
    });
  }

  cart.items = [];
  cart.totalItems = 0;
  cart.totalAmount = 0;

  await cart.save();

  res.locals.cartCount = 0;

  return res.status(200).json({
    success: true,
    message: "Cart cleared successfully",
    newCount: 0
  });
});
