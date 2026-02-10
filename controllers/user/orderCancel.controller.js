import Inventory from "../../models/Inventory.model.js";
import Order from "../../models/Order.model.js";
import asyncHandler from "../../utils/asyncHandler.js";

// CANCEL SINGLE ITEM
export const cancelItem = asyncHandler(async (req, res) => {
  const { orderId, itemId } = req.params;
  const { reason } = req.body;
  const userId = req?.user?.userId;

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
      message: "Item not found in order",
    });
  }

  if (item.status !== "PENDING") {
    return res.status(400).json({
      success: false,
      message: `Cannot cancel this item. Current status: ${item.status}`,
    });
  }

  // Cancel the item
  item.status = "CANCELLED";
  item.cancellation = {
    reason: reason || "Cancelled by user",
    at: new Date(),
    by: "USER"
  }

  item.statusTimeline.push({
    status: "CANCELLED",
    at: new Date()
  })

  // Check if ALL items are now cancelled
  const allCancelled = order.items.every(i => i.status === "CANCELLED");
  if (allCancelled) {
    order.orderStatus = "CANCELLED";
    order.cancelledAt = new Date();
  }

  await order.save();

  // Increment stock
  await Inventory.findByIdAndUpdate(item.inventory, {
    $inc: { stock: item.quantity },
  });

  res.status(200).json({
    success: true,
    message: "Item cancelled successfully",
  });
});

// Cancel Entire Order
export const cancelEntireOrder = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const { reason } = req.body;
  const userId = req?.user?.userId;

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

  let cancelledCount = 0;

  for (const item of order.items) {
    // Only cancel items that are still cancellable
    if (item.status === "PENDING") {
      item.status = "CANCELLED";
      item.cancellation = {
        reason: reason || "Cancelled by user",
        at: new Date(),
        by: "USER",
      };

      // Restore stock
      await Inventory.findByIdAndUpdate(item.inventory, {
        $inc: { stock: item.quantity },
      });

      cancelledCount++;
    }
  }

  if (cancelledCount === 0) {
    return res.status(400).json({
      success: false,
      message: "No items in this order can be cancelled",
    });
  }

  // If ALL items are cancelled → cancel the order
  const allCancelled = order.items.every(i => i.status === "CANCELLED");
  if (allCancelled) {
    order.orderStatus = "CANCELLED";
    order.cancelledAt = new Date();
  }

  await order.save();

  res.status(200).json({
    success: true,
    message: "Order cancellation processed successfully"
  });
});