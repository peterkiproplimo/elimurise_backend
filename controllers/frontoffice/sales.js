const express = require('express');
const router = express.Router();
const OverallStat = require('../../models/frontoffice/OverallStat');

// GET /sales - Get Sales
router.get('/sales', async (_, res) => {
  try {
    const overallStats = await OverallStat.find();

    res.status(200).json(overallStats[0]);
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
});

module.exports = router;
