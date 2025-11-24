const mongoose = require('mongoose');

const competencySchema = new mongoose.Schema({
  // Basic competency information
  name: {
    type: String,
    required: true,
    trim: true
  },
  code: {
    type: String,
    required: true,
    trim: true,
    unique: true,
    uppercase: true
  },
  description: {
    type: String,
    required: false
  },
  
  // Competency categorization
  category: {
    type: String,
    required: true,
    enum: ['knowledge', 'skill', 'attitude', 'behavior', 'technical', 'soft']
  },
  
  // Competency level
  level: {
    type: String,
    required: true,
    enum: ['beginner', 'intermediate', 'advanced', 'expert']
  },
  
  // Domain information
  domain: {
    type: String,
    required: true,
    enum: ['cognitive', 'psychomotor', 'affective', 'social', 'professional']
  },
  
  // Subject association
  subject: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subject',
    required: false // Some competencies might be general
  },
  
  // Learning outcomes
  learningOutcomes: [{
    outcome: String,
    description: String,
    level: {
      type: String,
      enum: ['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create']
    }
  }],
  
  // Assessment criteria
  assessmentCriteria: [{
    criterion: String,
    description: String,
    weight: {
      type: Number,
      min: 0,
      max: 100
    }
  }],
  
  // Status and metadata
  isActive: {
    type: Boolean,
    default: true
  },
  status: {
    type: String,
    enum: ['draft', 'active', 'inactive', 'archived'],
    default: 'draft'
  },
  
  // Prerequisites
  prerequisites: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Competency'
  }],
  
  // Additional metadata
  tags: [String],
  keywords: [String],
  
  // Created by information
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Statistics
  totalAssessments: {
    type: Number,
    default: 0
  },
  averageScore: {
    type: Number,
    default: 0
  },
  
  // Competency framework information
  framework: {
    type: String,
    required: false
  },
  version: {
    type: String,
    default: '1.0'
  }
}, {
  timestamps: true
});

// Indexes for better query performance
competencySchema.index({ name: 1 });
competencySchema.index({ code: 1 });
competencySchema.index({ category: 1 });
competencySchema.index({ level: 1 });
competencySchema.index({ domain: 1 });
competencySchema.index({ subject: 1 });
competencySchema.index({ isActive: 1 });
competencySchema.index({ createdBy: 1 });

// Virtual for full competency display name
competencySchema.virtual('displayName').get(function() {
  return `${this.code} - ${this.name}`;
});

// Pre-save middleware to ensure code is uppercase
competencySchema.pre('save', function(next) {
  if (this.code) {
    this.code = this.code.toUpperCase();
  }
  next();
});

module.exports = mongoose.model("Competency", competencySchema);
