const mongoose = require('mongoose');

const SmsTransactionSchema = new mongoose.Schema({
  walletId: { type: mongoose.Schema.Types.ObjectId, ref: 'SmsWallet', required: true, index: true },
  type: { type: String, enum: ['credit','debit'], required: true },
  amount: { type: Number, required: true },
  reference: { type: String },
  metadata: { type: Object },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('SmsTransaction', SmsTransactionSchema);
