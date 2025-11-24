const express = require("express");

const {
  createPhoneCall,
  getPhoneCalls,
  getPhoneCallById,
  updatePhoneCall,
  deletePhoneCall,
  completeFollowUp,
  getPhoneCallStats,
  getPendingFollowUps,
  getPhoneCallReport
} = require("../../controllers/frontoffice/phoneCallController");

const router = express.Router();

// Basic phone call operations
router.post('/', createPhoneCall);
router.get('/', getPhoneCalls);
router.get('/:id', getPhoneCallById);
router.put('/:id', updatePhoneCall);
router.delete('/:id', deletePhoneCall);

// Follow-up operations
router.patch('/:id/follow-up', completeFollowUp);
router.get('/follow-ups/pending', getPendingFollowUps);

// Statistics and reports
router.get('/stats/overview', getPhoneCallStats);
router.get('/reports', getPhoneCallReport);

module.exports = router;
