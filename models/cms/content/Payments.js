const mongoose = require('mongoose');

const PaymentSchema = new mongoose.Schema(
  {
    payment_method: {
      type: String,
      enum: ['MPESA', 'PayPal', 'CreditCard', 'BankTransfer', 'Manual'], // Added 'Manual'
    },
    amount: {type: Number, required: true}, // Ensure amount is required for all payments
    created_date: {type: Date, default: Date.now}, // Default to the current date
    confirmation_code: {
      type: String,
      required: function () {
        return this.payment_method !== 'Manual'; // Required for non-manual payments
      },
    },
    order_tracking_id: {type: String, unique: true},
    payment_status_description: {type: String},
    description: {type: String, default: null},
    message: {type: String},
    payment_account: {type: String},
    call_back_url: {type: String},
    status_code: {type: Number},
    merchant_reference: {type: String},
    payment_status_code: {type: String, default: ''},
    currency: {type: String, required: true}, // Ensure currency is specified
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed'],
      default: 'pending',
    },

    // Manual Payment Details (specific to manual payments)
    manual_payment_details: {
      type: Object,
      default: null,
      validate: {
        validator: function (details) {
          if (this.payment_method === 'Manual') {
            return details && details.payerName && details.receiptNumber; // Ensure required manual fields
          }
          return true;
        },
        message: 'Manual payment details must include payerName and receiptNumber.',
      },
      required: function () {
        return this.payment_method === 'Manual'; // Required if payment method is manual
      },
    },
  },
  {timestamps: true},
);

const Payments = mongoose.model('Payments', PaymentSchema);
module.exports = Payments;
