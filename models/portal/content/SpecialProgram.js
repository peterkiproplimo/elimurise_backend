// models/SpecialProgram.js
const mongoose = require('mongoose');

const specialProgramSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      //   enum: ['Free', 'Break', 'Lunch', 'PE', 'PPI'], // Default special programs
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    allowedTimeSlots: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'TimeSlot',
      },
    ], // Time slots where this program can be scheduled
    allowedDays: {
      type: [String],
      enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      default: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    }, // Days when this program can be scheduled
    durationMinutes: {
      type: Number,
      min: 1,
      required: true,
    }, // Expected duration
    isMandatory: {
      type: Boolean,
      default: false,
    }, // Whether this program must be scheduled
    maxPerDay: {
      type: Number,
      min: 0,
      default: 1,
    }, // Max occurrences per day
    school: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'School',
      required: true,
      index: true, // For efficient queries
    }, // School this program belongs to
    session: {
      type: String,
      required: true,
      trim: true,
      index: true, // For efficient queries
    }, // Academic session (e.g., "2024/2025")
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  },
);

// Ensure uniqueness of name within a school and session
specialProgramSchema.index({name: 1, school: 1, session: 1}, {unique: true});

module.exports = mongoose.model('SpecialProgram', specialProgramSchema);
