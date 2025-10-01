const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    user: {type: mongoose.Schema.Types.ObjectId, ref: 'PortalUser', required: true},
    title: {type: String, required: true},
    message: {type: String, required: true},
    type: {type: String, enum: ['info', 'warning', 'success', 'error'], default: 'info'},
    isRead: {type: Boolean, default: false},
    link: {type: String}, // Optional: Link for redirection
  },
  {timestamps: true},
);

const Notification = mongoose.model('Notification', notificationSchema);
module.exports = Notification;
