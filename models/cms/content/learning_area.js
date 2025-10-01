const mongoose = require('mongoose');

const learningAreaSchema = new mongoose.Schema(
  {
    grade_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'grades',
      required: true,
    },
    short_name: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    no_of_lessons_per_week: {
      type: Number,
      required: true,
      min: [0, 'Number of lessons per week must be a positive number'],
    },
    status: {
      type: Number,
      default: 0,
    },

    is_compulsory: {
      type: Boolean,
      default: false,
    },
    description: {
      type: String,
      // Optional description for the learning area
    },
  },
  {timestamps: true},
);

// Compound index for unique learning areas per grade and school (or global)
learningAreaSchema.index({name: 1, grade_id: 1, school: 1}, {unique: true, sparse: true});

// Pre-save middleware to validate data
learningAreaSchema.pre('save', async function (next) {
  try {
    next();
  } catch (error) {
    next(error);
  }
});

// Static method to get compulsory learning areas (linked to school)
learningAreaSchema.statics.getCompulsoryLearningAreas = async function (schoolId, gradeId = null) {
  const query = {
    // school: schoolId,
    is_compulsory: true,
  };
  if (gradeId) {
    query.grade_id = gradeId;
  }
  return this.find(query).populate('grade_id', 'name').sort({name: 1});
};

// Static method to get non-compulsory learning areas (not linked to school)
learningAreaSchema.statics.getNonCompulsoryLearningAreas = async function (gradeId = null) {
  const query = {
    is_compulsory: false,
  };
  if (gradeId) {
    query.grade_id = gradeId;
  }
  return this.find(query).populate('grade_id', 'name').sort({name: 1});
};

// Static method to get all available learning areas for a school (compulsory + non-compulsory)
learningAreaSchema.statics.getAvailableLearningAreas = async function (schoolId, gradeId = null) {
  const query = {
    $or: [
      {is_compulsory: false},
      // { school: schoolId, is_compulsory: true }
    ],
  };
  if (gradeId) {
    query.grade_id = gradeId;
  }
  return this.find(query).populate('grade_id', 'name').sort({name: 1});
};

learningAreaSchema.pre(/^find/, function (next) {
  this.sort({createdAt: -1}); // Sort by createdAt in descending order
  next();
});

const LearningArea = mongoose.model('learning_area', learningAreaSchema);
module.exports = LearningArea;
