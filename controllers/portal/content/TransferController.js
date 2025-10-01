const express = require('express');
const router = express.Router();
const TransferRequest = require('../../../models/portal/content/Transfer');
const School = require('../../../models/portal/content/School');
const crypto = require('crypto');
const Learner = require('../../../models/portal/content/Learner');
const mongoose = require('mongoose');
const LearnerService = require('../../../services/portal/LearnersService');
const learnerService = new LearnerService();
const EnrollmentService = require('../../../services/portal/EnrollmentService');
const bcrypt = require('bcryptjs');
const enrollmentService = new EnrollmentService();
const StreamService = require('../../../services/portal/StreamService');
const streamService = new StreamService();
/**
 * Generates a unique random transfer code.
 * @returns {Promise<string>} - The generated transfer code.
 */
async function generateUniqueTransferCode() {
  const length = 8;
  let code;
  let isUnique = false;

  while (!isUnique) {
    code = crypto.randomBytes(length).toString('hex').slice(0, length).toUpperCase();

    const existingRequest = await TransferRequest.findOne({transferCode: code});
    if (!existingRequest) {
      isUnique = true;
    }
  }

  return code;
}

const {check, validationResult} = require('express-validator');
const ParentService = require('../../../services/portal/ParentServce');
const {checkPermission} = require('../../../middleware/portal-auth');
const parentService = new ParentService();
const validateTransferRequest = [
  check('learnerId').isMongoId().withMessage('Invalid learner ID'),
  check('newSchoolCode').not().isEmpty().withMessage('Invalid new school code'),
  check('reason').not().isEmpty().withMessage('Reason is required'),
  // check('documents').isArray().withMessage('Documents should be an array'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(404).json({success: false, errors: errors.array()});
    }
    next();
  },
];
router.get('/', checkPermission('transfer-requests', 'read'), async (req, res) => {
  try {
    // Get pagination parameters from query string
    const page = parseInt(req.query.page, 10) || 1; // Default to page 1 if not provided
    const limit = parseInt(req.query.limit, 10) || 10; // Default to 10 items per page if not provided
    const search = req.query.search; // Default to 10 items per page if not provided
    console.log({oldSchool: req.user.school._id});

    const transfers = await TransferRequest.find({oldSchool: req.user.school._id});
    const transferList = transfers.map(tranfer => tranfer.learner);
    console.log('trans', transferList);
    const query = {
      // school: req.user.school._id,
      _id: {$in: transferList},
      first_name: {$regex: new RegExp(search, 'i')},
    };

    const learners = await Learner.find(query);

    const learnerList = learners.map(learner => learner._id.toString());
    // Ensure limit is not too high (optional)
    const maxLimit = 100; // Set your maximum limit
    const adjustedLimit = Math.min(limit, maxLimit);

    // Calculate the number of documents to skip
    const skip = (page - 1) * adjustedLimit;

    // Find transfer requests with pagination
    const [transferRequests, total] = await Promise.all([
      TransferRequest.find({learner: {$in: learnerList}})
        .sort({createdAt: -1})
        .populate('learner oldSchool')
        .populate('newSchool', '-_id name schoolCode')
        .skip(skip)
        .limit(adjustedLimit)
        .exec(),
      TransferRequest.countDocuments({oldSchool: req.user.school._id}).exec(),
    ]);

    // Calculate total pages
    const totalPages = Math.ceil(total / adjustedLimit);

    // Send the result as a response
    return res.status(200).json({
      data: transferRequests,
      pagination: {
        current_page: page,
        total: total,
        total_pages: totalPages,
        per_page: adjustedLimit,
      },
    });
  } catch (err) {
    return res.status(404).json({success: false, error: err.message});
  }
});
router.get('/incomming', checkPermission('transfer-requests', 'read'), async (req, res) => {
  try {
    // Get pagination parameters from query string
    const page = parseInt(req.query.page, 10) || 1; // Default to page 1 if not provided
    const limit = parseInt(req.query.limit, 10) || 10; // Default to 10 items per page if not provided
    const status = req.query.status;
    // Ensure limit is not too high (optional)
    const maxLimit = 100; // Set your maximum limit
    const adjustedLimit = Math.min(limit, maxLimit);
    const query = {};

    // Calculate the number of documents to skip
    const skip = (page - 1) * adjustedLimit;

    // Find transfer requests with pagination
    const [transferRequests, total] = await Promise.all([
      TransferRequest.find({newSchool: req.user.school._id})
        .sort({createdAt: -1})
        .populate('learner newSchool')
        .populate('oldSchool', '-_id name schoolCode')
        .skip(skip)
        .limit(adjustedLimit)
        .exec(),
      TransferRequest.countDocuments({newSchool: req.user.school._id}).exec(),
    ]);

    // Calculate total pages
    const totalPages = Math.ceil(total / adjustedLimit);

    // Send the result as a response
    return res.status(200).json({
      data: transferRequests,
      pagination: {
        current_page: page,
        total: total,
        total_pages: totalPages,
        per_page: adjustedLimit,
      },
    });
  } catch (err) {
    return res.status(404).json({success: false, error: err.message});
  }
});
// Create a transfer request
router.post('/', checkPermission('transfer-requests', 'create'), validateTransferRequest, async (req, res) => {
  try {
    const {learnerId, newSchoolCode, reason} = req.body;

    if (!mongoose.Types.ObjectId.isValid(learnerId)) {
      return res.status(404).json({success: false, error: 'Invalid learner ID '});
    }

    const learner = await Learner.findById(learnerId);
    if (!learner) {
      return res.status(404).json({success: false, error: 'Learner not found.'});
    }

    const newSchool = await School.findOne({schoolCode: newSchoolCode});
    if (!newSchool) {
      return res.status(404).json({success: false, error: 'New school not found.'});
    }

    const transferCode = await generateUniqueTransferCode();

    const transferRequest = new TransferRequest({
      learner: learnerId,
      oldSchool: req.user.school._id,
      newSchool: newSchool._id,
      reason,
      // documents,
      transferCode,
      paymentStatus: 'Pending',
    });

    const savedRequest = await transferRequest.save();
    res.status(201).json({success: true, data: savedRequest});
  } catch (err) {
    res.status(404).json({success: false, error: err.message});
  }
});

