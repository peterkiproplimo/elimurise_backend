const mongoose = require('mongoose');
const streamSchema = new mongoose.Schema(
  {
    school: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'School',
      required: true,
    },
    grade: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'grades',
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    class_manager: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'PortalUser',
    },
    section_head: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'PortalUser',
    },
    status: {
      type: Number,
      default: 0,
    },
  },
  {timestamps: true},
);
streamSchema.index({school: 1, grade: 1, name: 1});
streamSchema.pre(/^find/, function (next) {
  this.populate({
    path: 'grade',
    select: 'name level', // Specify the fields you want to populate
  });
  this.sort({'grade.level': 1, name: 1});

  next();
});

const Stream = mongoose.model('Stream', streamSchema);
// Stream.collection
//   .dropIndexes()
//   .then(() => {
//     console.log('All indexes dropped successfully.');
//   })
//   .catch(error => {
//     console.error('Error dropping indexes:', error);
//   });
module.exports = Stream;
