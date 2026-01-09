const mongoose = require('mongoose');

const SmsPurchaseSchema = new mongoose.Schema({
  schoolId: { type: mongoose.Schema.Types.Mixed, required: true, index: true }, // Can be ObjectId or String
  tokens: { type: Number, required: true }, // Number of SMS tokens purchased
  amount: { type: Number, required: true }, // Amount paid in KSH (1.2 KSH per token)
  unitPrice: { type: Number, default: 1.2 }, // Price per token
  mpesaTransactionId: { type: String }, // MPESA transaction reference
  checkoutRequestID: { type: String, index: true }, // MPESA checkout request ID
  status: { 
    type: String, 
    enum: ['pending', 'completed', 'failed'], 
    default: 'pending' 
  },
  errorMessage: { type: String }, // Error message if transaction failed
  transactionDate: { type: String }, // Transaction date from M-Pesa
  phone: { type: String }, // Phone number used for payment
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

SmsPurchaseSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('SmsPurchase', SmsPurchaseSchema);

