const mongoose = require('mongoose');

const LessonStepSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true, // e.g. "Introduction", "Lesson Development"
  },
  duration_minutes: {
    type: Number,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  is_extended_activity: {
    type: Boolean,
    default: false,
  },
});

const LearningOrganizationSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true, // e.g. "individual", "group"
  },
  notes: {
    type: String,
    default: '',
  },
});

const LessonSchema = new mongoose.Schema(
  {
    substrand: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'substrand',
      required: true,
    },
    lesson_number: {
      type: Number,
      required: true,
    },
    learning_outcome: {
      type: String,
      required: true,
    },
    key_inquiry_questions: {
      type: String,
      default: '',
    },
    core_competencies: {
      type: String,
      default: '',
    },
    values: {
      type: String,
      default: '',
    },
    contemporary_issues: {
      type: String,
      default: '',
    },
    links_to_learning_areas: {
      type: String,
      default: '',
    },
    number_of_lessons: {
      type: Number,
      default: 1,
    },
    suggested_learning_experiences: {
      type: String,
      default: '',
    },
    suggested_assessment_methods: {
      type: String,
      default: '',
    },
    suggested_learning_resources: {
      type: String,
      default: '',
    },
    non_formal_activities: {
      type: String,
      default: '',
    },
    reference: {
      type: String,
      default: '',
    },
    lesson_steps: [LessonStepSchema],
    learning_organization: [LearningOrganizationSchema],
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model('Lesson', LessonSchema);
