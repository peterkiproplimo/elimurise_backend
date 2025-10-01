const mongoose = require('mongoose');

const schoolLearningAreaAssignmentSchema = new mongoose.Schema(
  {
    school: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'School',
      required: true,
    },
    learning_area: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'learning_area',
      required: true,
    },
    custom_lessons_per_week: {
      type: Number,
      min: [0, 'Number of lessons per week must be a positive number'],
      // Optional override for school-specific lesson count
    },
    notes: {
      type: String,
      // Optional notes for school-specific modifications
    },
  },
  { timestamps: true }
);

// Compound index to ensure unique school-learning_area combinations
schoolLearningAreaAssignmentSchema.index(
  { school: 1, learning_area: 1 },
  { unique: true }
);

// Pre-save middleware to validate data
schoolLearningAreaAssignmentSchema.pre('save', async function (next) {
  try {
    // Validate that the learning area exists
    const LearningArea = mongoose.model('learning_area');
    const learningArea = await LearningArea.findById(this.learning_area);
    
    if (!learningArea) {
      throw new Error('Learning area not found');
    }
    
    // Only allow assignment of non-compulsory learning areas
    if (learningArea.is_compulsory) {
      throw new Error('Cannot assign compulsory learning areas - they are automatically available');
    }
    
    next();
  } catch (error) {
    next(error);
  }
});

// Static method to get learning areas for a school
schoolLearningAreaAssignmentSchema.statics.getSchoolLearningAreas = async function(schoolId) {
  const query = { school: schoolId };
  
  return this.find(query)
    .populate('learning_area')
    .sort({ createdAt: -1 });
};

// Static method to assign learning areas to a school
schoolLearningAreaAssignmentSchema.statics.assignLearningAreas = async function(schoolId, learningAreaIds) {
  const assignments = [];
  
  for (const learningAreaId of learningAreaIds) {
    try {
      const assignment = await this.findOneAndUpdate(
        { school: schoolId, learning_area: learningAreaId },
        {},
        { upsert: true, new: true }
      );
      assignments.push(assignment);
    } catch (error) {
      if (error.code === 11000) {
        // Duplicate key error - assignment already exists
        const assignment = await this.findOne({
          school: schoolId,
          learning_area: learningAreaId
        });
        assignments.push(assignment);
      } else {
        throw error;
      }
    }
  }
  
  return assignments;
};

const SchoolLearningAreaAssignment = mongoose.model('school_learning_area_assignment', schoolLearningAreaAssignmentSchema);
module.exports = SchoolLearningAreaAssignment; 