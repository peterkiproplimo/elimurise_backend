const mongoose = require('mongoose');

const timetableSchema = new mongoose.Schema(
  {
    school: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'School',
      required: true,
    },
    session: {
      type: String, // e.g., "2023/2024"
      required: true,
    },
    stream: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Stream',
      required: true,
    },
    timeSlot: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TimeSlot',
      required: true,
    },
    dayOfWeek: {
      type: String,
      enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
      required: true,
    },
    teacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Teacher',
      // required: true,
    },
    periodType: {type: String, enum: ['learning_area', 'special'], required: true},
    specialPeriod: {type: mongoose.Schema.Types.ObjectId, ref: 'SpecialProgram', required: false},
    learning_area: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'learning_area',
      required: false,
    },
    status: {
      type: Number,
      default: 0, // 0: Active, 1: Inactive
    },
  },
  {timestamps: true},
);

// Ensure unique timetable entries per school, session, stream, time slot, and day
timetableSchema.index(
  {school: 1, session: 1, stream: 1, timeSlot: 1, dayOfWeek: 1, learning_area: 1, teacher: 1},
  {unique: true},
);

// Pre-find hook to populate related fields
timetableSchema.pre(/^find/, function (next) {
  this.populate([
    {path: 'stream', select: 'name grade'},
    {path: 'timeSlot', select: 'startTime endTime slotNumber'},
    {path: 'teacher', select: 'firstname lastname surname'},
    {path: 'learning_area', select: 'name'},
  ]);
  next();
});

// Validate that teacher is assigned to the stream and learning area
timetableSchema.pre('save', async function (next) {
  const GradeTeacherAssignment = mongoose.model('GradeTeacherAssignment');
  const assignment = await GradeTeacherAssignment.findOne({
    school: this.school,
    session: this.session,
    stream: this.stream,
    user: this.teacher,
    learning_area: this.learning_area,
  });

  if (!assignment && this.periodType !== 'special') {
    return next(new Error('Teacher is not assigned to this stream and learning area for the given session'));
  }

  next();
});

module.exports = mongoose.model('Timetable', timetableSchema);
