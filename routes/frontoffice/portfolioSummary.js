const express = require("express");

const {
  generatePortfolioSummaryNew,
  generatePortfolioPDF
} = require("../../controllers/frontoffice/portfolioSummaryController");

const router = express.Router();

// Portfolio summary routes
router.get('/:studentId', generatePortfolioSummaryNew);
// Also allow POST with JSON body (e.g., to send accessToken)
router.post('/:studentId', generatePortfolioSummaryNew);
router.post('/:studentId/pdf', generatePortfolioPDF);

module.exports = router;
