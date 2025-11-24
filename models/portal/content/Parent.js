const mongoose = require('mongoose');
// const bcrypt = require('bcrypt');

const parentSchema = new mongoose.Schema(
  {
    school: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'School',
      required: true,
    },
    first_name: {
      type: String,
      required: true,
    },
    surname: {
      type: String,
      // Optional field
    },
    last_name: {
      type: String,
      // Optional field
    },
    id_no: {
      type: String,
      // Optional field
    },
    email: {
      type: String,
      required: true,
    },
    phone: {
      type: String,
      // Optional field
    },
    gender: {
      type: String,
      enum: ['Male', 'Female'],
      required: true,
    },
    password: {
      type: String,
      required: true,
    },
    schoolCode: {
      type: String,
      required: true,
    },
    verified: {
      type: Boolean,
    },
    otp: {
      type: String,
      default: undefined,
    },
    otp_expires_in: {
      type: Date,
    },
    status: {
      type: Number,
      default: 0,
    },
  },
  {timestamps: true},
);
parentSchema.index({email: 1, id_no: 1, school: 1}, {unique: true});
// Hash password before saving


// Method to compare password
parentSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

const Parent = mongoose.model('Parent', parentSchema);
// Parent.collection


module.exports = Parent;
