const logger = require('../../../utils/logger');
const Strand = require('../../../models/cms/content/strand'); // Update the path accordingly
const {validationResult} = require('express-validator');
const PAGE_SIZE = 10;
const Joi = require('joi');
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const multer = require('multer');
const csvParser = require('csv-parser');
const fs = require('fs');
const substrand = require('../../../models/cms/content/substrand');
const upload = multer({dest: 'uploads/'});
const {Parser} = require('json2csv'); // For converting JSON to CSV
const LearningArea = require('../../../models/cms/content/learning_area');

// Validation schema using Joi

// Create Strand
router.post('/', async (req, res) => {
  const session = await Strand.startSession();
  session.startTransaction();

  try {
    const {name, learning_area, term, theme, row_number} = req.body;

    if (row_number !== undefined) {
      // Find all strands in the same learning_area with row_number >= the specified row_number
      const strandsToUpdate = await Strand.find({
        learning_area,
        row_number: {$gte: row_number},
      }).session(session);

      // Increment the row_number of all subsequent records
      for (const strand of strandsToUpdate) {
        await Strand.updateOne({_id: strand._id}, {$inc: {row_number: 1}}, {session});
      }
    }

    const newStrand = await Strand.create(
      [
        {
          name,
          learning_area,
          term,
          theme,
          row_number,
        },
      ],
      {session},
    );

    await session.commitTransaction();
    session.endSession();

    res.status(201).json({
      success: true,
      data: newStrand[0], // newStrand is an array since we used create with session
      message: 'Created Successfully',
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    logger.error(`Error creating strand: ${err.message}`);
    res.status(404).json({success: false, message: 'Failed to create strand'});
  }
});

router.put('/', async (req, res) => {
  try {
    const {name, learning_area, term, theme, _id} = req.body;

    const newStrand = await Strand.findByIdAndUpdate(
      _id,
      {
        name,
        learning_area,
        term,
        theme,
      },
      {new: true},
    );

    res.status(201).json({
      success: true,
      data: newStrand,
      message: 'Updated Successfully',
    });
  } catch (err) {
    logger.error(`Error creating strand: ${err.message}`);
    res.status(404).json({success: false, message: 'Failed to create strand'});
  }
});

router.get('/:learning_area/:term', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const sortField = req.query.sortField || 'name'; // Default sort field is 'name'
    const sortOrder = req.query.sortOrder === 'desc' ? -1 : 1; // Default sort order is ascending

    const {learning_area, term} = req.params;
    if (isNaN(term)) {
      return res.status(404).json({
        success: false,
        error: 'Invalid term format. Term must be a number.',
      });
    }
    if (!mongoose.Types.ObjectId.isValid(learning_area)) {
      return res.status(404).json({
        success: false,
        error: 'Invalid ObjectId format ',
      });
    }
    const searchName = req.query.search || '';

    const query = {
      learning_area,
      term,
      name: {$regex: new RegExp(searchName, 'i')},
    };

    const totalStrands = await Strand.countDocuments(query);
    const total_pages = Math.ceil(totalStrands / limit);

    const strandsList = await Strand.find(query)
      // .sort({createdAt: -1})

      .skip(skip)
      .limit(limit)
      .sort({[sortField]: sortOrder}) // Apply sorting here

      .populate({
        path: 'learning_area',
        select: 'name',
        populate: {
          path: 'grade_id',
          select: 'name',
        },
      });

    res.status(200).json({
      success: true,
      data: strandsList,
      pagination: {
        current_page: page,
        total: totalStrands,
        total_pages: total_pages,
        per_page: limit,
      },
      search: searchName,
    });
  } catch (error) {
    logger.error(`Internal Server Error: ${error.message}`);
    res.status(404).json({success: false, error: 'Internal Server Error'});
  }
});

