const mongoose = require('mongoose');

const BillingInfoSchema = new mongoose.Schema(
  {
    school: {type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true},
    packageId: {type: mongoose.Schema.Types.ObjectId, ref: 'Package', required: true},
    startDate: {type: Date, default: Date.now},
    // order_tracking_id: {type: String, unique: true},
    endDate: {type: Date, required: true}, // Subscription end date (typically 1 year from start date)
    totalCost: {type: Number, required: true}, // Total cost for the subscription period
    numberOfLearners: {type: Number, required: true}, // Number of learners covered by the package
    status: {type: String, enum: ['active', 'inactive', 'expired', 'suspended'], default: 'inactive'}, // Subscription status
    // payment: {type: mongoose.Schema.Types.ObjectId, default: undefined, ref: 'Payments'}, // Payment reference
    remarks: {type: String}, // Payment reference
    type: {type: String, enum: ['pre-paid', 'post-paid']}, // Payment reference
  },
  {timestamps: true},
);

const BillingInfo = mongoose.model('BillingInfo', BillingInfoSchema);

module.exports = BillingInfo;
