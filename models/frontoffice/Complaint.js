// models/Complaint.js
const mongoose = require('mongoose');

const ReplySchema = new mongoose.Schema({

  message: { type: String, required: true },
  sender: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },

});

const reportSchema = new mongoose.Schema(
  {
    subject: {
      type: String,
      required: true,
      trim: true,
    },
    
    description: {
      type: String,
      required: true,
    },

    category: {
      type: String,
      enum: ["Academic", "Administrative", "Facilities","Service","Behavioral", "Technical", "Other"],
      default: "Other",
    },

    priority: {
      type: String,
      enum: ["Low", "Medium", "High", "Critical"],
      default: "Medium",
    },

    reporterName: {
      type: String,
      required: true,
      trim: true,
    },

    assignedTo: {
      type: String,
      required: false,
      trim: true,
    },

    reporterContact: {
      type: String,
      required: false,
      trim: true,
    },

    reporterType: {
      type: String,
      enum: ["teacher", "student"],
      required: true,
    },

    reporterId: {
      type: String,
      required: false,
      trim: true,
    },

    status: { type: String, enum: ['Open', 'In Progress', 'Resolved', 'Closed'], default: 'Open' },

    replies: [ReplySchema], // 👈 add this line


  },
  { timestamps: true }
);

module.exports = mongoose.model("Complaint", reportSchema);
