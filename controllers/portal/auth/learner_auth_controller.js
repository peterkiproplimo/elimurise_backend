const jwt = require('jsonwebtoken');
require('../../../utils/logger');
const User = require('../../../models/portal/auth/User');
const logger = require('../../../utils/logger');
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const UserService = require('../../../services/portal/UserService');
const {check, validationResult} = require('express-validator');
const Learner = require('../../../models/portal/content/Learner');
const LearnerService = require('../../../services/portal/LearnersService');
const Parent = require('../../../models/portal/content/Parent');
const ParentService = require('../../../services/portal/ParentServce');
const EnrollmentService = require('../../../services/portal/EnrollmentService');
const enrollmentService = new EnrollmentService();
const learnerService = new LearnerService();
const userService = new UserService();
const parentService = new ParentService();
router.post('/login', async (req, res) => {
  try {
    const email = req.body.email;
    const password = req.body.password;
    const code = req.body.code;

    const user = await Parent.findOne({
      email: email,
      schoolCode: code,
    })
      .populate('school', '-_id name primaryColor secondaryColor logo active')
      .lean();
    console.log(user);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'wrong username or password',
      });
    }
    const isUser = await bcrypt.compare(password, user.password);
    if (!isUser) {
      return res.status(401).json({
        success: false,
        message: 'wrong username or password',
      });
    }
    if (!user.school.active) {
      return res.status(401).json({
        success: false,
        message: 'School Account is deactivated contact administrator',
      });
    }

    if (user) {
      const token = jwt.sign({AuthUser: user}, process.env.JWT_SECRET);
      // console.log(user);

      return res.status(200).json({
        success: true,
        user: user,
        token: token,
        school: user.school,
        ative: !!user?.school,
        message: 'Logged in successifully',
      });
    } else {
      return res.status(401).json({
        success: false,
        message: 'wrong username or password',
      });
    }
  } catch (e) {
    logger.error(`login error ${e.message}`);
    return res.status(404).json({success: false, error: 'Internal Server Error'});
  }
});

router.post('/forgot-password', async (req, res) => {
  try {
    const forgot = await parentService.sendOTP(req.body.email, req.body.code);
    return res.status(200).json({success: true, message: forgot});
  } catch (e) {
    logger.error(e.message);
    return res.status(404).json({success: false, message: e.message});
  }
});

router.post('/reset-password', async (req, res) => {
  try {
    const {password, token} = {...req.body};
    const forgot = await parentService.resetPassword(token, password);
    return res.status(200).json({success: true, message: forgot});
  } catch (e) {
    logger.error(e.message);
    return res.status(404).json({success: false, message: e.message});
  }
});

module.exports = router;

// exports.register_admin = (req, res) => {
//   try {
//     var admin = { ...req.body };
//     admin.created_by = req.user.username;
//     res.send(admin);
//   } catch (e) {
//     console.log(e);
//   }
// };
