const mongoose = require('mongoose');

// Define the User schema
const PortalUserSchema = new mongoose.Schema(
  {
    firstname: {
      type: String,
      required: true,
    },
    lastname: {
      type: String,
      // required: true,
    },
    phone: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    avater: {
      type: String,
    },
    role: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PortalRole',
      required: false,
    },
    workflow_state: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'WorkflowState',
    },
    status: {
      type: Number,
      required: true,
      default: 0,
    },
    password: {
      type: String,
      required: true,
    },
    verified: {
      type: Boolean,
    },
    otp: {
      type: String,
      default: undefined,
    },
    otp_expires_in: {
      type: Date,
    },
    school: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'School',
    },
    teacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Teacher',
    },
    school_admin: {
      type: Boolean,
      default: false,
    },
    agreedToTerms: {
      type: Boolean,
      required: true,
      default: false,
    },
    termsVersion: {
      type: String,
      default: 'v1.0',
    },
    termsAgreedAt: {
      type: Date,
    },
    termsIP: {
      type: String,
    },
    termsUserAgent: {
      type: String,
    },
  },

  {
    timestamps: true,
  },
);

// Create the User model
const user = mongoose.model('PortalUser', PortalUserSchema);

module.exports = user;
