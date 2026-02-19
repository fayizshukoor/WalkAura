import Wallet from "../models/Wallet.model.js";
import WalletTransaction from "../models/WalletTransaction.model.js";

export const getWalletSummary = async (userId) => {
  let wallet = await Wallet.findOne({ user: userId });

  // Create wallet automatically if not exists
  if (!wallet) {
    wallet = await Wallet.create({ user: userId });
  }

  return wallet;
};

export const getWalletTransactions = async (walletId, page = 1, limit = 10) => {
  const skip = (page - 1) * limit;

  const [transactions, total] = await Promise.all([
    WalletTransaction.find({ wallet: walletId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),

    WalletTransaction.countDocuments({ wallet: walletId })
  ]);

  return {
    transactions,
    total,
    currentPage: page,
    totalPages: Math.ceil(total / limit)
  };
};


export const creditToWallet = async ({
    userId,
    amount,
    source,
    orderId = null,
    referenceId = null,
    description = "",
    session = null
  }) => {
    let wallet = await Wallet.findOne({ user: userId }).session(session);
  
    if (!wallet) {
      const created = await Wallet.create([{ user: userId }], { session });
      wallet = created[0];
    }
  
    await Wallet.updateOne(
      { _id: wallet._id },
      {
        $inc: {
          balance: amount,
          totalCredited: amount
        }
      },
      { session }
    );
  
    await WalletTransaction.create(
      [{
        wallet: wallet._id,
        user: userId,
        type: "CREDIT",
        source,
        amount,
        order: orderId,
        description,
        referenceId
      }],
      { session }
    );
  };

  
  export const debitFromWallet = async ({
    userId,
    amount,
    source,
    orderId = null,
    referenceId = null,
    description = "",
    session = null
  }) => {
    const wallet = await Wallet.findOne({ user: userId }).session(session);
  
    if (!wallet) throw new Error("Wallet not found");
  
    if (wallet.balance < amount) {
      throw new Error("Insufficient wallet balance");
    }
  
    await Wallet.updateOne(
      {
        _id: wallet._id,
        balance: { $gte: amount }   // prevents race condition
      },
      {
        $inc: {
          balance: -amount,
          totalDebited: amount
        }
      },
      { session }
    );
  
    await WalletTransaction.create(
      [{
        wallet: wallet._id,
        user: userId,
        type: "DEBIT",
        source,
        amount,
        order: orderId,
        description,
        referenceId
      }],
      { session }
    );
  };
  