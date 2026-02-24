import crypto from "crypto";
import User from "../models/User.model.js";

export const generateReferralCode = async (name) => {
  const base = name.replace(/\s+/g, "").substring(0, 4).toUpperCase();

  let referralCode;
  let exists = true;

  while (exists) {
    const randomPart = crypto.randomBytes(3).toString("hex").toUpperCase(); 
    referralCode = `${base}${randomPart}`;

    const existingUser = await User.findOne({ referralCode });
    if (!existingUser) {
      exists = false;
    }
  }

  return referralCode;
};