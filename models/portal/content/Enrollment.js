const mongoose = require('mongoose');
const enrollmentSchema = new mongoose.Schema({
  school: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
    required: true,
  },
  learner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Learner',
    required: true,
  },
  from_grade: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'grades',
  },
  from_stream: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Stream',
  },
  to_grade: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'grades',
  },
  to_stream: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Stream',
  },
  grad: {
    type: Number,
    default: 0,
    // required: true,
  },
  from_session: {
    type: String,
    ref: 'grades',
  },
  to_session: {
    type: String,
  },
  status: {
    type: String,
    default: 'P',
  },
  // isTransitioned: {
  //   type: Boolean,
  //   default: false,
  // },
  // stream: {
  //   type: mongoose.Schema.Types.ObjectId,
  //   ref: 'Stream',
  //   required: true,
  // },
  // originalsession: {type: mongoose.Schema.Types.ObjectId, ref: 'session'},

  // Other fields related to student enrollment such as grades, attendance, etc.
});
enrollmentSchema.pre(/^find/, function (next) {
  this.populate({
    path: 'school',
    select: 'name', // Specify the fields you want to populate
  });
  this.populate({
    path: 'learner',
    populate: [
      {
        path: 'guardian',
      },
      {
        path: 'guardian2',
      },
    ],
  });
  // this.populate({
  //   path: 'session',
  // });
  // this.populate({
  //   path: 'stream',
  // });
  // this.populate({
  //   path: 'originalsession',
  // });
  next();
});

enrollmentSchema.index({learner: 1, to_stream: 1}, {unique: true});

module.exports = mongoose.model('Enrollment', enrollmentSchema);
