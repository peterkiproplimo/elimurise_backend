const mongoose = require('mongoose');

const SubscriptionSchema = new mongoose.Schema(
  {
    school: {type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true},
    trial_period_start_date: {type: Date},
    trial_period_end_date: {type: Date},
    subscribe_after_trial: {type: Boolean, default: false},
    current_plan_id: {type: mongoose.Schema.Types.ObjectId, ref: 'Plan', required: true},
    date_subscribed: {type: Date, required: true},
    valid_to: {type: Date},
    date_unsubscribed: {type: Date},
    //   insert_ts: {type: Date, default: Date.now},
  },
  {timestamps: true},
);

module.exports = mongoose.model('Subscription', SubscriptionSchema);
