const mongoose = require('mongoose');

const EventSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    trim: true,
  },
  startDate: {
    type: Date,
    required: true,
  },
  endDate: {
    type: Date,
    required: true,
  },
  startTime: {
    type: String, // e.g., "09:00"
  },
  endTime: {
    type: String, // e.g., "17:00"
  },
  location: {
    type: String,
    trim: true,
  },
  eventType: {
    type: String,
    enum: ['academic', 'sports', 'cultural', 'meeting', 'holiday', 'other'],
    default: 'other',
  },
  color: {
    type: String,
    default: '#6366f1', // Default indigo color
  },
  school: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
    required: true,
    index: true,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PortalUser',
    required: true,
  },
  attendees: [
    {
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'attendeeModel',
    },
  ],
  attendeeModel: {
    type: String,
    enum: ['PortalUser', 'Parent', 'Learner', 'Teacher'],
  },
  isAllDay: {
    type: Boolean,
    default: false,
  },
  isRecurring: {
    type: Boolean,
    default: false,
  },
  recurringPattern: {
    type: String,
    enum: ['daily', 'weekly', 'monthly', 'yearly'],
  },
  recurringEndDate: {
    type: Date,
  },
  status: {
    type: String,
    enum: ['draft', 'published', 'cancelled', 'completed'],
    default: 'published',
  },
  attachment: {
    type: String, // URL or file reference
  },
  reminder: {
    enabled: {
      type: Boolean,
      default: false,
    },
    minutesBefore: {
      type: Number,
      default: 15, // minutes before event
    },
  },
}, {
  timestamps: true,
});

// Index for efficient queries
EventSchema.index({ school: 1, startDate: 1 });
EventSchema.index({ school: 1, endDate: 1 });

const Event = mongoose.model('Event', EventSchema);
module.exports = Event;


