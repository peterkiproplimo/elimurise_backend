const mongoose = require('mongoose');
const crypto = require('crypto');

const transferRequestSchema = new mongoose.Schema(
  {
    learner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Learner',
      required: true,
    },
    oldSchool: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'School',
      required: true,
    },
    newSchool: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'School',
      required: true,
    },
    reason: {
      type: String,
      required: true,
    },

    // documents: [
    //   {
    //     type: String, // URL or path to the document
    //   },
    // ],
    transferCode: {
      type: String,
      unique: true,
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: ['Pending', 'Paid'],
      default: 'Pending',
    },
    approvalStatus: {
      type: String,
      enum: ['Pending', 'Approved', 'Rejected'],
      default: 'Pending',
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User', // Assuming there is a User model for admin/staff
    },
    approvalDate: {
      type: Date,
    },
    order_tracking_id: {type: String},
    payment: {type: mongoose.Schema.Types.ObjectId, default: undefined, ref: 'Payments'}, // Payment reference
    remarks: {type: String}, // Payment reference
  },
  {timestamps: true},
);

const TransferRequest = mongoose.model('TransferRequest', transferRequestSchema);
module.exports = TransferRequest;