// List All Strands (without filters)
router.get('/all', async (req, res) => {
  try {
    const strandsList = await Strand.find()
      .skip(skip)
      .limit(PAGE_SIZE)
      .populate({
        path: 'learning_area',
        select: 'name',
        populate: {
          path: 'grade_id',
          select: 'name',
        },
      });

    res.status(200).json({success: true, data: strandsList});
  } catch (error) {
    logger.error(`Failed to fetch strands: ${error.message}`);
    res.status(404).json({success: false, message: 'Internal Server Error'});
  }
});

router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * PAGE_SIZE;

    const {learning_area, term} = req.query;

    const query = {learning_area, term};

    const totalStrands = await Strand.countDocuments(query);
    const total_pages = Math.ceil(totalStrands / PAGE_SIZE);

    const strandsList = await Strand.find(query)
      .skip(skip)
      .limit(PAGE_SIZE)
      .populate({
        path: 'learning_area',
        select: 'name',
        populate: {
          path: 'grade_id',
          select: 'name',
        },
      });

    res.status(200).json({
      success: true,
      data: strandsList,
      pagination: {
        current_page: page,
        total: totalStrands,
        total_pages: total_pages,
        per_page: PAGE_SIZE,
      },
    });
  } catch (error) {
    logger.error(`Failed to fetch strands: ${error.message}`);
    res.status(404).json({success: false, message: 'Internal Server Error'});
  }
});

// Delete Strand
router.delete('/:strandId', async (req, res) => {
  try {
    const {strandId} = req.params;
    const sub = await substrand.find({strand: strandId});
    if (sub.length > 0) {
      return res.status(404).json({
        success: false,
        data: sub,
        message: 'Cannot delete, Linked to a substrand!',
      });
    }
    const deletedStrand = await Strand.findOneAndDelete({_id: strandId});

    if (deletedStrand) {
      res.status(200).json({
        success: true,
        data: deletedStrand,
        message: 'Deleted Successfully',
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'No record found to delete',
      });
    }
  } catch (error) {
    logger.error(`Failed to delete strand: ${error.message}`);
    res.status(404).json({success: false, error: 'Internal Server Error'});
  }
});
router.patch('/rows', async (req, res) => {
  const session = await Strand.startSession();

  try {
    await session.withTransaction(async () => {
      // Retrieve all unique learning areas
      const uniqueLearningAreas = await Strand.distinct('learning_area').session(session);

      // Iterate over each unique learning area
      for (const learningId of uniqueLearningAreas) {
        let rowNumber = 1;

        // Retrieve strands for the current learning area sorted by creation date
        const strands = await Strand.find({learning_area: learningId}).sort({createdAt: 1}).session(session);

        // Update each strand with the incremented row_number using findOneAndUpdate
        for (const strand of strands) {
          const updatedStrand = await Strand.findOneAndUpdate(
            {_id: strand._id},
            {$set: {row_number: rowNumber++}},
            {new: true, session},
          );
          // Ensure updatedStrand is not null before using it
          if (updatedStrand) {
            // You can log the updated strand if needed
            console.log('Updated Strand:', updatedStrand);
          }
        }
      }
    });

    console.log('Row numbers updated successfully.');
    return res.status(200).json({success: true, message: 'Row numbers updated successfully.'});
  } catch (error) {
    console.error('Error updating row numbers:', error);
    return res.status(404).json({success: false, message: 'Error updating row numbers.', error: error.message});
  } finally {
    session.endSession();
  }
});
router.post('/import', upload.single('csvFile'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(404).json({success: false, error: 'No file uploaded'});
    }
    const learning_area = req.body.learning_area;
    const strands = [];
    const errors = [];

    fs.createReadStream(req.file.path)
      .pipe(csvParser())
      .on('data', async data => {
        try {
          // Check if the strand name exists in the CSV data
          if (data.name && data.learning_area) {
            // Find the learning area from the database
            // const learningArea = await LearningArea.findById(learning_area);

            // if (!learningArea) {
            //   throw new Error(`Learning area "${learning_area}" not found.`);
            // }

            // Create a new strand object
            const strand = {
              name: data.name,
              learning_area: learning_area, // Link learning area by ID
              term: parseInt(data.term, 10), // Ensure term is a number
              theme: data.theme || 'N/A', // Default to 'N/A' if no theme
              row_number: parseInt(data.row_number, 10) || 0, // Default to 0 if not provided
            };

            // Push strand to the array
            strands.push(strand);
          }
        } catch (error) {
          console.error('Error processing row:', error.message);
          errors.push({data, error: error.message});
        }
      })
      .on('end', async () => {
        fs.unlinkSync(req.file.path); // Delete the uploaded file after processing

        try {
          // Insert all strands into the database
          const insertedStrands = await Promise.all(
            strands.map(async strand => {
              try {
                // Check if strand already exists
                const existingStrand = await Strand.findOne({name: strand.name});
                if (existingStrand) {
                  throw new Error(`Strand "${strand.name}" already exists.`);
                }
                return await Strand.create(strand);
              } catch (error) {
                errors.push({strand, error: error.message});
                return null;
              }
            }),
          );

          const filteredStrands = insertedStrands.filter(strand => strand !== null);
          res.json({success: true, data: filteredStrands, errors});
        } catch (error) {
          console.error('Error inserting strands into the database:', error);
          res.status(404).json({success: false, error: 'Error inserting data into the database'});
        }
      });
  } catch (error) {
    console.error('Error processing CSV file:', error);
    res.status(404).json({success: false, error: 'Error processing CSV file'});
  }
});

