const mongoose = require('mongoose');

const SmsWalletSchema = new mongoose.Schema({
  schoolId: { type: mongoose.Schema.Types.Mixed, required: true, index: true }, // Can be ObjectId or String
  balance: { type: Number, default: 0 },
  currency: { type: String, default: 'KES' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

SmsWalletSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('SmsWallet', SmsWalletSchema);
