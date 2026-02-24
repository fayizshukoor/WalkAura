import asyncHandler from "../../utils/asyncHandler.util.js";
import {
  getDashboardStatsService,
  getRevenueChartService,
  getPaymentMethodStatsService,
  getTopSellingProductsService,
} from "../../services/dashboard.service.js";





const parseDates = (range, from, to) => {
    let startDate;
    let endDate = new Date();
  
    switch (range) {
      case "today":
        startDate = new Date();
        startDate.setHours(0, 0, 0, 0);
  
        endDate.setHours(23, 59, 59, 999);
        break;
  
      case "lastWeek":
        startDate = new Date();
        startDate.setDate(endDate.getDate() - 7);
        break;
  
      case "lastMonth":
        startDate = new Date();
        startDate.setMonth(endDate.getMonth() - 1);
        break;
  
      case "lastYear":
        startDate = new Date();
        startDate.setFullYear(endDate.getFullYear() - 1);
        break;
  
      default:
        if (from && to) {
          startDate = new Date(from);
          endDate = new Date(to);
          endDate.setHours(23, 59, 59, 999);
        } else {
          // Default fallback = last 7 days
          startDate = new Date();
          startDate.setDate(endDate.getDate() - 7);
        }
    }
  
    return { startDate, endDate };
  };

export const getAdminDashboard = asyncHandler(async (req, res) => {
  const { range, from, to } = req.query;

  const { startDate, endDate } = parseDates(range, from, to);

  const [stats, revenueChart, paymentStats, topProducts] =
    await Promise.all([
      getDashboardStatsService({ startDate, endDate }),
      getRevenueChartService({ startDate, endDate }),
      getPaymentMethodStatsService({ startDate, endDate }),
      getTopSellingProductsService({ startDate, endDate })
    ]);


  res.status(200).render("admin/dashboard",{
    layout: "layouts/admin",
    data: {
      stats,
      revenueChart,
      paymentStats,
      topProducts,
      range: range || "lastWeek"
    },
    filters: {
        from: from || "",
        to: to || ""
      }
  });
});


