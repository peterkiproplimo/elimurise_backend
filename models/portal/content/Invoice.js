const mongoose = require('mongoose');

const InvoiceSchema = new mongoose.Schema({
  customer_invoice_data: {type: String},
  subscription_id: {type: mongoose.Schema.Types.ObjectId, ref: 'Subscription', required: true},
  plan_history_id: {type: mongoose.Schema.Types.ObjectId, ref: 'PlanHistory', required: true},
  invoice_period_start_date: {type: Date, required: true},
  invoice_period_end_date: {type: Date, required: true},
  invoice_description: {type: String},
  invoice_amount: {type: mongoose.Schema.Types.Decimal128, required: true},
  outstanding_amount: {type: mongoose.Schema.Types.Decimal128, required: true},
  invoice_created_ts: {type: Date, default: Date.now},
  invoice_due_ts: {type: Date, required: true},
  invoice_paid_ts: {type: Date},
  erpnext_invoice_id: {type: String},
});

module.exports = mongoose.model('Invoice', InvoiceSchema);
