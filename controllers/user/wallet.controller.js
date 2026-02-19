import asyncHandler from "../../utils/asyncHandler.util.js";
import { getWalletSummary, getWalletTransactions } from "../../services/wallet.service.js";

export const getWalletPage = asyncHandler(async (req, res) => {
  const userId = req?.user?.userId;

  const page = parseInt(req.query.page) || 1;
  const limit = 5;

  const wallet = await getWalletSummary(userId);

  const {
    transactions,
    total,
    currentPage,
    totalPages
  } = await getWalletTransactions(wallet._id, page, limit);

  res.render("user/wallet", {
    wallet,
    transactions,
    pagination: {
      total,
      currentPage,
      totalPages
    }
  });
});
