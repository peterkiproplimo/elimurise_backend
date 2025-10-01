const {required} = require('joi');
const mongoose = require('mongoose');

// Define the Assessment schema
const assessmentSchema = new mongoose.Schema({
  learner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Learner',
    required: true,
  },
  behaviour: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BehaviorCategory',
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
    required: 'Stream',
  },
  grade: {
    type: mongoose.Schema.Types.ObjectId,
    required: 'grades',
  },
  description: {
    type: String,
    // required: true,
  },
});
assessmentSchema.index({learner: 1, behaviour: 1, term: 1}, {unique: true});

// Define the Assessment model
const BehaviourAssessment = mongoose.model('BehaviourAssessment', assessmentSchema);

module.exports = BehaviourAssessment;
