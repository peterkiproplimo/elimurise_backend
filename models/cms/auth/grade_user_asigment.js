const mongoose = require('mongoose');

const GradeUserAssignment = mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'User',
    },
    grade: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'grades',
    },
    learning_area: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'learning_area',
    },
  },
  {timestamps: true},
);

module.exports = mongoose.model('GradeUserAssignment', GradeUserAssignment);
