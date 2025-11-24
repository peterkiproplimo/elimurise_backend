const mongoose = require('mongoose');

const phoneCallSchema = new mongoose.Schema({
  // Caller information
  callerName: { type: String, required: true },
  callerPhone: { type: String, required: true },
  callerEmail: { type: String },
  
  // Call details
  callType: { 
    type: String, 
    enum: ['Incoming', 'Outgoing', 'Missed'], 
    required: true 
  },
  callDate: { type: Date, default: Date.now },
  callTime: { type: String }, // Time of day (e.g., "9:45 AM")
  duration: { type: Number }, // Duration in minutes (for completed calls)
  
  // Call purpose and notes
  purpose: { type: String, required: true },
  notes: { type: String },
  
  // Follow-up information
  followUpRequired: { type: Boolean, default: false },
  followUpDate: { type: Date },
  followUpNotes: { type: String },
  followUpCompleted: { type: Boolean, default: false },
  
  // Status tracking
  status: { 
    type: String, 
    enum: ['Active', 'Completed', 'Follow-up Required', 'Resolved'], 
    default: 'Active' 
  },
  
  // Related to school/student (if applicable)
  relatedTo: {
    type: { type: String, enum: ['Student', 'Parent', 'Teacher', 'General', 'Other'] },
    referenceId: { type: String }, // ID of student, parent, etc.
    referenceName: { type: String } // Name for quick reference
  },
  
  // Secretary/Staff information
  handledBy: { 
    type: String, 
    required: true 
  }, // Name of secretary who handled the call
  
  // Priority and urgency
  priority: { 
    type: String, 
    enum: ['Low', 'Medium', 'High', 'Urgent'], 
    default: 'Medium' 
  },
  
  // Additional metadata
  tags: [{ type: String }], // For categorization
  attachments: [{
    fileName: { type: String },
    fileUrl: { type: String },
    fileType: { type: String },
    uploadedAt: { type: Date, default: Date.now }
  }]
}, { 
  timestamps: true 
});

// Indexes for better query performance
phoneCallSchema.index({ callerPhone: 1 });
phoneCallSchema.index({ callType: 1 });
phoneCallSchema.index({ callDate: -1 });
phoneCallSchema.index({ status: 1 });
phoneCallSchema.index({ followUpRequired: 1 });
phoneCallSchema.index({ handledBy: 1 });

module.exports = mongoose.model("PhoneCall", phoneCallSchema);
