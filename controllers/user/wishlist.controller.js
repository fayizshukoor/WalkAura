import mongoose from "mongoose";
import asyncHandler from "../../utils/asyncHandler.util.js";
import Product from "../../models/Product.model.js";
import ProductVariant from "../../models/ProductVariant.model.js";
import Wishlist from "../../models/Wishlist.model.js";
import { calculateFinalPrice } from "../../helpers/price.helper.js";
import Inventory from "../../models/Inventory.model.js";

export const getWishlistPage = asyncHandler(async (req, res) => {
  const userId = req.user.userId;

  /* ------------------ Fetch Wishlist ------------------ */
  const wishlist = await Wishlist.findOne({ user: userId })
    .populate({
      path: "items.product",
      match: { isListed: true },
      populate: {
        path: "category",
        select: "name offerPercent offerExpiry",
      },
    })
    .populate({
      path: "items.variant",
      match: { isActive: true },
      select: "color images",
    })
    .lean();

  if (!wishlist || !wishlist.items.length) {
    return res.render("user/wishlist", {
      wishlistItems: [],
    });
  }

  /* ------------------ Filter Invalid Items ------------------ */
  const validItems = wishlist.items.filter(
    (item) => item.product && item.variant
  );

  const variantIds = validItems.map((item) => item.variant._id);

  /* ------------------ Fetch Inventory For Stock ------------------ */
  const inventory = await Inventory.find({
    variant: { $in: variantIds },
    isActive: true,
  })
    .select("variant stock")
    .lean();

    const stockMap = {};
    inventory.forEach((i) => {
      const key = i.variant.toString();
      stockMap[key] = (stockMap[key] || 0) + i.stock;
    });
  /* ------------------ Process Items ------------------ */
  const wishlistItems = validItems.map((item) => {
    const totalStock = stockMap[item.variant._id.toString()] || 0;

    const finalPrice = calculateFinalPrice({
      price: item.product.price,
      productOffer: item.product.offerPercent,
      productOfferExpiry: item.product.offerExpiry,
      categoryOffer: item.product.category?.offerPercent,
      categoryOfferExpiry: item.product.category?.offerExpiry,
    });

    return {
      productId: item.product._id,
      variantId: item.variant._id,
      name: item.product.name,
      categoryName: item.product.category?.name,
      slug: item.product.slug,
      color: item.variant.color,
      thumbnail: item.variant.images?.[0]?.url || null,
      price: item.product.price,
      finalPrice,
      totalStock,
      inStock: totalStock > 0,
    };
  });

  res.render("user/wishlist", {
    wishlistItems,
  });
});

export const addToWishlist =  asyncHandler( async (req, res)=>{
    const userId = req?.user?.userId;
    const {productId, variantId} = req.body;


    // Validate ObjectIds
  if (!mongoose.Types.ObjectId.isValid(productId) ||
      !mongoose.Types.ObjectId.isValid(variantId)) {
    return res.status(400).json({
      success: false,
      message: "Invalid product or variant ID",
    });
  }

  // Check product exists and active
  const product = await Product.findOne({
    _id: productId,
    isListed: true,
  }).lean();

  if (!product) {
    return res.status(404).json({
      success: false,
      message: "Product not found",
    });
  }

  // Check variant belongs to product
  const variant = await ProductVariant.findOne({
    _id: variantId,
    product: productId,
    isActive: true,
  }).lean();

  if (!variant) {
    return res.status(404).json({
      success: false,
      message: "Variant not found for this product",
    });
  }

  // Add using $addToSet to prevent duplicates
  const wishlist = await Wishlist.findOneAndUpdate(
    { user: userId },
    {
      $addToSet: {
        items: {
          product: productId,
          variant: variantId,
        },
      },
    },
    { upsert: true, new: true }
  );

  res.status(200).json({
    success: true,
    message: "Added to wishlist",
    wishlistCount: wishlist.items.length,
  });
});


export const removeFromWishlist = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const { productId, variantId } = req.body;

  /* -------- Validate IDs -------- */
  if (
    !mongoose.Types.ObjectId.isValid(productId) ||
    !mongoose.Types.ObjectId.isValid(variantId)
  ) {
    return res.status(400).json({
      success: false,
      message: "Invalid product or variant ID",
    });
  }

  /* -------- Remove Item -------- */
  const updatedWishlist = await Wishlist.findOneAndUpdate(
    { user: userId },
    {
      $pull: {
        items: {
          product: productId,
          variant: variantId,
        },
      },
    },
    { new: true }
  );

  // If wishlist doesn't exist, it's still success
  if (!updatedWishlist) {
    return res.status(200).json({
      success: true,
      message: "Item removed (wishlist not found)",
    });
  }

  // Optional Cleanup 
  if (updatedWishlist.items.length === 0) {
    await Wishlist.deleteOne({ user: userId });
  }

  return res.status(200).json({
    success: true,
    message: "Removed from wishlist",
    wishlistCount: updatedWishlist.items.length,
  });
});