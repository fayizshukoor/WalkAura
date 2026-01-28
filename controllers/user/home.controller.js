import { calculateFinalPrice } from "../../helpers/price.helper.js";
import Category from "../../models/Category.model.js";
import Product from "../../models/Product.model.js";
import asyncHandler from "../../utils/asyncHandler.js";


export const getHomePage = asyncHandler(async (req, res) => {

    /* -------- Active Categories -------- */
    const activeCategories = await Category.find({
      isListed: true,
      isDeleted: false
    }).select("_id offerPercent offerExpiry");
  
    const activeCategoryIds = activeCategories.map(c => c._id);
  
    /* -------- Base Match -------- */
    const matchStage = {
      isListed: true,
      category: { $in: activeCategoryIds }
    };
  
    /* -------- Aggregation Pipeline -------- */
    const newArrivals = await Product.aggregate([
      { $match: matchStage },
  
   
      { $sort: { createdAt: -1 } },
  
      // Only 4 products needed
      { $limit: 4 },
  
      /* Join category (for offers + name) */
      {
        $lookup: {
          from: "categories",
          localField: "category",
          foreignField: "_id",
          as: "category"
        }
      },
      { $unwind: "$category" },
  
      /* Get first Active variant */
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
  
      /* Remove products without active variants */
      { $match: { "variant.0": { $exists: true } } },
  
      /* Extract thumbnail */
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
  
      /* Final projection */
      {
        $project: {
          name: 1,
          slug: 1,
          price: 1,
          offerPercent: 1,
          offerExpiry: 1,
          category: {
            name: 1,
            offerPercent: 1,
            offerExpiry: 1
          },
          thumbnail: 1,
          createdAt: 1
        }
      }
    ]);
  
    /* -------- Final Price Calculation -------- */
    const processedNewArrivals = newArrivals.map(p => ({
      ...p,
      finalPrice: calculateFinalPrice({
        price: p.price,
        productOffer: p.offerPercent,
        productOfferExpiry: p.offerExpiry,
        categoryOffer: p.category.offerPercent,
        categoryOfferExpiry: p.category.offerExpiry
      })
    }));
  
    /* -------- Render Home -------- */
    res.render("user/home", {
      newArrivals: processedNewArrivals
    });
  });
  