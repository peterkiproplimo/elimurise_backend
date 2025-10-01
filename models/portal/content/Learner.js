const {required} = require('joi');
const mongoose = require('mongoose');

const learnerSchema = new mongoose.Schema(
  {
    school: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'School',
      required: true,
    },
    current_session: {type: String, required: true},
    grade: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'grades',
      required: true,
    },
    stream: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Stream',
      required: true,
    },
    first_name: {
      type: String,
      required: true,
    },
    last_name: {
      type: String,
    },
    surname: {
      type: String,
      // required: true,
    },
    assessment_no: {
      type: String,
    },
    adm_no: {
      type: String,
      required: true,
    },
    nemis_no: {
      type: String,
    },
    gender: {
      type: String,
      enum: ['Male', 'Female'],
      required: true,
    },
    dateOfBirth: {
      type: Date,
      // Optional field - not required
    },
    religion: {
      type: String,
      // Optional field - not required
    },
    guardian: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Parent',
      required: true,
    },
    guardian_relationship: {
      type: String,
      enum: ['Father', 'Mother', 'Guardian'],
      required: true,
    },
    guardian2: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Parent',
    },
    guardian2_relationship: {
      type: String,
      enum: ['Father', 'Mother', 'Guardian'],
    },
    photo: {
      type: String,
    },
    year_admitted: {
      type: String,
    },
    status: {
      type: String,
      enum: ['L', 'G', 'P', 'D'],
      default: 'P',
    },
    left_date: {
      type: Date,
      default: undefined,
    },
    grad_date: {
      type: Date,
      default: undefined,
    },

  },
  {timestamps: true},
);
learnerSchema.index({adm_no: 1, school: 1}, {unique: true});

const Learner = mongoose.model('Learner', learnerSchema);
module.exports = Learner;
