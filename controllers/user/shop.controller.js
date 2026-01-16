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

    // Listed products only
    let query = {
      isListed: true
    };

    // Search
    if (search) {
      query.name = { $regex: search, $options: "i" };
    }

    // Category filter
    if (category && category !== "all") {
        query.category = category;
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

    const categories = await Category.find({isListed : true});


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
        sort: sort || ""
      }
    });

  
});