// Mark a transfer request as paid

// Approve a transfer request
router.post('/approve', checkPermission('transfer-requests', 'approve'), async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  const school = req.user.school;
  try {
    const {transferCode, stream, adm_no} = req.body;
    const approvedBy = req.user._id;
    const streamData = await streamService.getStream(stream, req.user.school);
    if (!stream) {
      throw new Error('Stream not found');
    }
    if (!adm_no) {
      throw new Error('Adm is required');
    }
    const current_session = req?.current_session;

    if (!mongoose.Types.ObjectId.isValid(approvedBy)) {
      return res.status(404).json({success: false, error: 'Invalid approver ID.'});
    }

    const transferRequest = await TransferRequest.findOne({transferCode}).session(session);
    if (!transferRequest) {
      return res.status(404).json({success: false, error: 'Transfer request not found.'});
    }

    if (transferRequest.approvalStatus !== 'Pending') {
      return res.status(404).json({success: false, error: 'Transfer request has already been processed.'});
    }

    // if (transferRequest.paymentStatus !== 'Paid') {
    //   return res.status(404).json({success: false, error: 'Transfer request must be paid before it can be approved.'});
    // }

    transferRequest.approvalStatus = 'Approved';
    transferRequest.approvedBy = approvedBy;
    transferRequest.approvalDate = new Date();

    await transferRequest.save({session});
    const learner = await Learner.findById(transferRequest.learner).populate('guardian guardian2').session(session);

    if (!learner) {
      return res.status(404).json({success: false, error: 'Transfer request must be paid before it can be approved.'});
    }
    const learnerData = {
      ...learner.toObject(),
      stream: stream,
      school: transferRequest.newSchool,
      currentsession: current_session,
    };
    console.log('errror ', learnerData);

    // const data = {...learnerData, grade: streamData?.grade};
    learner.grade = streamData?.grade;
    learner.stream = streamData?._id;
    learner.school = req.school._id;
    learner.adm_no = adm_no;
    // currentsession.current_session=
    if (learner.guardian) {
      let guardian = await parentService.getOneParentByEmailOrId(learner.guardian.email, school._id);

      if (!guardian) {
        guardian = await parentService.createParent({
          ...learner.toObject().guardian,
          _id: undefined,
          school: school._id,
          schoolCode: school.schoolCode,
        });
      }

      learner.guardian = guardian._id;
    }

    if (learner?.guardian2) {
      let guardian2 = await parentService.getOneParentByEmailOrId(learner.guardian2.email, school._id);
      if (!guardian2) {
        guardian2 = await parentService.createParent({
          ...learner.toObject().guardian2,
          _id: undefined,
          school: school._id,
          schoolCode: school.schoolCode,
        });
      }

      learner.guardian2 = guardian2._id;
    }
    await enrollmentService.createEnrollment(
      {
        school: school._id,
        learner: learner._id,
        to_grade: streamData?.grade, // Use optional chaining
        to_stream: streamData?._id, // Use optional chaining
        to_session: current_session,
        grad: 0,
        status: 'P',
      },
      session,
    );

    await learner.save({session});
    await session.commitTransaction();
    session.endSession();
    return res.status(200).json({success: true, data: transferRequest});
  } catch (err) {
    await session.abortTransaction();
    session.endSession();

    return res.status(404).json({success: false, error: err.message});
  }
});
router.delete('/:id', checkPermission('transfer-requests', 'delete'), async (req, res) => {
  const transfer = req.params.id;
  const record = await TransferRequest.findOneAndDelete({
    _id: transfer, // Ensure you are looking for the specific record by its ID
    paymentStatus: 'Pending', // Condition for paymentStatus
  });
  if (record) {
    return res.status(200).json({data: record});
  } else {
    return res.status(404).json({error: 'Transer not found'});
  }
});
module.exports = router;
