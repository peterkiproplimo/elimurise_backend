const mongoose = require('mongoose');
const assessmentSchema = new mongoose.Schema({
  learner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Learner',
    required: true,
  },
  stream: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Stream',
  },
  grade: {
    type: mongoose.Schema.Types.ObjectId,
    required: 'grades',
  },
  session: {type: String, required: true},
  term: {
    type: String,
    enum: [1, 2, 3],
    required: true,
  },
  learning_area: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'learning_area',
    required: true,
  },
  strand: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'strand',
    required: true,
  },
  substrand: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'substrand',
    required: true,
  },
  indicator: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
  indicator_description: {
    type: String,
    required: true,
  },
  score: {
    type: Number,
    required: true,
    min: 1,
    max: 4,
  },
  description: {
    type: String,
    trim: true,
  },
  additionalDescription: {
    type: String,
    trim: true,
  },
  method: {
    type: String,
    required: true,
    trim: true,
  },
  uploadUrl: {
    type: String,
    trim: true,
  },
  published: {
    type: Boolean,
    default: false,
  },
  publishedDate: {
    type: Date,
  },
});
assessmentSchema.index({learner: 1, term: 1, learning_area: 1, strand: 1, substrand: 1, indicator: 1}, {unique: true});

// Define the Assessment model
const Assessment = mongoose.model('Assessment', assessmentSchema);

module.exports = Assessment;
