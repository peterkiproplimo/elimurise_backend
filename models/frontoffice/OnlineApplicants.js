// models/OnlineApplicants.js
const mongoose = require('mongoose');

const onlineApplicantSchema = new mongoose.Schema({
  // ===== Student Details =====
  first_name: { type: String, required: false },
  middle_name: { type: String },
  last_name: { type: String, required: false },
  gender: { type: String, required: false },
  dateOfBirth: { type: Date, required: false },
  nationality: { type: String, required: false },
  countySubCounty: { type: String },
  birthCertificateNo: { type: String },

  // ===== Parent/Guardian Details =====
  guardian_relationship: { type: String, required: false },
  guardian_first_name: { type: String, required: false },
  guardian_surname: { type: String },
  guardian_last_name: { type: String, required: false },
  guardian_email: { type: String, required: false, lowercase: true },
  guardian_phone: { type: String, required: false },
  postalAddress: { type: String },
  idNumber: { type: String },

  // ===== Academic Information =====
  currentOrLastSchool: { type: String, required: false },
  currentClass: { type: String },
  classApplyingFor: { type: String, required: false },
  kcpeIndexNumber: { type: String },
  kcpeMarks: { type: String },

  // ===== Address/Contact Details =====
  homeAddress: { type: String, required: false },
  nearestLandmark: { type: String, required: false },
  distanceFromSchool: { type: String },

  // ===== Payment Information =====
  payment: {
    method: { type: String, required: false, enum: ['M-Pesa', 'Bank Transfer'] },
    amount: { type: Number, required: false, default: 1000 },
    transactionCode: { type: String, required: false },
    paymentDate: { type: Date, required: false },
    status: { type: String, enum: ['Pending', 'Verified', 'Failed'], default: 'Pending' }
  },

  // // ===== Documents =====
  documents: {
    birthCertificate: {
      filename: { type: String },
      originalName: { type: String },
      mimetype: { type: String },
      size: { type: Number },
      uploadDate: { type: Date }
    },
    passportPhoto: {
      filename: { type: String },
      originalName: { type: String },
      mimetype: { type: String },
      size: { type: Number },
      uploadDate: { type: Date }
    },
    academicReport: {
      filename: { type: String },
      originalName: { type: String },
      mimetype: { type: String },
      size: { type: Number },
      uploadDate: { type: Date }
    },
    transferLetter: {
      filename: { type: String },
      originalName: { type: String },
      mimetype: { type: String },
      size: { type: Number },
      uploadDate: { type: Date }
    },
    parentId: {
      filename: { type: String },
      originalName: { type: String },
      mimetype: { type: String },
      size: { type: Number },
      uploadDate: { type: Date }
    },
    medicalReport: {
      filename: { type: String },
      originalName: { type: String },
      mimetype: { type: String },
      size: { type: Number },
      uploadDate: { type: Date }
    }
  },

  // ===== Assessment fields (optional) =====
  grade: { type: String },
  term: { type: String },
  test: { type: String },
  learning_area: { type: String },

  // ===== Application Status =====
  applicationStatus: { 
    type: String, 
    enum: ['Pending', 'Shortlisted', 'Confirmed', 'Rejected'], 
    default: 'Pending' 
  },

  // ===== Cohort Information =====
  cohortId: {
    type: String,
    required: false,
    index: true
  },
  
  // ===== Metadata =====
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  
  // ===== Admin fields =====
  reviewedBy: { type: mongoose.Schema.Types.Mixed }, // Can be ObjectId or String
  reviewedAt: { type: Date },
  adminNotes: { type: String },
  rejectionReason: { type: String },
  
  // ===== Status History Tracking =====
  statusHistory: [{
    status: { type: String, enum: ['Pending', 'Shortlisted', 'Confirmed', 'Rejected'] },
    changedBy: { type: String },
    changedAt: { type: Date, default: Date.now },
    notes: { type: String }
  }],
  
  // ===== SMS Notification tracking =====
  smsSentToParent: { type: Boolean, default: false },
  smsSentAt: { type: Date },
  
}, {
  timestamps: true // This will automatically manage createdAt and updatedAt
});

module.exports = mongoose.model("OnlineApplicants", onlineApplicantSchema);
