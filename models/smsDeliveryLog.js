const mongoose = require('mongoose');

const SmsDeliveryLogSchema = new mongoose.Schema({
  recipientId: { type: mongoose.Schema.Types.ObjectId, ref: 'SmsRecipient', required: true, index: true },
  providerMessageId: { type: String },
  status: { type: String },
  providerResponse: { type: Object },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('SmsDeliveryLog', SmsDeliveryLogSchema);
