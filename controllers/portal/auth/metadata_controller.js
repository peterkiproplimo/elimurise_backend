const express = require('express');
const router = express.Router();

const data = require('../../../utils/Counties');

function county_data(req, res) {
  const county_code = parseInt(req.query.county_code, 10);

  if (!isNaN(county_code)) {
    const found_county = data.counties.find(county => county.code === county_code);

    if (found_county) {
      return res.status(200).json({data: found_county, status: 200});
    }
    return res.status(404).json({
      error: `County with the code ${county_code} not found`,
      status: 404,
    });
  }

  return res.status(201).json({data: data.counties, status: 200});
}

// Routes
router.get('/counties', county_data);

module.exports = router;
