const express = require('express');
const router = express.Router();
const billingService = require('../../../services/cms/BillingInfoService');
const BillingService = new billingService();
const {body, validationResult} = require('express-validator');

// Middleware for validating billing information
const validateBillingInfo = [
  body('school').notEmpty().withMessage('School ID is required'),
  body('packageId').notEmpty().withMessage('Package ID is required'),
  body('endDate')
    .notEmpty()
    .withMessage('End date is required')
    .isISO8601()
    .toDate()
    .withMessage('Invalid end date format'),
  body('totalCost')
    .notEmpty()
    .withMessage('Total cost is required')
    .isNumeric()
    .withMessage('Total cost must be a number'),
  body('numberOfLearners')
    .notEmpty()
    .withMessage('Number of learners is required')
    .isNumeric()
    .withMessage('Number of learners must be a number'),
  body('status')
    .notEmpty()
    .withMessage('Status is required')
    .isIn(['active', 'inactive'])
    .withMessage('Invalid status'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(404).json({success: false, errors: errors.array()});
    }
    next();
  },
];

// Create billing information
// router.post('/', validateBillingInfo, async (req, res) => {
//   try {
//     const billingInfoData = req.body;
//     const newBillingInfo = await BillingService.createBillingInfo(billingInfoData);
//     res.status(201).json({success: true, data: newBillingInfo});
//   } catch (error) {
//     res.status(404).json({success: false, message: error.message});
//   }
// });

// Get billing information by school ID
router.get('/:id', async (req, res) => {
  try {
    const school = req.params.id;
    const billingInfo = await BillingService.getBillingInfoByschool(school);
    if (!billingInfo) {
      return res.status(404).json({success: false, message: 'Billing information not found for the school'});
    }
    res.status(200).json({success: true, data: billingInfo});
  } catch (error) {
    res.status(404).json({success: false, message: error.message});
  }
});

// Update billing information
// router.patch('/:id', validateBillingInfo, async (req, res) => {
//   try {
//     const billingInfoId = req.params.id;
//     const updates = req.body;
//     const updatedBillingInfo = await BillingService.updateBillingInfo(billingInfoId, updates);
//     res.status(200).json({success: true, data: updatedBillingInfo});
//   } catch (error) {
//     res.status(404).json({success: false, message: error.message});
//   }
// });

// Delete billing information
// router.delete('/:id', async (req, res) => {
//   try {
//     const billingInfoId = req.params.id;
//     const deletedBillingInfo = await BillingService.deleteBillingInfo(billingInfoId);
//     res.status(200).json({success: true, data: deletedBillingInfo});
//   } catch (error) {
//     res.status(404).json({success: false, message: error.message});
//   }
// });

// Get paginated billing information

module.exports = router;
