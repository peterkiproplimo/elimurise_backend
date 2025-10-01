const mongoose = require('mongoose');

// Define the User schema
const userSchema = new mongoose.Schema(
  {
    firstname: {
      type: String,
      required: true,
    },
    lastname: {
      type: String,
      required: true,
    },
    phone: {
      type: String,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    avater: {
      type: String,
    },
    role_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Role',
      required: false,
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
    super_admin: {
      type: Boolean,
    },
    otp: {
      type: String,
      default: undefined,
    },
    otp_expires_in: {
      type: Date,
    },
  },
  {
    timestamps: true,
  },
);

// Create the User model
const user = mongoose.model('User', userSchema);

module.exports = user;
