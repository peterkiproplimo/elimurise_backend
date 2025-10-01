const mongoose = require('mongoose');

// Schema for lesson steps
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

// Schema for learning organization
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

// Customized lesson schema for teachers to edit
const SchemeLessonSchema = new mongoose.Schema(
  {
    master_lesson: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lesson',
      required: true,
    },
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
  {timestamps: true},
);

// Week schema that references SchemeLesson by ObjectId
const WeekSchema = new mongoose.Schema(
  {
    week: {
      type: Number,
      required: true,
    },
    lessons: [
      {
        scheme_lesson: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'SchemeLesson',
          required: true,
        },
        _id: false,
      },
    ],
  },
  {_id: false},
);

// Break schema for storing break weeks
const BreakSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },
    duration: {
      type: String,
      enum: ['predefined', 'custom'],
      required: true,
    },
    startWeek: {
      type: Number,
      required: true,
    },
    startLesson: {
      type: String,
      default: '',
    },
    endWeek: {
      type: Number,
      required: true,
    },
    endLesson: {
      type: String,
      default: '',
    },
  },
  {_id: false},
);

// Main Scheme document
const SchemeSchema = new mongoose.Schema(
  {
    learning_area: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'learning_area',
    },
    term: {
      type: String,
      required: true,
    },
    year: {
      type: Number,
      required: true,
    },
    reference_book: {
      type: String,
      default: '',
    },
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PortalUser',
      required: true,
    },
    weeks: {
      type: [WeekSchema],
      default: [],
    },
    breaks: {
      type: [BreakSchema],
      default: [],
    },
  },
  {timestamps: true},
);

const Scheme = mongoose.model('Scheme', SchemeSchema);
const SchemeLesson = mongoose.model('SchemeLesson', SchemeLessonSchema);

module.exports = {
  Scheme,
  SchemeLesson,
};
