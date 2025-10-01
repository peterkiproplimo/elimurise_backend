const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  school: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School', // Assuming 'School' model exists and is linked to the school
    required: true,
  },
  learner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Learner',
    required: true,
  },
  stream: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Stream',
  },
  //   grade: {
  //     type: mongoose.Schema.Types.ObjectId,
  //     required: 'grades',
  //   },
  date: {type: Date, required: true},
  morning: {type: Boolean, default: false},
  morning_reason: {type: String},
  afternoon: {type: Boolean, default: false},
  afternoon_reason: {type: String},
  status: {
    type: String,
    enum: ['Full Day', 'Half Day (Morning)', 'Half Day (Afternoon)', 'Absent'],
  },
});

// Auto-set status before saving
attendanceSchema.pre('save', function (next) {
  if (this.morning && this.afternoon) {
    this.status = 'Full Day';
  } else if (this.morning) {
    this.status = 'Half Day (Morning)';
  } else if (this.afternoon) {
    this.status = 'Half Day (Afternoon)';
  } else {
    this.status = 'Absent';
  }
  next();
});

module.exports = mongoose.model('Attendance', attendanceSchema);
