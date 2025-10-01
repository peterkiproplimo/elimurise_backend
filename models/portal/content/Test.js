const {required} = require('joi');
const mongoose = require('mongoose');

// Define the Assessment schema
const assessmentSchema = new mongoose.Schema(
  {
    school: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'School',
    },
    name: {
      type: String,
      required: true,
    },
    grading: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PlScale',
    },
    session: {
      type: String,
    },
    type: {
      type: String,
      enum: ['Tunner', 'Mid Term', 'End of the Term', 'Monthly Test'],
    },
    term: {
      enum: [1, 2, 3],
      type: String,
    },
    grade: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'grades',
      required: true,
    },
    status: {
      type: Number,
      default: 1,
    },
    isPublished: {
      type: Boolean,
      default: false,
    },
    month: {
      type: String,
      enum: [
        'January',
        'February',
        'March',
        'April',
        'May',
        'June',
        'July',
        'August',
        'September',
        'October',
        'November',
        'December',
      ],
    },
  },
  {timestamps: true},
);
assessmentSchema.index({name: 1, session: 1, term: 1, type: 1, grade: 1}, {unique: true});

// Define the Assessment model
const Test = mongoose.model('Test', assessmentSchema);

module.exports = Test;
