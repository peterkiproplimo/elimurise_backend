const mongoose = require('mongoose');

const projectEvidenceSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  caption: {
    type: String,
    required: true,
    trim: true
  },
  reflection: {
    type: String,
    required: true,
    trim: true
  },
  subject: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subject'
  },
  competency: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Competency'
  },
  pci: {
    type: String,
    required: true,
    enum: [
      'Environment',
      'Health',
      'Gender',
      'Values',
      'Human Rights',
      'Child Protection',
      'Life Skills',
      'Citizenship',
      'Peace Education',
      'Technology',
      'Innovation',
      'Entrepreneurship'
    ]
  },
  evidenceType: {
    type: String,
    required: true,
    enum: ['photo', 'video']
  },
  mediaUrl: {
    type: String,
    required: false
  },
  googleDriveFiles: {
    type: [{
      mediaUrl: {
        type: String,
        required: true
      },
      googleDriveUrl: {
        type: String,
        required: true
      },
      googleDriveFileId: {
        type: String,
        required: true
      },
      fileType: {
        type: String,
        required: true
      }
    }],
    default: []
  },
  cloudinaryData: {
    public_id: {
      type: String
    },
    secure_url: {
      type: String
    },
    url: {
      type: String
    },
    format: {
      type: String
    },
    width: {
      type: Number
    },
    height: {
      type: Number
    },
    bytes: {
      type: Number
    },
    folder: {
      type: String
    },
    folderStructure: {
      mainFolder: {
        type: String
      },
      studentFolder: {
        type: String
      },
      projectFolder: {
        type: String
      }
    }
  },
  thumbnailUrl: {
    type: String
  },
  googleDriveUrl: {
    type: String
  },
  googleDriveFileId: {
    type: String
  },
  student: {
    type: String,
    required: true,
    trim: true
  },
  studentName: {
    type: String,
    required: true,
    trim: true
  },
  studentId: {
    type: String,
    required: true,
    trim: true
  },
  teacherFeedback: {
    type: [{
      comment: {
        type: String,
        trim: true,
        required: true
      },
      rating: {
        type: Number,
        min: 1,
        max: 5,
        required: true
      },
      authenticityApproved: {
        type: Boolean,
        default: false
      },
      feedbackBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      feedbackBy_name: {
        type: String,
        trim: true
      },
      feedbackDate: {
        type: Date,
        default: Date.now
      }
    }],
    default: []
  },
  status: {
    type: String,
    enum: ['submitted', 'reviewed', 'approved', 'rejected'],
    default: 'submitted'
  },
  submittedAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Update the updatedAt field before saving
projectEvidenceSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Index for better query performance
projectEvidenceSchema.index({ student: 1, subject: 1, competency: 1 });
projectEvidenceSchema.index({ status: 1 });
projectEvidenceSchema.index({ submittedAt: -1 });

module.exports = mongoose.model('ProjectEvidence', projectEvidenceSchema);
