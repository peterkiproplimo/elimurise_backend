const {required} = require('joi');
const mongoose = require('mongoose');

// Define the Grading schema
const gradingSchema = new mongoose.Schema({
  minScore: {
    type: Number,
    required: true,
    min: 0, // Minimum score
    max: 100, // Maximum score
  },
  maxScore: {
    type: Number,
    required: true,
    min: 0, // Minimum score
    max: 100, // Maximum score
  },
  description: {
    type: String,
    required: true,
  },
});

// Define the Learning Area schema
const learningAreaSchema = new mongoose.Schema({
  learning_area: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'learning_area',
    required: true,
  },
  gradings: [gradingSchema],
});

// Define the Assessment Grading schema
const assessmentGradingSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  grade: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'grades',
    required: true,
  },
  school: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'school',
    required: true,
  },
  learningAreas: [learningAreaSchema],
});

assessmentGradingSchema.index(
  {session: 1, name: 1, 'learningAreas.learning_area': 1, 'learningAreas.gradings': 1},
  {unique: true},
);

// Define the AssessmentGrading model
const AssessmentGrading = mongoose.model('AssessmentGrading', assessmentGradingSchema);

module.exports = AssessmentGrading;
