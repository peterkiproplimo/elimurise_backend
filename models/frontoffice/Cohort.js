const mongoose = require('mongoose');

const cohortSchema = new mongoose.Schema({
  // Basic cohort information
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: false
  },
  
  // Date range for the cohort
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  
  // Application settings
  applicationFee: {
    type: Number,
    default: 1000
  },
  maxApplications: {
    type: Number,
    default: 100
  },
  
  // Status and metadata
  isActive: {
    type: Boolean,
    default: true
  },
  status: {
    type: String,
    enum: ['draft', 'active', 'closed', 'completed'],
    default: 'draft'
  },
  
  // Link generation
  token: {
    type: String,
    unique: true,
    required: true
  },
  applicationUrl: {
    type: String,
    required: false
  },
  
  // Tracking
  generatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Statistics
  totalApplications: {
    type: Number,
    default: 0
  },
  pendingApplications: {
    type: Number,
    default: 0
  },
  approvedApplications: {
    type: Number,
    default: 0
  },
  rejectedApplications: {
    type: Number,
    default: 0
  },
  
  // Additional settings
  settings: {
    allowLateApplications: {
      type: Boolean,
      default: false
    },
    requireDocuments: {
      type: Boolean,
      default: true
    },
    autoApprove: {
      type: Boolean,
      default: false
    }
  }
}, {
  timestamps: true
});

// Index for better query performance
cohortSchema.index({ token: 1 });
cohortSchema.index({ generatedBy: 1 });
cohortSchema.index({ startDate: 1, endDate: 1 });
cohortSchema.index({ status: 1 });
cohortSchema.index({ createdAt: -1 });

module.exports = mongoose.model("Cohort", cohortSchema);
