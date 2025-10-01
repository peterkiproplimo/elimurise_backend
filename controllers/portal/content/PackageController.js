const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
let imgPath = path.resolve('img', 'hero.png');

const packageService = require('../../../services/cms/PackageService');
const PackageService = new packageService();
const billingService = require('../../../services/cms/BillingInfoService');
const schoolService = require('../../../services/portal/SchoolService');

router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const paginatedPackages = await PackageService.getPaginatedPackages(page, limit);
    res.status(200).json({...paginatedPackages});
  } catch (error) {
    res.status(404).json({message: error.message});
  }
});

module.exports = router;
