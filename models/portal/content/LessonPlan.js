const mongoose = require('mongoose');
const LessonPlanSchema = new mongoose.Schema(
  {
    scheme_lessons: [
      {
        scheme_lesson: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'SchemeLesson',
          required: true,
        },
        reflection: {
          type: String,
          default: '',
        },
        _id: false,
      },
    ],
    teacher_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PortalUser',
      required: true,
    },
    date: {
      type: Date,
      // required: true,
      default: Date.now,
    },
    time: {
      type: String,
      // required: true,
    },

    status: {
      type: String,
      enum: ['draft', 'published'],
      default: 'draft',
    },
  },
  {timestamps: true},
);
const LessonPlan = mongoose.model('LessonPlan', LessonPlanSchema);
module.exports = LessonPlan;
