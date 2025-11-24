const mongoose = require('mongoose');

const subjectSchema = new mongoose.Schema({
  // Basic subject information
  name: {
    type: String,
    required: true,
    trim: true,
    unique: true
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
  
  // Subject categorization
  category: {
    type: String,
    required: true,
    enum: ['core', 'elective', 'optional', 'practical', 'theoretical']
  },
  
  // Academic level information
  level: {
    type: String,
    required: true,
    enum: ['primary', 'secondary', 'tertiary', 'certificate', 'diploma', 'degree']
  },
  
  // Credit information
  credits: {
    type: Number,
    required: true,
    min: 1,
    max: 10
  },
  
  // Duration and scheduling
  duration: {
    type: Number, // in weeks
    required: true,
    min: 1
  },
  hoursPerWeek: {
    type: Number,
    required: true,
    min: 1,
    max: 40
  },
  
  // Prerequisites
  prerequisites: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subject'
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
  
  // Assessment information
  assessmentType: {
    type: String,
    enum: ['exam', 'assignment', 'project', 'practical', 'mixed'],
    default: 'mixed'
  },
  passingGrade: {
    type: Number,
    default: 50,
    min: 0,
    max: 100
  },
  
  // Additional metadata
  tags: [String],
  department: {
    type: String,
    required: false
  },
  
  // Created by information
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  
  // Statistics
  totalEnrollments: {
    type: Number,
    default: 0
  },
  averageGrade: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Indexes for better query performance
subjectSchema.index({ name: 1 });
subjectSchema.index({ code: 1 });
subjectSchema.index({ category: 1 });
subjectSchema.index({ level: 1 });
subjectSchema.index({ isActive: 1 });
subjectSchema.index({ createdBy: 1 });

// Virtual for full subject display name
subjectSchema.virtual('displayName').get(function() {
  return `${this.code} - ${this.name}`;
});

// Pre-save middleware to ensure code is uppercase
subjectSchema.pre('save', function(next) {
  if (this.code) {
    this.code = this.code.toUpperCase();
  }
  next();
});

module.exports = mongoose.model("Subject", subjectSchema);
