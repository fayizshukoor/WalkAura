import Cart from "../models/Cart.model.js";
import { calculateFinalPrice } from "../helpers/price.helper.js";

export const getReconciledCart = async (userId) => {
  const cart = await Cart.findOne({ user: userId })
    .populate({
      path: "items.product",
      select: "name slug price offerPercent offerExpiry category gender isListed",
      populate: {
        path: "category",
        select: "name offerPercent offerExpiry isListed isDeleted",
      },
    })
    .populate({
      path: "items.variant",
      select: "color images isActive",
    })
    .populate({
      path: "items.inventory",
      select: "size stock sku isActive",
    });

  if (!cart){
    return null;
  } 

  const validItems = [];
  const changes = [];
  let hasChanges = false;

  for (const item of cart.items) {

    const size = item.inventory?.size ?? "N/A";
    const color = item.variant?.color ?? "N/A";
    const productName = item.product?.name ?? "Unknown product";

    // Product / variant / inventory checks
    if (
      !item.product ||
      !item.variant ||
      !item.inventory ||
      !item.product.isListed ||
      !item.variant.isActive ||
      !item.inventory.isActive
    ) {
      hasChanges = true;
      changes.push({
        type: "REMOVED",
        productName: productName,
        reason: `Size UK ${size}, Color ${color} is no longer available`,
      });
      continue;
    }

    // Category checks
    if (
      !item.product.category ||
      !item.product.category.isListed ||
      item.product.category.isDeleted
    ) {
      hasChanges = true;
      changes.push({
        type: "REMOVED",
        productName: productName,
        reason: "Product is no longer available",
      });
      continue;
    }

    // Stock checks

    if (item.inventory.stock === 0) {
      hasChanges = true;
      changes.push({
        type: "OUT_OF_STOCK",
        productName: productName,
        reason: `Size UK ${size}, Color ${color} is out of stock`,
      });
      continue;
    }
  
    if (item.quantity > item.inventory.stock) {
      hasChanges = true;
      changes.push({
        type: "QUANTITY_UPDATED",
        productName: productName,
        reason: `Size UK ${size}, Color ${color} Quantity reduced to ${item.inventory.stock}`,
      });
      item.quantity = item.inventory.stock;
    }

    const currentPrice = calculateFinalPrice({
      price: item.product.price,
      productOffer: item.product.offerPercent,
      productOfferExpiry: item.product.offerExpiry,
      categoryOffer: item.product.category.offerPercent,
      categoryOfferExpiry: item.product.category.offerExpiry,
    });

    if (currentPrice !== item.priceAtAdd) {
      hasChanges = true;
      changes.push({
        type: "PRICE_UPDATED",
        productName: productName,
        reason: `Price updated from ₹${item.priceAtAdd} to ₹${currentPrice}`,
      });
      item.priceAtAdd = currentPrice;
      item.priceChanged = true;
    }

    validItems.push(item);
  }

  if (hasChanges) {
    cart.items = validItems;
    cart.totalItems = cart.items.reduce((sum, item) => sum + item.quantity, 0);
    cart.totalAmount = cart.items.reduce((sum, item) => sum + item.priceAtAdd * item.quantity,0);
    await cart.save();
  }

  return {
    cart,
    hasChanges,
    changes
  };
};
