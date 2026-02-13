import { calculateFinalPrice } from "../../helpers/price.helper.js";
import User from "../../models/User.model.js";
import Address from "../../models/Address.model.js";
import Cart from "../../models/Cart.model.js";
import Inventory from "../../models/Inventory.model.js";
import Order from "../../models/Order.model.js";
import { getReconciledCart } from "../../services/cart.service.js";
import asyncHandler from "../../utils/asyncHandler.js";
import { generateOrderId } from "../../utils/generateOrderId.util.js";

const TAX_PERCENTAGE = 18;

export const getCheckoutPage = asyncHandler(async (req, res) => {
  const userId = req?.user?.userId;

  // Get Cart with full details

  const result = await getReconciledCart(userId);
  // Check cart is empty

  if (!result || !result.cart || result.cart.items.length === 0) {
    if (result?.changes?.length) {
      req.session.cartChanges = result.changes;
    }

    // If it's an AJAX/Fetch request (from a button)
    if (req.xhr) {
      return res.status(409).json({
        success: false,
        cartEmpty: true,
        message: "Your cart is empty. Please add items before checkout.",
        changes: result?.changes || [],
      });
    }

    req.flash("error", "Cart is Empty");
    return res.redirect("/cart");
  }

  const { cart, hasChanges, changes } = result;

  if (hasChanges && changes.length > 0) {
    req.session.cartChanges = changes;
  }

  if (cart.items.length === 0 && hasChanges) {
    if (req.xhr) {
      return res.status(409).json({
        success: false,
        cartEmpty: true,
        message: "Items in your cart are no longer available.",
        changes,
      });
    }

    req.flash("error", "Items in your cart are no longer available.");
    return res.redirect("/cart");
  }

  if (hasChanges) {
    if (req.xhr) {
      return res.status(409).json({
        success: false,
        message: "Your cart was updated. Please review before checkout.",
        changes,
      });
    }

    req.flash(
      "error",
      "Some items in your cart were updated. Please review before checkout.",
    );
    return res.redirect("/cart");
  }

  // Get user addresses
  const addresses = await Address.find({
    userId: userId,
    isDeleted: false,
  }).sort({ isDefault: -1, createdAt: -1 });

  const subtotal = cart.items.reduce(
    (sum, item) => sum + item.priceAtAdd * item.quantity,
    0,
  );
  const tax = Math.round((subtotal * TAX_PERCENTAGE) / 100);
  const shippingCharge = 0;
  const discount = 0;
  const totalAmount = subtotal + tax + shippingCharge - discount;

  return res.render("user/checkout", {
    checkout: {
      items: cart.items.map((item) => ({
        product: item.product._id,
        productName: item.product.name,
        variant: item.variant._id,
        color: item.variant.color,
        image: item.variant.images[0]?.url || "",
        inventory: item.inventory._id,
        size: item.inventory.size,
        quantity: item.quantity,
        price: item.priceAtAdd,
        itemTotal: item.priceAtAdd * item.quantity,
      })),
      addresses,
      pricing: {
        subtotal,
        tax,
        shippingCharge: 0,
        discount: 0,
        totalAmount,
      },
    },
  });
});

