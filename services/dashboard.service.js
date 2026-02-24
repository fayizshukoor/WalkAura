import Order from "../models/Order.model.js";

export const getDashboardStatsService = async ({ startDate, endDate }) => {
  const matchStage = {
    createdAt: { $gte: startDate, $lte: endDate },
    "payment.status": { $in: ["PAID", "REFUNDED"] }
  };

  const stats = await Order.aggregate([
    { $match: matchStage },

    {
      $addFields: {
        refundAmount: { $ifNull: ["$payment.refundedAmount", 0] },
        couponDiscount: { $ifNull: ["$appliedCoupon.discountAmount", 0] },
        totalAmount: { $ifNull: ["$pricing.totalAmount", 0] }
      }
    },

    {
      $group: {
        _id: null,
        totalOrders: { $sum: 1 },
        grossRevenue: { $sum: "$totalAmount" },
        totalRefund: { $sum: "$refundAmount" },
        totalCouponDiscount: { $sum: "$couponDiscount" },

        deliveredCount: {
          $sum: { $cond: [{ $eq: ["$orderStatus", "DELIVERED"] }, 1, 0] }
        },
        cancelledCount: {
          $sum: { $cond: [{ $eq: ["$orderStatus", "CANCELLED"] }, 1, 0] }
        },
        returnedCount: {
          $sum: { $cond: [{ $eq: ["$orderStatus", "RETURNED"] }, 1, 0] }
        }
      }
    },

    {
      $addFields: {
        netRevenue: { $subtract: ["$grossRevenue", "$totalRefund"] },
        averageOrderValue: {
          $cond: [
            { $eq: ["$totalOrders", 0] },
            0,
            { $divide: ["$grossRevenue", "$totalOrders"] }
          ]
        }
      }
    }
  ]);

  return stats[0] || {};
};



export const getRevenueChartService = async ({ startDate, endDate }) => {
    return await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          "payment.status": { $in: ["PAID", "REFUNDED"] }
        }
      },
  
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
          },
          revenue: { $sum: "$pricing.totalAmount" },
          refund: { $sum: { $ifNull: ["$payment.refundedAmount", 0] } }
        }
      },
  
      {
        $addFields: {
          netRevenue: { $subtract: ["$revenue", "$refund"] }
        }
      },
  
      { $sort: { _id: 1 } }
    ]);
  };


export const getPaymentMethodStatsService = async ({ startDate, endDate }) => {
    return await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          "payment.status": { $in: ["PAID", "REFUNDED"] }
        }
      },
  
      {
        $group: {
          _id: "$payment.method",
          count: { $sum: 1 },
          totalAmount: { $sum: "$pricing.totalAmount" }
        }
      }
    ]);
  };

export const getTopSellingProductsService = async ({ startDate, endDate }) => {
    return await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          "payment.status": "PAID"
        }
      },
  
      { $unwind: "$items" },
  
      {
        $group: {
          _id: {
            productId: "$items.product",
            productName: "$items.productName",
            color: "$items.color",
            size: "$items.size"
          },
          totalQuantitySold: { $sum: "$items.quantity" },
          totalRevenue: {
            $sum: {
              $multiply: ["$items.quantity", "$items.price"]
            }
          }
        }
      },
  
      { $sort: { totalQuantitySold: -1 } },
      { $limit: 5 }
    ]);
  };



  export const getSalesReportService = async ({
    startDate,
    endDate,
    page = 1,
    limit = 10,
    exportAll = false
  }) => {
    const matchStage = {
      createdAt: { $gte: startDate, $lte: endDate },
      "payment.status": { $in: ["PAID", "REFUNDED"] }
    };
  
    const skip = (page - 1) * limit;
  
    const pipeline = [
      { $match: matchStage },
  
      {
        $addFields: {
          totalAmount: { $ifNull: ["$pricing.totalAmount", 0] },
          refundAmount: { $ifNull: ["$payment.refundedAmount", 0] },
          couponDiscount: { $ifNull: ["$appliedCoupon.discountAmount", 0] }
        }
      },
      {
        $addFields: {
          netAmount: { $subtract: ["$totalAmount", "$refundAmount"] }
        }
      },
      {
        $project: {
          orderId: 1,
          totalAmount: 1,
          refundAmount: 1,
          netAmount: 1,
          couponDiscount: 1,
          "payment.method": 1,
          "payment.status": 1,
          orderStatus: 1,
          createdAt: 1
        }
      },
      { $sort: { createdAt: -1 } }
    ];
  
    if (!exportAll) {
      pipeline.push({ $skip: skip }, { $limit: limit });
    }
  
    const orders = await Order.aggregate(pipeline);
  
    const totalCount = await Order.countDocuments(matchStage);
  
    const summary = await Order.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          grossRevenue: { $sum: "$pricing.totalAmount" },
          totalRefund: { $sum: "$payment.refundedAmount" }
        }
      },
      {
        $addFields: {
          netRevenue: { $subtract: ["$grossRevenue", "$totalRefund"] }
        }
      }
    ]);
  
    return {
      orders,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
      currentPage: page,
      summary: summary[0] || {}
    };
  };