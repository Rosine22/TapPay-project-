const AppError = require('../utils/AppError');
const walletModel = require('../models/walletModel');
const transactionModel = require('../models/transactionModel');

// The wallet balance is only ever read from the database for the signed-in user.
async function getWallet(req, res) {
  const wallet = await walletModel.findByUserId(req.user.id);
  if (!wallet) throw new AppError('Wallet not found', 404);

  res.json({
    success: true,
    wallet: {
      id: wallet.id,
      balance: Number(wallet.balance),
      currency: wallet.currency,
      createdAt: wallet.created_at,
    },
  });
}

// Small summary used by the merchant dashboard.
async function getMerchantSummary(req, res) {
  const wallet = await walletModel.findByUserId(req.user.id);
  const todaysSales = await transactionModel.todaysTotalReceived(req.user.id);
  res.json({
    success: true,
    summary: {
      balance: Number(wallet.balance),
      currency: wallet.currency,
      todaysSales,
    },
  });
}

module.exports = { getWallet, getMerchantSummary };
