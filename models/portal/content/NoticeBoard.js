const mongoose = require('mongoose');

const NotificeBoardSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  noticeDate: {
    type: Date,
    required: true,
  },
  publishOn: {
    type: Date,
    required: true,
  },
  expiresOn: {
    type: Date, // Optional expiry date
  },
  attachment: {
    type: String, // URL or file reference
  },
  message: {
    type: String,
    required: true,
  },
  recipients: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PortalRole',
    },
  ],
  school: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
    required: true,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // Tracks who posted the notice
    required: true,
  },
  status: {
    type: String,
    enum: ['draft', 'published', 'expired'],
    default: 'draft',
  },
  priority: {
    type: String,
    enum: ['low', 'normal', 'high'],
    default: 'normal',
  },
  readBy: [
    {
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
      readAt: {
        type: Date,
        default: Date.now,
      },
    },
  ],
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const NotificeBoard = mongoose.model('NotificeBoard', NotificeBoardSchema);
module.exports = NotificeBoard;
