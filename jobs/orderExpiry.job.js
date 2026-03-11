import cron from "node-cron";
import Order from "../models/Order.model.js";
import { restoreStockAndCancel } from "../services/order.service.js";


cron.schedule("* * * * *", async () => {
  const expiryTime = new Date(Date.now() - 15 * 60 * 1000);

  const expiredOrders = await Order.find({
    "payment.status": "PENDING",
    "payment.method": "RAZORPAY",
    createdAt: { $lt: expiryTime }
  }).limit(20);

  for (const order of expiredOrders) {
    await restoreStockAndCancel(order);
  }
});