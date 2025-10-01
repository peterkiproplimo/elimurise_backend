const express = require('express');
const NotificationService = require('../../../services/portal/NotificationsService');

const router = express.Router();

// Create a new notification
router.post('/', async (req, res) => {
  try {
    const school = req?.user?.school;
    const user = req?.user?._id;

    if (!school) {
      return res.status(400).json({success: false, message: 'School ID is required'});
    }

    const notificationData = {...req.body, school, createdBy: user};
    const notification = await NotificationService.createNotification(notificationData);

    res.status(201).json({success: true, message: 'Notification created successfully', data: notification});
  } catch (error) {
    res.status(500).json({success: false, message: error.message});
  }
});

// Get all notifications for the logged-in user's school
router.get('/', async (req, res) => {
  try {
    const school = req?.user?.school;

    if (!school) {
      return res.status(400).json({success: false, message: 'School ID is required'});
    }

    const notifications = await NotificationService.getAllNotifications(school);
    res.status(200).json({success: true, data: notifications});
  } catch (error) {
    res.status(500).json({success: false, message: error.message});
  }
});

// Get notifications for a specific user
router.get('/list', async (req, res) => {
  try {
    const user = req?.user?._id;

    if (!user) {
      return res.status(400).json({success: false, message: 'User ID is required'});
    }

    const notifications = await NotificationService.getNotificationsByUserId(user);
    res.status(200).json({success: true, data: notifications});
  } catch (error) {
    res.status(500).json({success: false, message: error.message});
  }
});

// Get a specific notification by ID
router.get('/:notificationId', async (req, res) => {
  try {
    const notification = await NotificationService.getNotificationById(req.params.notificationId);

    if (!notification || notification.school.toString() !== req?.user?.school.toString()) {
      return res.status(403).json({success: false, message: 'Unauthorized to access this notification'});
    }

    res.status(200).json({success: true, data: notification});
  } catch (error) {
    res.status(500).json({success: false, message: error.message});
  }
});

// Update a notification
router.put('/:notificationId', async (req, res) => {
  try {
    const notification = await NotificationService.getNotificationById(req.params.notificationId);

    // if (!notification || notification.school.toString() !== req?.user?.school.toString()) {
    //   return res.status(403).json({success: false, message: 'Unauthorized to update this notification'});
    // }

    const updatedNotification = await NotificationService.updateNotification(req.params.notificationId, req.body);
    res.status(200).json({success: true, message: 'Notification updated successfully', data: updatedNotification});
  } catch (error) {
    res.status(500).json({success: false, message: error.message});
  }
});

// Delete a notification
router.delete('/:notificationId', async (req, res) => {
  try {
    const notification = await NotificationService.getNotificationById(req.params.notificationId);

    if (!notification || notification.school.toString() !== req?.user?.school.toString()) {
      return res.status(403).json({success: false, message: 'Unauthorized to delete this notification'});
    }

    await NotificationService.deleteNotification(req.params.notificationId);
    res.status(200).json({success: true, message: 'Notification deleted successfully'});
  } catch (error) {
    res.status(500).json({success: false, message: error.message});
  }
});

module.exports = router;
