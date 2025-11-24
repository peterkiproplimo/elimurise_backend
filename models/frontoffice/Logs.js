const mongoose = require('mongoose');

const logsSchema = new mongoose.Schema({
  ip: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  action: {
    type: String,
    enum: ['login', 'logout', 'deposit', 'withdrawal', 'payment', 'registration', 'update', 'delete'],
    required: true
  },
  userAgent: {
    type: String
  },
  status: {
    type: String,
    enum: ['success', 'failed', 'pending'],
    default: 'success'
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed
  }
}, {
  timestamps: true
});

// Index for better query performance
logsSchema.index({ user: 1 });
logsSchema.index({ action: 1 });
logsSchema.index({ createdAt: -1 });
logsSchema.index({ ip: 1 });

module.exports = mongoose.model("Logs", logsSchema);
