const mongoose = require('mongoose');

const SmsMessageSchema = new mongoose.Schema({
  schoolId: { type: mongoose.Schema.Types.Mixed, required: false, index: true }, // Can be ObjectId or String
  subject: { type: String },
  body: { type: String, required: true },
  senderId: { type: String },
  providerMessageId: { type: String },
  status: { type: String, enum: ['pending','sent','failed'], default: 'pending' },
  scheduledAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('SmsMessage', SmsMessageSchema);