router.post('/export', async (req, res) => {
  const {strandId} = req.body; // Get strand name from query parameters

  // Sample JSON data (similar to your template)
  const jsonData = [
    {
      name: 'Mathematics Basics',
      learning_area: 'Mathematics', // This would be replaced with the actual _id from the database
      term: 1,
      theme: 'Introduction to Mathematics',
      row_number: 1,
    },
    {
      name: 'Advanced Algebra',
      learning_area: 'Mathematics', // This would be replaced with the actual _id from the database
      term: 2,
      theme: 'Algebraic Expressions',
      row_number: 2,
    },
    {
      name: 'Introduction to Science',
      learning_area: 'Science', // This would be replaced with the actual _id from the database
      term: 1,
      theme: 'Basic Science Concepts',
      row_number: 1,
    },
    {
      name: 'Physics Fundamentals',
      learning_area: 'Science', // This would be replaced with the actual _id from the database
      term: 2,
      theme: 'Kinematics and Dynamics',
      row_number: 2,
    },
    {
      name: 'Biology Overview',
      learning_area: 'Biology', // This would be replaced with the actual _id from the database
      term: 1,
      theme: 'Living Organisms',
      row_number: 1,
    },
    {
      name: 'Human Anatomy',
      learning_area: 'Biology', // This would be replaced with the actual _id from the database
      term: 3,
      theme: 'Human Body Systems',
      row_number: 2,
    },
  ];

  const csv = exportJsonToCsvNew(jsonData);
  res.header('Content-Type', 'text/csv');
  res.attachment(`${strandId}_substrands.csv`);
  res.send(csv);
});
function exportJsonToCsvNew(data) {
  const rows = [];

  // Loop through each strand
  data.forEach(strand => {
    rows.push({
      name: strand.name,
      learning_area: strand.learning_area, // You might want to replace this with actual learning area names if available
      term: strand.term,
      theme: strand.theme,
      row_number: strand.row_number,
    });
  });

  // Define CSV fields (headers)
  const fields = [
    {label: 'name', value: 'name'},
    {label: 'learning_area', value: 'learning_area'},
    {label: 'term', value: 'term'},
    {label: 'theme', value: 'theme'},
    // {label: 'row_number', value: 'row_number'},
  ];

  // Use json2csv to generate the CSV
  const parser = new Parser({fields});
  const csv = parser.parse(rows);
  console.log(rows);
  // Return the CSV content
  return csv;

  // Uncomment the line below to save the CSV file
  // fs.writeFileSync('strands_export.csv', csv);

  console.log('CSV file successfully created.');
}

module.exports = router;
