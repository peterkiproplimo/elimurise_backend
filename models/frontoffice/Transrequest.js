const mongoose = require('mongoose');

const transrequestSchema = new mongoose.Schema({
  amount: {
    type: Number,
    required: true
  },
  phone: {
    type: String,
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'cancelled'],
    default: 'pending'
  },
  transactionType: {
    type: String,
    enum: ['deposit', 'withdrawal', 'payment'],
    required: true
  },
  description: {
    type: String,
    default: ''
  },
  processedAt: {
    type: Date
  },
  errorMessage: {
    type: String
  }
}, {
  timestamps: true
});

// Index for better query performance
transrequestSchema.index({ user: 1 });
transrequestSchema.index({ status: 1 });
transrequestSchema.index({ createdAt: -1 });

module.exports = mongoose.model("Transrequest", transrequestSchema);
