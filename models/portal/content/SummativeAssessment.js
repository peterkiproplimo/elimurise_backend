const {required} = require('joi');
const mongoose = require('mongoose');

// Define the Assessment schema
const assessmentSchema = new mongoose.Schema({
  test: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Test',
    required: true,
  },

  learner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Learner',
    required: true,
  },
  learning_area: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'learning_area',
    required: true,
  },
  score: {
    type: Number,
    required: true,
  },
  term: {
    type: String,
    enum: [1, 2, 3],
    required: true,
  },
  session: {
    type: String,
    ref: 'Test',
    required: true,
  },
  stream: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Stream',
  },
  grade: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'grades',
  },
});
assessmentSchema.index({test: 1, learner: 1, learning_area: 1}, {unique: true});

// Define the Assessment model
const SummativeAssessment = mongoose.model('SummativeAssessment', assessmentSchema);

module.exports = SummativeAssessment;
