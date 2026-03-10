import { calculateItemRefund } from "../../helpers/refund.helper.js";
import Inventory from "../../models/Inventory.model.js";
import Order from "../../models/Order.model.js";
import { creditToWallet } from "../../services/wallet.service.js";
import asyncHandler from "../../utils/asyncHandler.util.js";

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

  if(order.payment.status === "PAID"){
    if(item.refundStatus === "REFUNDED"){
      return res.status(400).json({
        success: false,
        message: "Item already refunded"
      });
    }
  

    const remainingRefund =order.pricing.totalAmount - order.payment.refundedAmount;

    const calculatedRefund = calculateItemRefund(order, item);

    // Check if this is the last refundable item
    const remainingItems = order.items.filter(
      (i) => i.refundStatus !== "REFUNDED"
    );

    let refundAmount;

    if (remainingItems.length === 1) {
      // Last refundable item absorbs rounding difference
      refundAmount = remainingRefund;
    } else {
      refundAmount = Math.min(calculatedRefund, remainingRefund);
    }

  await creditToWallet({
    userId,
    amount: refundAmount,
    source: "ORDER_REFUND",
    orderId: order._id,
    referenceId: `ORDER_REFUND_${order._id}_${itemId}`,
    description: "Refund for Cancelled Item"
  });

  item.refundStatus = "REFUNDED";
  item.refundedAmount = refundAmount;

  order.payment.status = "PARTIALLY_REFUNDED";
  order.payment.refundedAmount += refundAmount;

  if(order.payment.refundedAmount >= order.pricing.totalAmount){
    order.payment.status = "REFUNDED";
  }
}


  // Cancel the item
  item.status = "CANCELLED";
  item.cancellation = {
    reason: reason || "Cancelled by user",
    at: new Date(),
    by: "USER",
  };

  item.statusTimeline.push({
    status: "CANCELLED",
    at: new Date(),
  });

  // Check if ALL items are now cancelled
  const allCancelled = order.items.every((i) => i.status === "CANCELLED");
  if (allCancelled) {
    order.orderStatus = "CANCELLED";
    order.cancelledAt = new Date();
  }

  await order.save();

  // Increment stock
  await Inventory.findByIdAndUpdate(item.inventory, {
    $inc: { stock: item.quantity },
  });

  return res.status(200).json({
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
  
  const cancellableItems = order.items.filter((item) => item.status === "PENDING");

  if (cancellableItems.length === 0) {
    return res.status(400).json({
      success: false,
      message: "No items in this order can be cancelled",
    });
  }

  for (const item of cancellableItems) {
      item.status = "CANCELLED";
      item.cancellation = {
        reason: reason || "Cancelled by user",
        at: new Date(),
        by: "USER",
      };

      item.statusTimeline.push({
        status: "CANCELLED",
        at: new Date()
      })

      // Restore stock
      await Inventory.findByIdAndUpdate(item.inventory, {
        $inc: { stock: item.quantity },
      });
    }

  // Refund if Paid
  if(order.payment.status === "PAID" || order.payment.status === "PARTIALLY_REFUNDED"){
    const remainingFund = order.pricing.totalAmount - order.payment.refundedAmount;

    if(remainingFund > 0){
      await creditToWallet({
        userId,
        amount: remainingFund,
        source: "ORDER_REFUND",
        orderId: order._id,
        referenceId: `ORDER_REFUND_${order._id}_${Date.now()}`,
        description: "Refund for Full order Cancellation"
      });

      order.payment.refundedAmount += remainingFund;
      order.payment.status = "REFUNDED";

      for(const item of order.items){
        if(item.refundStatus !== "REFUNDED"){
          item.refundStatus = "REFUNDED";
          const refundAmount = calculateItemRefund(order, item);
          item.refundedAmount = refundAmount;
        }
      }
    }
  }



  // If ALL items are cancelled → cancel the order
  const allCancelled = order.items.every((i) => i.status === "CANCELLED");
  if (allCancelled) {
    order.orderStatus = "CANCELLED";
    order.cancelledAt = new Date();
  }

  await order.save();

  return res.status(200).json({
    success: true,
    message: "Order cancellation processed successfully",
  });
});
