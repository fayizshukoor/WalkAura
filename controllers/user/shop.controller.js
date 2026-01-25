import asyncHandler from "../../utils/asyncHandler.js";
import Product from "../../models/Product.model.js";
import { calculateFinalPrice } from "../../helpers/price.helper.js";
import Category from "../../models/Category.model.js";

export const getProducts = asyncHandler(async (req, res) => {

    const {
      search,
      category,
      priceRange,
      sort,
      gender,
      page = 1
    } = req.query;

    const activeCategories = await Category.find({isDeleted : false,isListed : true}).select("_id");
    

    // Listed products with active categories only
    let query = {
      isListed: true,
      category : {$in : activeCategories }
    };

    // Search
    if (search) {
      query.name = { $regex: search, $options: "i" };
    }

    // Category filter
    if (category && category !== "all") {
        query.category = {
          $in : activeCategories.map(c => c._id).filter(id => id.toString() === category)
        };
      }

    // Gender filter
    if (gender && gender !== "all") {
        query.gender = gender;
      }

    // Price range filter
    const priceRangeMap = {
      "below_1000": { $lt: 1000 },
      "1000_2000": { $gte: 1000, $lte: 2000 },
      "2000_3000": { $gte: 2000, $lte: 3000 },
      "above_3000": { $gt: 3000 }
    };

    if (priceRange && priceRange !== "all" && priceRangeMap[priceRange]) {
        query.price = priceRangeMap[priceRange];
      }

    // Sorting
    const sortOptions = {
      price_asc: { price: 1 },
      price_desc: { price: -1 },
      name_asc: { name: 1 },
      name_desc: { name: -1 }
    };

    const sortQuery = sortOptions[sort] || { createdAt: -1 };

    // pagination
    const pageNumber = Number(page) || 1;
    const limit = 6;
    const skip = (pageNumber - 1) * limit;

    // Populate category offer
    const products = await Product.find(query)
      .populate("category", "name offerPercent offerExpiry")
      .sort(sortQuery)
      .skip(skip)
      .limit(limit)
      .lean();

    const totalProducts = await Product.countDocuments(query);

    // Apply offer
    const processedProducts = products.map(product => {
      const finalPrice = calculateFinalPrice({
        price: product.price,
        productOffer: product.offerPercent,
        productOfferExpiry: product.offerExpiry,
        categoryOffer: product.category?.offerPercent,
        categoryOfferExpiry: product.category?.offerExpiry
      });


      return {
        ...product,
        finalPrice
      };
    });

    const categories = await Category.find({isListed : true, isDeleted : false});


    const pagination = {
      totalProducts,
      currentPage: pageNumber,
      totalPages: Math.ceil(totalProducts / limit)
    };


    // Initial render
    res.render("user/shop", {
      products: processedProducts,
      categories,
      pagination,
      filters: {
        search: search || "",
        category: category || "all",
        priceRange: priceRange || "all",
        gender: gender || "all",
        sort: sort || "all"
      }
    });

  
});





export const getProductDetails = asyncHandler(async (req, res) => {
  const { slug } = req.params;

  //  Fetch listed product only
  const product = await Product.findOne({
    slug,
    isListed: true
  })
    .populate("category", "name offerPercent offerExpiry isListed isDeleted")
    .lean();

  // If product not found or category is inactive redirect to shop
  if (!product || !product.category.isListed || product.category.isDeleted) {
    return res.redirect("/shop");
  }

  // Calculate total stock from sizes
  const totalStock = product.sizes.reduce(
    (sum, size) => sum + size.stock,
    0
  );

  // Calculate final price
  const finalPrice = calculateFinalPrice({
    price: product.price,
    productOffer: product.offerPercent,
    productOfferExpiry: product.offerExpiry,
    categoryOffer: product.category?.offerPercent,
    categoryOfferExpiry: product.category?.offerExpiry
  });

  // Review stats (read-only)
  const reviewCount = product.reviews.length;
  const averageRating =
    reviewCount > 0
      ? (
          product.reviews.reduce((sum, r) => sum + r.rating, 0) / reviewCount
        ).toFixed(1)
      : 0;

  // Related products (same category)
  const relatedProducts = await Product.find({
    category: product.category._id,
    _id: { $ne: product._id },
    isListed: true
  })
    .limit(4)
    .lean();

  // Render Product Detail page
  res.render("user/product-details", {
    product,
    finalPrice,
    totalStock,
    averageRating,
    reviewCount,
    relatedProducts
  });
});











