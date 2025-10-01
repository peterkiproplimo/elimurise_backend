const mongoose = require('mongoose');

const AccessLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PortalUser',
      // required: true, // Commented out, optional
    },
    email: {
      type: String,
      required: true,
    },
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'School',
    },
    roleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Role',
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    ipAddress: {
      type: String,
      required: true,
    },
    method: {
      type: String,
      required: true,
    },
    endpoint: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['success', 'failed'],
      default: 'success',
    },
    description: {
      type: String,
      required: false,
      default: '',
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt automatically
  },
);

// Indexes for performance
// 1. Index on roleId for $lookup
AccessLogSchema.index({roleId: 1});

// 2. Index on timestamp for filtering (e.g., recent logs)
AccessLogSchema.index({timestamp: -1});

// 3. Compound index for common queries (e.g., roleId + timestamp)
AccessLogSchema.index({roleId: 1, timestamp: -1});

// Optional: Index on email for user-specific queries
AccessLogSchema.index({email: 1});

// Optional: Index on schoolId if filtering by school
AccessLogSchema.index({schoolId: 1});

const AccessLog = mongoose.model('AccessLog', AccessLogSchema);

module.exports = AccessLog;
