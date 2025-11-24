const mongoose = require('mongoose');

const certificateSchema = new mongoose.Schema({
  // Student Information
  studentId: { 
    type: String, 
    required: true 
  },
  studentName: { 
    type: String, 
    required: true 
  },
  studentAdmNo: { 
    type: String, 
    required: true 
  },

  // Certificate Details
  certificateName: { 
    type: String, 
    required: true 
  },
  certificateType: { 
    type: String, 
    required: true,
    enum: ['Academic', 'Training', 'Sports', 'Leadership', 'Community Service', 'Other']
  },
  type: { 
    type: String,
    enum: ['Academic', 'Completion', 'Achievement', 'Participation', 'Merit']
  },
  certificateCategories: {
    type: String,
    enum: ['Upload scanned certificates', 'Awards', 'Recognitions', 'Academic', 'Training', 'Sports', 'Leadership', 'Community Service', 'Other'],
    default: 'Academic'
  },
  description: { 
    type: String 
  },
  issueDate: { 
    type: Date, 
    required: true 
  },
  expiryDate: { 
    type: Date 
  },

  // File Upload Details
  certificateFile: {
    filename: { type: String },
    originalName: { type: String },
    mimetype: { type: String },
    size: { type: Number },
    uploadDate: { type: Date, default: Date.now }
  },

  // Issuing Authority
  issuedBy: { 
    type: String, 
    required: true 
  },
  issuerTitle: { 
    type: String 
  },
  issuerSignature: { 
    type: String 
  },

  // Academic Details
  academicYear: { 
    type: String 
  },
  term: { 
    type: String 
  },
  grade: { 
    type: String 
  },

  // Status and Verification
  status: { 
    type: String, 
    enum: ['Active', 'Expired', 'Revoked'], 
    default: 'Active' 
  },
  isVerified: { 
    type: Boolean, 
    default: false 
  },
  verifiedBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  },
  verifiedAt: { 
    type: Date 
  },

  // Metadata
  createdBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User'
  },
  updatedBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  },

}, {
  timestamps: true
});

// Index for better query performance
certificateSchema.index({ studentId: 1, certificateType: 1 });
certificateSchema.index({ issueDate: -1 });
certificateSchema.index({ status: 1 });

module.exports = mongoose.model("Certificate", certificateSchema);
