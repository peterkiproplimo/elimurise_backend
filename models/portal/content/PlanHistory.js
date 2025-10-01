const mongoose = require('mongoose');
const PlanHistorySchema = new mongoose.Schema({
  subscription_id: {type: mongoose.Schema.Types.ObjectId, ref: 'Subscription', required: true},
  plan_id: {type: mongoose.Schema.Types.ObjectId, ref: 'Plan', required: true},
  date_start: {type: Date, required: true},
  date_end: {type: Date},
  insert_ts: {type: Date, default: Date.now},
});

module.exports = mongoose.model('PlanHistory', PlanHistorySchema);
