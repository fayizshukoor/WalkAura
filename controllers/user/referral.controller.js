import User from "../../models/User.model.js";
import ReferralTransaction from "../../models/ReferralTransaction.model.js";
import asyncHandler from "../../utils/asyncHandler.util.js";
import mongoose from "mongoose";

export const getReferralPage = asyncHandler(async (req, res) => {
  const userId = req?.user?.userId;

  //  Get current user referral code
  const user = await User.findById(userId).select("referralCode");

  // Total Referrals Count
  const totalReferrals = await User.countDocuments({
    referredBy: userId,
    isVerified: true, // only verified users count
  });

  // Total Earned Amount
  const earningsResult = await ReferralTransaction.aggregate([
    {
      $match: {
        referrer: new mongoose.Types.ObjectId(userId),
        status: "COMPLETED",
      },
    },
    {
      $group: {
        _id: null,
        totalEarned: { $sum: "$amount" },
      },
    },
  ]);

  console.log(earningsResult);

  const totalEarned =
    earningsResult.length > 0 ? earningsResult[0].totalEarned : 0;

  return res.render("user/referral", {
    referralCode: user.referralCode,
    totalReferrals,
    totalEarned,
  });
});