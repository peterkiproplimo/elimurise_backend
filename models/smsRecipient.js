const mongoose = require('mongoose');

const SmsRecipientSchema = new mongoose.Schema({
  messageId: { type: mongoose.Schema.Types.ObjectId, ref: 'SmsMessage', required: true, index: true },
  phone: { type: String, required: true },
  status: { type: String, enum: ['pending','delivered','failed'], default: 'pending' },
  providerMessageId: { type: String },
  providerError: { type: String },
  cost: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

SmsRecipientSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('SmsRecipient', SmsRecipientSchema);
