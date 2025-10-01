const mongoose = require('mongoose');
const gradeSchema = new mongoose.Schema(
  {
    level_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'levels',
      required: true,
    },
    name: {
      type: String,
      required: true,
      unique: true,
    },
    status: {
      type: Number,
      default: 0,
    },
    level: {
      type: Number,
      default: 0,
    },
  },
  {timestamps: true},
);

const Grade = mongoose.model('grades', gradeSchema);
module.exports = Grade;
