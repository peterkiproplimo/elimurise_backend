const mongoose = require('mongoose');

const playerSchema = new mongoose.Schema({
  first_name: {
    type: String,
    required: true
  },
  last_name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  phone: {
    type: String,
    required: true
  },
  dateOfBirth: {
    type: Date
  },
  gender: {
    type: String,
    enum: ['Male', 'Female', 'Other']
  },
  role: {
    type: String,
    enum: ['student', 'parent', 'staff', 'admin'],
    default: 'student'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  profilePicture: {
    type: String
  },
  address: {
    street: String,
    city: String,
    county: String,
    postalCode: String
  },
  emergencyContact: {
    name: String,
    phone: String,
    relationship: String
  },
  academicInfo: {
    studentId: String,
    grade: String,
    stream: String,
    admissionDate: Date
  }
}, {
  timestamps: true
});

// Index for better query performance
playerSchema.index({ email: 1 });
playerSchema.index({ phone: 1 });
playerSchema.index({ role: 1 });
playerSchema.index({ isActive: 1 });

module.exports = mongoose.model("Player", playerSchema);
