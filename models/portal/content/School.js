const mongoose = require('mongoose');
const crypto = require('crypto');

async function generateUniqueSchoolCode() {
  const length = 8; // Desired length of the code
  let code;
  let isUnique = false;

  while (!isUnique) {
    // Generate a random code
    code = crypto.randomBytes(length).toString('hex').slice(0, length).toUpperCase(); // Example format

    // Check if the code already exists
    const existingSchool = await mongoose.model('School').findOne({schoolCode: code});
    if (!existingSchool) {
      isUnique = true;
    }
  }

  return code;
}

const schoolSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    county: {
      type: String,
    },
    subcounty: {
      type: String,
    },
    zone: {
      type: String,
    },
    schoolCode: {
      type: String,
      unique: true,
    },
    logo: {
      type: String,
    },
    address: {
      type: String,
    },
    numberOfLearners: {
      type: Number,
      default: 0,
      required: true,
    },
    current_term: {
      type: String,
      ref: 'Term',
    },
    current_session: {
      type: String,
    },
    pricing_package: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Package',
    },
    school_stamp: {
      type: String,
    },
    // Existing fields (kept for backward compatibility)
    school_head_teacher: {
      type: String,
    },
    school_head_teacher_signature: {
      type: String,
    },
    // New fields for flexible signatory
    signatory_role: {
      type: String,
      // enum: ['Head Teacher', 'Deputy Head Teacher', 'Teacher'],
      default: 'Head Teacher',
    },
    signatory_name: {
      type: String,
    },
    signatory_signature: {
      type: String,
    },
    summative_has_score: {
      type: Boolean,
      default: false,
    },
    summative_has_pos: {
      type: Boolean,
      default: false,
    },

    primaryColor: {
      type: String,
    },
    secondaryColor: {
      type: String,
    },
    school_motto: {
      type: String,
    },
    administrators: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User', // Assuming you have a User model for school admins
      },
    ],
    teachers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Teacher', // Assuming you have a User model for teachers
      },
    ],
    students: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Learner', // Assuming you have a User model for students
      },
    ],
    active: {
      type: Boolean,
      default: true,
    },
    // You can add more fields as per your requirements
  },
  {timestamps: true},
);

schoolSchema.pre('save', async function (next) {
  if (this.isNew) {
    try {
      this.schoolCode = await generateUniqueSchoolCode();
      next();
    } catch (err) {
      next(err);
    }
  } else {
    next();
  }
});

const School = mongoose.model('School', schoolSchema);
module.exports = School;
