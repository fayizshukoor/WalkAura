import User from "../models/User.model.js";
import ReferralTransaction from "../models/ReferralTransaction.model.js";
import { REFERRAL_REWARD_AMOUNT } from "../constants/app.constants.js";
import { creditToWallet } from "./wallet.service.js";

export const processReferralReward = async (userId) => {
  try {
    //  Fetch user
    const user = await User.findById(userId);

    if (!user) return;

    //  Guard Conditions
    if (
      !user.referredBy ||          
      !user.isVerified ||          
      user.isReferralRewarded     
    ) {
      return;
    }

    // Only update if reward not yet processed
    const updateResult = await User.updateOne(
      { _id: user._id, isReferralRewarded: false },
      { $set: { isReferralRewarded: true } }
    );

    console.log(updateResult);

    if (updateResult.modifiedCount === 0) {
      // Another request already processed reward
      return;
    }

    //  Fetch Referrer
    const referrer = await User.findById(user.referredBy);

    if (!referrer || referrer.isBlocked) {
      return;
    }

    const amount = REFERRAL_REWARD_AMOUNT;

    // 🔹 Create Audit Record
    await ReferralTransaction.create({
      referrer: referrer._id,
      referee: user._id,
      amount,
      type: "CREDIT",
      status: "COMPLETED",
      description: "Referral reward on first login",
    });

    // 🔹 Credit Wallets (must use $inc inside wallet service)
    await creditToWallet({
        userId: referrer._id,
        amount,
        source: "REFERRAL_BONUS",
        description: "Referral reward"
    });

    await creditToWallet({
        userId: user._id,
        amount,
        source: "REFERRAL_BONUS",
        description: "Referral bonus"
    });

  } catch (error) {
    console.error("Referral Reward Error:", error);
    throw error;
  }
};