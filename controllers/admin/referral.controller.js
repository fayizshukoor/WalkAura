import ReferralTransaction from "../../models/ReferralTransaction.model.js";
import asyncHandler from "../../utils/asyncHandler.util.js";

export const getAdminReferralPage = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = 10;
  const skip = (page - 1) * limit;
  const search = req.query.search?.trim() || "";

  // 🔹 Base aggregation pipeline
  const pipeline = [
    {
      $lookup: {
        from: "users",
        localField: "referrer",
        foreignField: "_id",
        as: "referrer",
      },
    },
    { $unwind: "$referrer" },

    {
      $lookup: {
        from: "users",
        localField: "referee",
        foreignField: "_id",
        as: "referee",
      },
    },
    { $unwind: "$referee" },
  ];

  // 🔹 Add Search Condition (if search exists)
  if (search) {
    pipeline.push({
      $match: {
        $or: [
          { "referrer.name": { $regex: search, $options: "i" } },
          { "referrer.email": { $regex: search, $options: "i" } },
          { "referee.name": { $regex: search, $options: "i" } },
          { "referee.email": { $regex: search, $options: "i" } },
        ],
      },
    });
  }

  //  Count Pipeline 
  const countPipeline = [...pipeline, { $count: "total" }];
  const countResult = await ReferralTransaction.aggregate(countPipeline);
  const totalCount = countResult.length > 0 ? countResult[0].total : 0;

  //  Add Sorting + Pagination
  pipeline.push(
    { $sort: { createdAt: -1 } },
    { $skip: skip },
    { $limit: limit },
    {
      $project: {
        amount: 1,
        status: 1,
        createdAt: 1,
        "referrer.name": 1,
        "referrer.email": 1,
        "referee.name": 1,
        "referee.email": 1,
      },
    }
  );

  const referrals = await ReferralTransaction.aggregate(pipeline);

  return res.render("admin/referrals", {
    layout: "layouts/admin",
    referrals,
    currentPage: page,
    totalPages: Math.ceil(totalCount / limit),
    search,
  });
});