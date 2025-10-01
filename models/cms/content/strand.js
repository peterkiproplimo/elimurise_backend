const mongoose = require('mongoose');
const strandSchema = mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    learning_area: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'learning_area',
    },
    term: {
      type: Number,
      required: true,
      enum: [1, 2, 3, 4],
    },
    theme: {
      type: String,
      default: 'N/A',
    },
    row_number: {
      type: Number,
      default: 0,
    },
  },
  {timestamps: true},
);
// strandSchema.pre('find', function () {
//   this.sort({row_number: -1}); // Sort in ascending order based on row_number
// });
strandSchema.pre('save', async function (next) {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    // Check if row_number is not provided
    if (!this.row_number) {
      // Use findOneAndUpdate with session and sort option for atomic update
      const maxRow = await this.constructor
        .findOneAndUpdate(
          {learning_area: this.learning_area}, // Match documents by strand
          {$inc: {row_number: 1}}, // Increment row_number by 1
          {sort: {row_number: -1}, session, new: true},
        )
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
module.exports = mongoose.model('strand', strandSchema);
