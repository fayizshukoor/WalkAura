import asyncHandler from "../../utils/asyncHandler.js";
import Product from "../../models/Product.model.js";
import { calculateFinalPrice } from "../../helpers/price.helper.js";
import Category from "../../models/Category.model.js";
import mongoose from "mongoose";
import ProductVariant from "../../models/ProductVariant.model.js";
import Inventory from "../../models/Inventory.model.js";


export const getProducts = asyncHandler(async (req, res) => {
  const {
    search,
    category,
    gender,
    sort,
    priceRange,
    page = 1
  } = req.query;

  const limit = 6;
  const currentPage = Number(page) || 1;
  const skip = (currentPage - 1) * limit;

  /* -------- Active Categories (used in filter + UI) -------- */
  const activeCategories = await Category.find({
    isListed: true,
    isDeleted: false
  }).select("_id name offerPercent offerExpiry");

  const activeCategoryIds = activeCategories.map(c => c._id);

  /* -------- Base Product Filters -------- */
  const matchStage = {
    isListed: true,
    category: { $in: activeCategoryIds }
  };

  if (search) {
    matchStage.name = { $regex: search.trim(), $options: "i" };
  }

  if (category && category !== "all" && mongoose.Types.ObjectId.isValid(category)) {
      const isActiveCategory = activeCategoryIds.some(id => id.equals(category));

      if(isActiveCategory){
        matchStage.category = new mongoose.Types.ObjectId(category);
      }else{
            matchStage._id = { $exists: false };
      }
  }

  if (gender && gender !== "all") {
    matchStage.gender = gender;
  }

  const priceRangeMap = {
    below_5000: { $lt: 5000 },
    "5000_10000": { $gte: 5000, $lte: 10000 },
    above_10000: { $gt: 10000 }
  };
  
  if (priceRange && priceRange !== "all" && priceRangeMap[priceRange]) {
    matchStage.price = priceRangeMap[priceRange];
  }
  

  /* -------- Sorting -------- */
  const sortMap = {
    price_asc: { price: 1 },
    price_desc: { price: -1 },
    name_asc: { name: 1 },
    name_desc: { name: -1 }
  };

  const sortStage = sortMap[sort] || { createdAt: -1 };

  /* -------- Aggregation Pipeline -------- */

  const basePipeline = [
    { $match: matchStage },

    /* Join Category (for offers) */
    {
      $lookup: {
        from: "categories",
        localField: "category",
        foreignField: "_id",
        as: "category"
      }
    },
    { $unwind: "$category" },

    /* Ensure at least ONE active variant + get thumbnail */
    {
      $lookup: {
        from: "productvariants",
        let: { productId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$product", "$$productId"] },
                  { $eq: ["$isActive", true] }
                ]
              }
            }
          },
          {
            $project: {
              _id: 0,
              images: 1
            }
          },
          { $limit: 1 }
        ],
        as: "variant"
      }
    },

    //  Remove products with no active variants
    { $match: { "variant.0": { $exists: true } } },

    // Extract thumbnail 
    {
      $addFields: {
        thumbnail: {
          $arrayElemAt: [{
            $arrayElemAt:["$variant.images.url", 0]
          },0]
        }
      }
    },

    // Final projection for UI 
    {
      $project: {
        name: 1,
        slug: 1,
        price: 1,
        offerPercent: 1,
        offerExpiry: 1,
        category: 1,
        gender: 1,
        thumbnail: 1,
        createdAt: 1
      }
    }
  ];

  // Products + Count
  const [products, countResult] = await Promise.all([
    Product.aggregate([
      ...basePipeline,
      { $sort: sortStage },
      { $skip: skip },
      { $limit: limit }
    ]),
    Product.aggregate([
      ...basePipeline,
      { $count: "count" }
    ])
  ]);


  const totalProducts = countResult[0]?.count || 0;

  // Final Price Calculation
  const processedProducts = products.map(p => ({
    ...p,
    finalPrice: calculateFinalPrice({
      price: p.price,
      productOffer: p.offerPercent,
      productOfferExpiry: p.offerExpiry,
      categoryOffer: p.category.offerPercent,
      categoryOfferExpiry: p.category.offerExpiry
    })
  }));



  /* -------- Render -------- */
  res.render("user/shop", {
    products: processedProducts,
    activeCategories,
    filters: {
      search: search || "",
      category: category || "all",
      gender: gender || "all",
      sort: sort || "",
      priceRange: priceRange || ""
    },
    pagination: {
      currentPage,
      totalPages: Math.ceil(totalProducts / limit)
    }
  });
});








