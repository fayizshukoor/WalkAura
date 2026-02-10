import asyncHandler from "../../utils/asyncHandler.js";
import Order from "../../models/Order.model.js";

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

  if (!item) {
    return res.status(404).json({
      success: false,
      message: "Item not found in this order",
    });
  }

  // Eligibility checks
  if (item.status !== "DELIVERED" || item.returnInfo?.rejectedAt) {
    return res.status(400).json({
      success: false,
      message: `Return request is not allowed for this item`,
    });
  }

  // Prevent duplicate return requests
  if (item.status === "RETURN_REQUESTED" || item.status === "RETURNED") {
    return res.status(400).json({
      success: false,
      message: "Return already requested for this item",
    });
  }

  const now = new Date();

  // Mark return requested
  item.status = "RETURN_REQUESTED";
  item.returnInfo = {
    reason: reason.trim(),
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