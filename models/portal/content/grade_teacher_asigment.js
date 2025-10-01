const mongoose = require('mongoose');

const GradeTeacherAssignment = mongoose.Schema(
  {
    school: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'School',
    },
    session: {
      type: String,
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'Teacher',
    },
    stream: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'Stream',
    },
    learning_area: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'learning_area',
    },
  },
  {timestamps: true},
);

module.exports = mongoose.model('GradeTeacherAssignment', GradeTeacherAssignment);
