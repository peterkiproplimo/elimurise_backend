const express = require('express');
const router = express.Router();
const packageService = require('../../../services/cms/PackageService');
const PackageService = new packageService();
const {body, validationResult} = require('express-validator');

// Middleware for validating package data
const validatePackageData = [
  body('name')
    .notEmpty()
    .withMessage('Name is required')
    .custom(async value => {
      const existingPackage = await PackageService.doesPackageExist(value);

      if (existingPackage) {
        throw new Error('Package with this name already exists');
      }
    }),
  body('description').notEmpty().withMessage('Description is required'),
  body('pricePerLearner')
    .notEmpty()
    .withMessage('Price per learner is required')
    .isNumeric()
    .withMessage('Price must be a number'),
  body('duration').notEmpty().withMessage('Duration is required').isNumeric().withMessage('Duration must be a number'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(404).json({success: false, errors: errors.array()});
    }
    next();
  },
];

// Create a new package
router.post('/', validatePackageData, async (req, res) => {
  try {
    const packageData = req.body;
    const newPackage = await PackageService.createPackage(packageData);
    res.status(201).json({success: true, data: newPackage});
  } catch (error) {
    res.status(404).json({success: false, message: error.message});
  }
});
// Get a package by ID
router.get('/:id', async (req, res) => {
  try {
    const packageId = req.params.id;
    const foundPackage = await PackageService.getPackageById(packageId);
    if (!foundPackage) {
      return res.status(404).json({success: false, message: 'Package not found'});
    }
    res.status(200).json({success: true, data: foundPackage});
  } catch (error) {
    res.status(404).json({success: false, message: error.message});
  }
});

// Update a package
router.put('/:id', async (req, res) => {
  try {
    const packageId = req.params.id;
    const updates = req.body;
    const updatedPackage = await PackageService.updatePackage(packageId, updates);
    res.status(200).json({success: true, data: updatedPackage});
  } catch (error) {
    res.status(404).json({success: false, message: error.message});
  }
});

// Delete a package
router.delete('/:id', async (req, res) => {
  try {
    const packageId = req.params.id;
    const deletedPackage = await PackageService.deletePackage(packageId);
    res.status(200).json({success: true, data: deletedPackage, message: 'Deleted successifully!'});
  } catch (error) {
    res.status(404).json({success: false, message: error.message});
  }
});

// Get paginated packages
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || '';
    const query = {name: {$regex: new RegExp(search, 'i')}};
    const paginatedPackages = await PackageService.getPaginatedPackages(page, limit, query);
    return res.status(200).json({success: true, ...paginatedPackages});
  } catch (error) {
    return res.status(404).json({success: false, message: error.message});
  }
});

module.exports = router;
// Other routes remain unchanged...
