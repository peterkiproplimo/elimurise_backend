const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');
const User = require('../models/portal/auth/User');
const Learner = require('../models/portal/content/Learner');
const Parent = require('../models/portal/content/Parent');

exports.auth = async (req, res, next) => {
  try {
    const checktoken = req.headers['authorization'];
    if (!checktoken) {
      return res.status(403).json({success: false, error: 'No Authentication token'});
    }
    const token = checktoken.split(' ')[1];
    jwt.verify(token, process.env.JWT_SECRET, async (err, data) => {
      if (err != null) return res.status(401).json({error: 'invalid access token'});

      const user = await Parent.findById(data.AuthUser._id).populate('school');

      // if (!user || user.status == 0) {
      //   return res.status(403).json({success: false, error: 'Invalid Access Token'});
      // }

      req.user = user;
      req.model = 'Parent';
      req.current_session = user?.school?.current_session;
      req.school = user?.school?._id;

      next();
    });
  } catch (e) {
    // console.log(e)
    logger.info(e.message);
    return res.status(404).json({success: false, error: 'Internal Server Error'});
  }
};
