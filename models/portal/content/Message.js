const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    learner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Learner',
      // required: true,
      index: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'senderModel',
      required: true,
    },
    senderModel: {
      type: String,
      enum: ['PortalUser', 'Parent', 'School'],
      required: true,
    },
    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'receiverModel',
      required: true,
    },
    receiverModel: {
      type: String,
      enum: ['PortalUser', 'Parent', , 'School'],
      required: true,
    },
    message: {
      type: String,
      required: false, // Make message optional if attachments are present
    },
    attachments: [
      {
        url: {
          type: String,
          required: true, // URL to the stored file (e.g., S3 link)
        },
        fileName: {
          type: String,
          required: true, // Original name of the uploaded file
        },
        fileType: {
          type: String,
          required: true, // MIME type (e.g., "image/png", "application/pdf")
        },
        fileSize: {
          type: Number,
          required: true, // Size in bytes
        },
        uploadedAt: {
          type: Date,
          default: Date.now, // Timestamp of upload
        },
      },
    ],
    read: {
      type: Boolean,
      default: false,
    },
  },
  {timestamps: true},
);

// Add a validation to ensure at least one of message or attachments is provided
messageSchema.pre('validate', function (next) {
  if (!this.message && (!this.attachments || this.attachments.length === 0)) {
    next(new Error('A message or at least one attachment is required.'));
  } else {
    next();
  }
});

const Message = mongoose.model('Message', messageSchema);

module.exports = Message;
