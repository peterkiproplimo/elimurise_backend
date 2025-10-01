const {required, boolean} = require('joi');
const mongoose = require('mongoose');

// Define the Grading schema
const gradingSchema = new mongoose.Schema({
  mark: {type: Number, required: true}, //actual mark scored 0-100
  score: {
    //grading score 1-4 i.e EE,ME,AE,BE
    type: Number,
    required: true,
  },
  description: {
    //score desription like why EE or why ME
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
const PlScaleSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  grade: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'grades',
    required: true,
  },
  deafult: {
    type: Boolean,
    default: true,
  },
  school: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'school',
  },
  learningAreas: [learningAreaSchema],
});

PlScaleSchema.index({name: 1, grade: 1, school: 1}, {unique: true});

// Define the AssessmentGrading model
const PlScale = mongoose.model('PlScale', PlScaleSchema);

module.exports = PlScale;
