const mongoose = require('mongoose');

// Define the Comments schema
const commentsSchema = new mongoose.Schema({
  // Reference to the learner associated with this comment
  learner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Learner',
    required: true, // Learner reference is required
  },

  // The academic term for which the comment is recorded (restricted to values 1, 2, or 3)
  term: {
    type: Number,
    enum: [1, 2, 3], // Allowed values are 1, 2, or 3
    required: true,
  },

  // Academic session (e.g., "2025") for the comment
  session: {
    type: String, // Assuming session is a string like "2025"; change to Number or ObjectId if needed
    required: [true, 'Session is required'],
    trim: true,
  },

  // Reference to the school associated with this comment
  school: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School', // References the School model (assumed to exist)
    required: [true, 'School is required'],
  },

  // Assessment information related to the comment, referencing a 'Test' document
  assessment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Test', // References the Test model
    required: [
      function () {
        return this.commentType === 'per-assessment';
      },
      'Assessment is required for per-assessment comments',
    ], // Required only for per-assessment comments
  },

  // Reference to the stream associated with this comment
  stream: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Stream',
    required: true,
  },

  // Reference to the grade associated with this comment
  grade: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Grade',
    required: true,
  },

  // Type of comment: per-assessment or termly
  commentType: {
    type: String,
    enum: ['per-assessment', 'termly'],
    required: true,
  },

  // A description provided by the teacher
  comment: {
    type: String,
    // required: [true, 'Comment is required'],
    trim: true, // Remove leading/trailing whitespace
  },
});

// Ensure unique combination of learner, term, session, school, commentType, and assessment (for per-assessment comments)
commentsSchema.index(
  {learner: 1, term: 1, session: 1, school: 1, commentType: 1, assessment: 1},
  {
    unique: true,
    partialFilterExpression: {commentType: 'per-assessment'}, // Unique index applies only to per-assessment comments
  },
);
commentsSchema.index(
  {learner: 1, term: 1, session: 1, school: 1, commentType: 1},
  {
    unique: true,
    partialFilterExpression: {commentType: 'termly'}, // Unique index for termly comments
  },
);

// Define the Comments model based on the schema
const Comments = mongoose.model('Comments', commentsSchema);

module.exports = Comments;
