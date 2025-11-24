const mongoose = require('mongoose');

const accountSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  balance: {
    type: Number,
    default: 0,
    required: true
  },
  active: {
    type: Boolean,
    default: true
  },
  accountType: {
    type: String,
    enum: ['student', 'parent', 'staff', 'admin'],
    default: 'student'
  },
  lastTransaction: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for better query performance
accountSchema.index({ user: 1 });
accountSchema.index({ active: 1 });

module.exports = mongoose.model("Account", accountSchema);
