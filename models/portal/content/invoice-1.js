const mongoose = require('mongoose');

const InvoiceSchema = new mongoose.Schema(
  {
    billingId: {type: mongoose.Schema.Types.ObjectId, ref: 'BillingInfo', required: true},
    invoiceNumber: {type: String, unique: true}, // Unique invoice number
    amount: {type: Number, required: true}, // Total cost of the invoice
    dueDate: {type: Date, required: true}, // Payment due date
    status: {type: String, enum: ['pending', 'paid', 'overdue'], default: 'pending'},
    paymentDate: {type: Date}, // Date when payment was completed
    remarks: {type: String}, // Additional notes
  },
  {timestamps: true},
);

const Invoice = mongoose.model('Invoice', InvoiceSchema);
module.exports = Invoice;
