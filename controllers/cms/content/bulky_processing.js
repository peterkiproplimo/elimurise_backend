const express = require('express');
const router = express.Router();
const logger = require('../../../utils/logger');
const Substrand = require('../../../models/cms/content/substrand');
const Strand = require('../../../models/cms/content/strand');

const {validationResult} = require('express-validator');
const mongoose = require('mongoose');
const multer = require('multer');
const csvParser = require('csv-parser');
const fs = require('fs');

// Set up multer for file uploads
const upload = multer({dest: 'uploads/'});

// Define the route to handle the CSV file upload
router.post('/substrands', upload.single('csvFile'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(404).json({success: false, error: 'No file uploaded'});
    }
    const strand = req.body.strand;

    const substrands = [];
    const errors = [];
    let currentStrand = ''; // Keep track of the current strand
    let currentSubstrand = ''; // Keep track of the current substrand

    fs.createReadStream(req.file.path)
      .pipe(csvParser())
      .on('data', data => {
        try {
          // Check for a new strand
          if (data.strand && data.strand.trim() !== '') {
            currentStrand = data.strand;

            // Look up the strand by name (use promises instead of async/await)
          }

          // Handle substrand row
          if (data.name && data.name.trim() !== '') {
            const row = {
              row_number: parseInt(data.row_number, 10) || 0,
              name: data.name, // This is the substrand name
              strand: strand, // Assign the strand ID if found
              is_child: data.is_child === 'true',
              parent: data.parent ? data.parent : undefined,
              children: data.children ? data.children : undefined,
              learning_outcome: data.learning_outcome,
              indicators: [], // Initialize indicators as an array
            };

            // Update the current substrand
            currentSubstrand = row.name;
            substrands.push(row);
          }

          // Handle indicators for the most recent substrand
          if (data.indicators_description) {
            const indicator = {
              description: data.indicators_description,
              EE: data.indicators_EE,
              ME: data.indicators_ME,
              AE: data.indicators_AE,
              BE: data.indicators_BE,
            };

            // Find the last added substrand to add the indicator
            const lastSubstrand = substrands[substrands.length - 1];
            console.log(lastSubstrand);

            // Ensure indicators are added to the current substrand
            if (lastSubstrand) {
              if (!lastSubstrand.indicators) {
                lastSubstrand.indicators = [];
              }
              lastSubstrand.indicators.push([indicator]);
            } else {
              errors.push({data, error: 'No valid substrand found for indicator'});
            }
          }
        } catch (error) {
          console.log(error);
          errors.push({data, error: error.message});
        }
      })
      .on('end', async () => {
        fs.unlinkSync(req.file.path); // Delete the uploaded file

        try {
          const processedData = await Promise.all(
            substrands.map(async substrand => {
              try {
                const existingSubstrand = await Substrand.findOne({name: substrand.name});
                if (existingSubstrand) {
                  throw new Error('Substrand already exists');
                }

                return await Substrand.create(substrand);
              } catch (error) {
                errors.push({data: substrand, error: error.message});
                return null;
              }
            }),
          );

          const filteredSubstrands = processedData.filter(substrand => substrand !== null);
          res.json({success: true, data: filteredSubstrands, errors});
        } catch (error) {
          res.status(404).json({success: false, error: 'Error inserting data into the database'});
        }
      });
  } catch (error) {
    console.error(error);
    res.status(404).json({success: false, error: 'Error processing CSV file'});
  }
});
const {Parser} = require('json2csv'); // For converting JSON to CSV

// Export route to get substrands for a given strand and export them as CSV

module.exports = router;
