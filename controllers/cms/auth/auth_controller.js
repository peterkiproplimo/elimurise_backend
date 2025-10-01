const jwt = require('jsonwebtoken');
require('../../../utils/logger');
const User = require('../../../models/cms/auth/User');
const logger = require('../../../utils/logger');
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const UserService = require('../../../services/cms/UserService');
const userService = new UserService();

router.post('/login', async (req, res) => {
  try {
    const email = req.body.email;
    const password = req.body.password;
    const user = await User.findOne({
      email,
    });
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'wrong username or password',
      });
    }
    const isUser = await bcrypt.compare(password, user.password);
    if (!isUser) {
      return res.status(401).json({
        success: false,
        error: 'wrong username or password',
      });
    }
    if (user.status === 0) {
      return res.status(401).send({
        success: false,
        error: 'Account is deactivated contact administrator',
      });
    }

    if (user) {
      const token = jwt.sign({AuthUser: user}, process.env.JWT_SECRET);
      // console.log(user);
      return res.send({
        success: true,
        user: user,
        token: token,
        message: 'Logged in successifully',
      });
    } else {
      return res.status(401).send({
        success: false,
        error: 'wrong username or password',
      });
    }
  } catch (e) {
    logger.error(`login error ${e.message}`);
    return res.status(404).send({success: false, error: 'Internal Server Error'});
  }
});

router.post('/forgot-password', async (req, res) => {
  try {
    const forgot = await userService.sendOTP(req.body.email);
    return res.status(200).json({success: true, message: forgot});
  } catch (e) {
    logger.error(e.message);
    return res.status(404).json({success: false, message: e.message});
  }
});

router.post('/reset-password', async (req, res) => {
  try {
    const {password, token} = {...req.body};
    const forgot = await userService.resetPassword(token, password);
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
