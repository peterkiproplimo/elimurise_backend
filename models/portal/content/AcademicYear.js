const mongoose = require('mongoose');
const sessionSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  startDate: {
    type: Date,
    required: true,
  },
  endDate: {
    type: Date,
    required: true,
  },
  isCurrent: {
    type: Boolean,
    // required: true,
    default: false,
  },
  school: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
    required: true,
  },
});

module.exports = mongoose.model('session', sessionSchema);
