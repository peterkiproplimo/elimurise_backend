// Define the LessonProgress schema
const mongoose = require("mongoose");
const lessonProgressSchema = new mongoose.Schema({
  School: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "School",
    required: true,
  },
  stream: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Stream",
    required: true,
  },
  learningArea: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "LearningArea",
    required: true,
  },
  strands: [
    {
      strand: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Strand",
        required: true,
      },
      subStrands: [
        {
          subStrand: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "SubStrand",
            required: true,
          },
          completed: {
            type: Boolean,
            default: false,
          },
        },
      ],
    },
  ],
  currentStrand: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Strand",
  },
  currentSubStrand: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "SubStrand",
  },
});

// Define the LessonProgress model
const LessonProgress = mongoose.model("LessonProgress", lessonProgressSchema);

module.exports = LessonProgress;
