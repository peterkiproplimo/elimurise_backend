const mongoose = require('mongoose');

const PaymentSchema = new mongoose.Schema(
  {
    name: {type: String, required: true}, // Unique payment identifier (e.g., "PAY-12345")
    posting_date: {type: Date, required: true}, // Date when the payment is posted
    party: {type: String, required: true}, // Customer or payee name
    party_type: {type: String, required: true}, // Customer or Supplier
    paid_amount: {type: mongoose.Schema.Types.Decimal128, required: true}, // Total amount paid
    payment_type: {type: String, enum: ['Receive', 'Pay'], required: true}, // Type of payment (Receive/Pay)
    reference_no: {type: String, required: true}, // Reference number for the payment
    reference_date: {type: Date, required: true}, // Date associated with the reference number
    status: {type: String, enum: ['Pending', 'Completed', 'Failed'], default: 'Pending'}, // Payment status
    invoices: [
      {
        invoice_id: {type: mongoose.Schema.Types.ObjectId, ref: 'Invoice', required: true}, // Reference to the Invoice model
        amount_applied: {type: mongoose.Schema.Types.Decimal128, required: true}, // Amount applied to the invoice
        outstanding_amount: {type: mongoose.Schema.Types.Decimal128, required: true}, // Remaining amount on the invoice after payment
      },
    ],
  },
  {timestamps: true},
);

module.exports = mongoose.model('Payment', PaymentSchema);
