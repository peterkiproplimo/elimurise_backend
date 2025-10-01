const Notification = require('../../models/portal/content/Notifications');

class NotificationService {
  // Create a new notification
  static async createNotification(data) {
    try {
      const notification = new Notification(data);
      return await notification.save();
    } catch (error) {
      throw new Error(`Error creating notification: ${error.message}`);
    }
  }

  // Fetch all notifications
  static async getAllNotifications() {
    try {
      return await Notification.find();
    } catch (error) {
      throw new Error(`Error fetching notifications: ${error.message}`);
    }
  }

  // Fetch a single notification by ID
  static async getNotificationById(notificationId) {
    try {
      return await Notification.findById(notificationId);
    } catch (error) {
      throw new Error(`Notification not found: ${error.message}`);
    }
  }

  // Fetch notifications by user ID
  static async getNotificationsByUserId(userId) {
    try {
      return await Notification.find({user: userId, isRead: false}).sort({createdAt: -1});
    } catch (error) {
      throw new Error(`Error fetching notifications for user: ${error.message}`);
    }
  }

  // Update a notification
  static async updateNotification(notificationId) {
    try {
      return await Notification.findByIdAndUpdate(notificationId, {isRead: true}, {new: true});
    } catch (error) {
      throw new Error(`Error updating notification: ${error.message}`);
    }
  }

  // Delete a notification
  static async deleteNotification(notificationId) {
    try {
      return await Notification.findByIdAndDelete(notificationId);
    } catch (error) {
      throw new Error(`Error deleting notification: ${error.message}`);
    }
  }
}

module.exports = NotificationService;