export const getProductDetails = asyncHandler(async (req, res) => {
  const { slug } = req.params;

  // Fetch product and category
  const product = await Product.findOne({
    slug,
    isListed: true
  })
    .populate("category", "name offerPercent offerExpiry isListed isDeleted")
    .lean();

  if (!product || !product.category || !product.category.isListed || product.category.isDeleted ) {
    return res.redirect("/shop");
  }

  // Fetch active variants
  const variants = await ProductVariant.find({
    product: product._id,
    isActive: true
  })
    .select("color images")
    .lean();

  // if no variant redirect to shop
  if (!variants.length) {
    return res.redirect("/shop");
  }

  const variantIds = variants.map(v => v._id);

  // Fetch inventory 
  const inventory = await Inventory.find({
    variant: { $in: variantIds },
    isActive: true
  })
    .select("variant size stock")
    .lean();

  // Merge variants with size and stock
  const variantsWithSizes = variants.map(variant => {
    const sizes = inventory
      .filter(i => i.variant.toString() === variant._id.toString())
      .map(i => ({
        inventoryId: i._id,
        size: i.size,
        stock: i.stock,
        inStock: i.stock > 0
      }));

    return {
      ...variant,
      sizes,
      totalStock: sizes.reduce((sum, s) => sum + s.stock, 0)
    };
  });

  // Total Stock
  const totalStock = variantsWithSizes.reduce(
    (sum, v) => sum + v.totalStock,
    0
  );

  // Final Price Calculation 
  const finalPrice = calculateFinalPrice({
    price: product.price,
    productOffer: product.offerPercent,
    productOfferExpiry: product.offerExpiry,
    categoryOffer: product.category.offerPercent,
    categoryOfferExpiry: product.category.offerExpiry
  });

  // Reviews (Currently not added)
  const reviewCount = product.reviews.length;
  const averageRating =
    reviewCount > 0
      ? (
          product.reviews.reduce((sum, r) => sum + r.rating, 0) / reviewCount
        ).toFixed(1)
      : 0;

  // Related Products
  const relatedProducts = await Product.aggregate([
    {
      $match: {
        _id: { $ne: product._id },
        category: product.category._id,
        gender: product.gender,
        isListed: true
      }
    },

    {
      $lookup: {
        from: "categories",
        localField: "category",
        foreignField: "_id",
        as: "category"
      }
    },
    { $unwind: "$category" },

    {
      $lookup: {
        from: "productvariants",
        let: { productId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$product", "$$productId"] },
                  { $eq: ["$isActive", true] }
                ]
              }
            }
          },
          {
            $project: {
              images: 1
            }
          },
          { $limit: 1 }
        ],
        as: "variant"
      }
    },

    { $match: { "variant.0": { $exists: true } } },

    {
      $addFields: {
        thumbnail: {
          $arrayElemAt: [
            { $arrayElemAt: ["$variant.images.url", 0] },
            0
          ]
        }
      }
    },

    { $limit: 4 },

    {
      $project: {
        name: 1,
        slug: 1,
        price: 1,
        offerPercent: 1,
        offerExpiry: 1,
        category: 1,
        gender: 1,
        thumbnail: 1
      }
    }
  ]);

  const processedRelatedProducts = relatedProducts.map(p => ({
    ...p,
    finalPrice: calculateFinalPrice({
      price: p.price,
      productOffer: p.offerPercent,
      productOfferExpiry: p.offerExpiry,
      categoryOffer: p.category.offerPercent,
      categoryOfferExpiry: p.category.offerExpiry
    })
  }));

  // Render the page
  res.render("user/product-details", {
    product,
    variants: variantsWithSizes,
    totalStock,
    finalPrice,
    averageRating,
    reviewCount,
    relatedProducts: processedRelatedProducts
  });
});












