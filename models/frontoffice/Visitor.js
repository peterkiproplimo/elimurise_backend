const mongoose = require('mongoose');

const visitorSchema = new mongoose.Schema({
  fullName: { type: String, required: false },
  idNumber: { type: String, required: false }, // e.g., National ID or Passport
  phoneNumber: { type: String, required: false },
  email: { type: String },
  company: { type: String },
  purpose: { type: String, required: false },
  hostName: { type: String, required: false },
  visitDate: { type: Date, default: Date.now },
  checkInTime: { type: Date },
  checkOutTime: { type: Date },
  status: { type: String, enum: ['Checked In', 'Checked Out'], default: 'Checked In' },
  passId: { type: String, unique: false }, // Unique QR code or barcode
  
  // Duration monitoring fields
  expectedDuration: { type: Number, default: 60 }, // Expected duration in minutes
  actualDuration: { type: Number }, // Actual duration in minutes (calculated)
  isOverstayed: { type: Boolean, default: false }, // Flag for overstayed visitors
  overstayMinutes: { type: Number, default: 0 }, // Minutes over expected duration
  alertsTriggered: { type: Boolean, default: false },
  alertHistory: [{
    alertType: { type: String, enum: ['Duration Warning', 'Overstay Alert', 'Extended Stay'] },
    triggeredAt: { type: Date, default: Date.now },
    message: { type: String },
    acknowledged: { type: Boolean, default: false },
    acknowledgedBy: { type: String },
    acknowledgedAt: { type: Date }
  }],
  
  // Additional tracking
  lastActivityTime: { type: Date }, // Last known activity (for active monitoring)
  location: { type: String }, // Current location on premises
  notes: { type: String } // Additional notes about the visit
}, { timestamps: true });


module.exports = mongoose.model("Visitor", visitorSchema);
