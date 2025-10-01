const express = require('express');
const authController = require('../controllers/portal/auth/learner_auth_controller');
const LearnersProfile = require('../controllers/portal/content/LearnersProfile');
const gradesController = require('../controllers/portal/content/grade_controller');
const MessagesController = require('../controllers/portal/content/MessagesController');
const Notification = require('../controllers/portal/content/NotificationsCotroller');
const NoticeBoard = require('../controllers/portal/content/NoticeboardController');

const {auth} = require('../middleware/learner-auth');
const router = express.Router();

router.use('/auth', authController);
router.use('/v1', auth, LearnersProfile);
router.use('/messages', auth, MessagesController);
router.use('/noticeboard', auth, NoticeBoard);
router.use('/notifications', auth, Notification);

router.get('/health', async (req, res) => {
  return res.status(200).json({status: 'up and running'});
});

module.exports = router;
