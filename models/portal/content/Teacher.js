const mongoose = require('mongoose');
const TeachersSchema = new mongoose.Schema(
  {
    school: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'School',
      required: true,
    },
    firstname: {
      type: String,
      required: true,
    },
    lastname: {
      type: String,
      // Optional field
    },
    surname: {
      type: String,
      // Optional field
    },
    phone: {
      type: String,
      // Optional field - not required
    },
    email: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      // Optional field
    },
    gender: {
      type: String,
      enum: ['Male', 'Female'],
      required: true,
    },
    streams: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'grades',
        required: true,
      },
    ],
    learning_areas: [
      {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
      },
    ],
    status: {
      type: Number,
      default: 0,
    },
  },
  {timestamps: true},
);

module.exports = mongoose.model('Teacher', TeachersSchema);
