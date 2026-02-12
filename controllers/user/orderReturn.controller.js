import asyncHandler from "../../utils/asyncHandler.js";
import Order from "../../models/Order.model.js";
import { isItemEligibleForReturn } from "../../utils/returnEligibility.util.js";
import { uploadToCloudinary } from "../../utils/cloudinaryUpload.util.js";

const PHOTO_REQUIRED_REASONS = [
  "Defective product",
  "Wrong item received"
]
// Request Return
export const requestReturn = asyncHandler(async (req, res) => {
  const { orderId, itemId } = req.params;
  const { reason } = req.body;
  const userId = req?.user?.userId;

  if (!reason || !reason.trim()) {
    return res.status(400).json({
      success: false,
      message: "Return reason is required",
    });
  }

  const order = await Order.findOne({
    orderId,
    user: userId,
  });

  if (!order) {
    return res.status(404).json({
      success: false,
      message: "Order not found",
    });
  }

  const item = order.items.id(itemId);
  const eligibility = isItemEligibleForReturn(item);

  if(!eligibility.eligible){
    return res.status(400).json({
      success: false,
      message: eligibility.message
    })
  }

  const requiresPhoto = PHOTO_REQUIRED_REASONS.includes(reason.trim());

  if(requiresPhoto && (!req.files || req.files.length === 0)){
    return res.status(400).json({
      success: false,
      message: "Photo proof is required for this Return reason"
    })
  }

  // Upload images
  let uploadedImages = [];

  if(req.files && req.files.length > 0){
    for(const file of req.files){
      const result =  await uploadToCloudinary(file.buffer,{
        folder: "walkaura/returns",
        width: 800,
        height: 800,
        crop: "fill"
      });

      uploadedImages.push({
        url: result.secure_url,
        publicId: result.public_id
      });

    }
  }

  const now = new Date();

  // Mark return requested
  item.status = "RETURN_REQUESTED";
  item.returnInfo = {
    reason: reason.trim(),
    images: uploadedImages,
    requestedAt: now,
  };

  item.statusTimeline.push({
    status: "RETURN_REQUESTED",
    at: now,
  });

  await order.save();

  return res.status(200).json({
    success: true,
    message: "Return request submitted successfully"
  });
});



export const requestReturnEntireOrder = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const { reason } = req.body;
  const userId = req?.user?.userId;

  if (!reason || !reason.trim()) {
    return res.status(400).json({
      success: false,
      message: "Return reason is required",
    });
  }

  const order = await Order.findOne({
    orderId,
    user: userId,
  });

  if (!order) {
    return res.status(404).json({
      success: false,
      message: "Order not found",
    });
  }

  let eligibleCount = 0;
  const now = new Date();

  for (const item of order.items) {
    // Only delivered items can be returned
    if (item.status !== "DELIVERED" || item.returnInfo?.rejectedAt) {
      continue;
    }

    // Prevent duplicate return requests
    if (
      item.status === "RETURN_REQUESTED" ||
      item.status === "RETURNED"
    ) {
      continue;
    }

    item.status = "RETURN_REQUESTED";
    item.returnInfo = {
      reason: reason.trim(),
      requestedAt: now,
    };

    item.statusTimeline.push({
      status: "RETURN_REQUESTED",
      at: now,
    });

    eligibleCount++;
  }

  if (eligibleCount === 0) {
    return res.status(400).json({
      success: false,
      message: "No items in this order are eligible for return",
    });
  }

  await order.save();

  return res.status(200).json({
    success: true,
    message: "Return request submitted for eligible items"
  });
});