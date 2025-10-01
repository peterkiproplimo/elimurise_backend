const mongoose = require('mongoose');

const indicators = mongoose.Schema({
  description: {
    type: String,
  },
  EE: {
    type: String,
  },
  ME: {
    type: String,
  },
  AE: {
    type: String,
  },
  BE: {
    type: String,
  },
});

const substrandSchema = mongoose.Schema(
  {
    row_number: {
      type: Number,
      default: 0,
    },
    name: {
      type: String,
      required: true,
    },
    strand: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'strand',
    },
    is_child: {
      type: Boolean,
      default: false,
    },
    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'substrand',
      default: undefined,
    },
    children: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'substrand',
    },
    learning_outcome: {
      type: String,
    },
    key_inquiry_questions: {
      type: String,
    },
    core_competencies: {
      type: String,
    },
    values: {
      type: String,
    },
    contemporary_issues: {
      type: String,
    },
    links_to_learning_areas: {
      type: String,
    },
    indicators: [[indicators]],
    number_of_lessons: {
      type: Number,
      default: 0,
    },
    suggested_learning_experiences: {
      type: String,
    },
    suggested_assessment_methods: {
      type: String, // Stores suggested methods to assess learning outcomes
    },
    suggested_learning_resources: {
      type: String, // Stores recommended resources for teaching/learning
    },
    non_formal_activities: {
      type: String, // Stores suggested non-formal activities to reinforce learning
    },
  },
  {timestamps: true},
);

// Pre-save hook for row_number (unchanged)
substrandSchema.pre('save', async function (next) {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    if (!this.row_number) {
      const maxRow = await this.constructor
        .findOneAndUpdate({strand: this.strand}, {$inc: {row_number: 1}}, {sort: {row_number: -1}, session, new: true})
        .session(session);

      this.row_number = maxRow ? maxRow.row_number + 1 : 1;
    }

    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
    next();
  }
});

// Pre-find hook for sorting (unchanged)
substrandSchema.pre('find', function () {
  this.sort({row_number: -1});
});

// Static method: findIndicatorById (unchanged)
substrandSchema.statics.findIndicatorById = async function (substrandId, indicatorId) {
  const substrand = await this.findById(substrandId);
  if (!substrand) {
    return null;
  }

  for (const indicatorGroup of substrand.indicators) {
    for (const indicator of indicatorGroup) {
      if (indicator._id.equals(new mongoose.Types.ObjectId(indicatorId))) {
        return indicator;
      }
    }
  }
  return null;
};

// Static method: findIndicatorByIdSession (unchanged)
substrandSchema.statics.findIndicatorByIdSession = async function (substrandId, indicatorId, session) {
  const substrand = await this.findById(substrandId).session(session);
  if (!substrand) {
    return null;
  }

  for (const indicatorGroup of substrand.indicators) {
    for (const indicator of indicatorGroup) {
      if (indicator._id.equals(new mongoose.Types.ObjectId(indicatorId))) {
        return indicator;
      }
    }
  }
  return null;
};

module.exports = mongoose.model('substrand', substrandSchema);
