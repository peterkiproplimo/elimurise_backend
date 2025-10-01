const mongoose = require('mongoose');

const timeSlotSchema = new mongoose.Schema(
  {
    school: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'School',
      required: true,
    },
    name: {
      type: String, // Predefined slot names like "Break", "Lunch"

      trim: true,
    },
    level: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Level', // Reference to Level model
      required: true,
    },
    startTime: {
      type: String, // e.g., "10:00" for Break
      required: true,
      match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Please provide a valid time in HH:MM format'],
    },
    endTime: {
      type: String, // e.g., "10:15" for Break
      required: true,
      match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Please provide a valid time in HH:MM format'],
    },
    slotNumber: {
      type: Number, // e.g., 3 for Break slot in sequence
      required: true,
    },
    duration: {
      type: Number, // Duration in minutes, calculated automatically
    },
    isFixed: {
      type: Boolean, // Indicates if the slot is fixed (e.g., Break, Lunch)
      default: false,
    },
  },
  {timestamps: true},
);

// Ensure unique time slots per school and slot number
timeSlotSchema.index({school: 1, level: 1, slotNumber: 1}, {unique: true});

// Pre-save hook to calculate duration and validate times
timeSlotSchema.pre('save', async function (next) {
  const [startHours, startMinutes] = this.startTime.split(':').map(Number);
  const [endHours, endMinutes] = this.endTime.split(':').map(Number);

  const startInMinutes = startHours * 60 + startMinutes;
  const endInMinutes = endHours * 60 + endMinutes;

  if (endInMinutes <= startInMinutes) {
    return next(new Error('End time must be after start time'));
  }

  this.duration = endInMinutes - startInMinutes;
  next();
});

module.exports = mongoose.model('TimeSlot', timeSlotSchema);
