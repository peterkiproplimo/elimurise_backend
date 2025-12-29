const mongoose = require('mongoose');

const SmsTemplateSchema = new mongoose.Schema({
  schoolId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  name: { type: String, required: true },
  body: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('SmsTemplate', SmsTemplateSchema);