export const placeOrder = asyncHandler(async (req, res) => {
  const { addressId, paymentMethod = "COD" } = req.body;
  const userId = req.user.userId;

  if (paymentMethod !== "COD") {
    return res.status(400).json({
      success: false,
      message: "Only Cash on Delivery is supported currently",
    });
  }

  // User name and email for snapshot
  const user = await User.findById(userId).select("name email");

  if (!user) {
    return res.status(404).json({
      success: false,
      message: "User not found",
    });
  }
  // Validate address
  const address = await Address.findOne({
    _id: addressId,
    userId: userId,
    isDeleted: false,
  });

  if (!address) {
    return res.status(404).json({
      success: false,
      message: "Invalid delivery address",
    });
  }

  // Get cart with populate
  const cart = await Cart.findOne({ user: userId })
    .populate({
      path: "items.product",
      select: "name price offerPercent offerExpiry isListed category",
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

  if (!cart || cart.items.length === 0) {
    return res.status(400).json({
      success: false,
      message: "Your cart is empty",
    });
  }

  const orderItems = [];
  const stockUpdates = [];

  for (const item of cart.items) {
    const size = item.inventory?.size ?? "N/A";
    const color = item.variant?.color ?? "N/A";

    // Validate product
    if (!item.product || !item.product.isListed) {
      return res.status(409).json({
        success: false,
        message: `Product "${item.product?.name || "Unknown"}" is no longer available`,
      });
    }

    // Validate category
    if (
      !item.product.category ||
      !item.product.category.isListed ||
      item.product.category.isDeleted
    ) {
      return res.status(409).json({
        success: false,
        message: `Product "${item.product.name}" category is no longer available`,
      });
    }

    // Validate variant
    if (!item.variant || !item.variant.isActive) {
      return res.status(409).json({
        success: false,
        message: `Color ${color} for "${item.product.name}" is no longer available`,
      });
    }

    // Validate inventory and stock
    if (!item.inventory || !item.inventory.isActive) {
      return res.status(409).json({
        success: false,
        message: `Size ${size} for "${item.product.name}" is no longer available`,
      });
    }

    if (item.inventory.stock < item.quantity) {
      return res.status(409).json({
        success: false,
        message: `Insufficient stock for "${item.product.name}". Only ${item.inventory.stock} available on ${color} color of size ${size}`,
      });
    }

    // Update stock
    const updated = await Inventory.findOneAndUpdate(
      { _id: item.inventory._id, stock: { $gte: item.quantity } },
      { $inc: { stock: -item.quantity } },
    );

    if (!updated) {
      return res.status(409).json({
        success: false,
        message: "Stock changed during checkout. Please try again.",
      });
    }

    // Calculate final price
    const finalPrice = calculateFinalPrice({
      price: item.product.price,
      productOffer: item.product.offerPercent,
      productOfferExpiry: item.product.offerExpiry,
      categoryOffer: item.product.category.offerPercent,
      categoryOfferExpiry: item.product.category.offerExpiry,
    });

    orderItems.push({
      product: item.product._id,
      productName: item.product.name,
      variant: item.variant._id,
      color: item.variant.color,
      image: item.variant.images[0]?.url || "",
      inventory: item.inventory._id,
      size: item.inventory.size,
      sku: item.inventory.sku,
      quantity: item.quantity,
      price: finalPrice,
      itemTotal: finalPrice * item.quantity,
      status: "PENDING",
      statusTimeline: [
        {
          status: "PENDING",
          at: new Date(),
        },
      ],
    });
  }

  // Calculate totals
  const subtotal = orderItems.reduce((sum, item) => sum + item.itemTotal, 0);
  const tax = Math.round((subtotal * TAX_PERCENTAGE) / 100);
  const shippingCharge = 0;
  const discount = 0;
  const totalAmount = subtotal + tax + shippingCharge - discount;

  // Generate unique order ID
  const orderId = generateOrderId();

  // Create order
  const order = new Order({
    orderId,
    user: userId,
    customerSnapshot: {
      name: user.name,
      email: user.email,
    },
    items: orderItems,
    shippingAddress: {
      fullName: address.fullName,
      phone: address.phone,
      streetAddress: address.streetAddress,
      city: address.city,
      state: address.state,
      pincode: address.pincode,
    },
    payment: {
      method: paymentMethod,
      status: "PENDING",
      refundedAmount: 0,
    },
    orderStatus: "PENDING",
    pricing: {
      subtotal,
      tax,
      taxPercentage: TAX_PERCENTAGE,
      shippingCharge,
      discount,
      totalAmount,
    },
  });

  await order.save();

  // Clear cart
  cart.items = [];
  cart.totalItems = 0;
  cart.totalAmount = 0;
  await cart.save();

  res.status(201).json({
    success: true,
    message: "Order placed successfully",
    order: {
      orderId: order.orderId,
      _id: order._id,
      totalAmount: order.pricing.totalAmount,
      orderDate: order.createdAt,
    },
  });
});
