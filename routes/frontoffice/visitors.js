import express from "express";

import {
  registerVisitor,
  checkInVisitor,
  checkOutVisitor,
  getVisitors,
  getVisitorById,
  updateVisitor,
  getVisitorReport,
  checkOverstayedVisitors,
  getVisitorDurationAnalytics,
  updateVisitorDuration,
  acknowledgeVisitorAlert
} from "../../controllers/frontoffice/visitorController.js";

const router = express.Router();

// Routes

// Basic visitor operations
router.post('/', registerVisitor);
router.patch('/:id/checkin', checkInVisitor);
router.put('/:id/checkout', checkOutVisitor);
router.get('/', getVisitors);
router.get('/:id', getVisitorById);
router.put('/:id', updateVisitor);

// Reports and analytics
router.get('/reports/visitors', getVisitorReport);
router.get('/analytics/duration', getVisitorDurationAnalytics);

// Duration monitoring and alerts
router.get('/alerts/overstayed', checkOverstayedVisitors);
router.put('/:id/duration', updateVisitorDuration);
router.post('/:id/alerts/:alertId/acknowledge', acknowledgeVisitorAlert);

export default router;
