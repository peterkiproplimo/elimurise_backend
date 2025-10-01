const express = require('express');
const router = express.Router();
const logger = require('../../../utils/logger');
const Substrand = require('../../../models/cms/content/substrand');
const {validationResult} = require('express-validator');
const mongoose = require('mongoose');
const multer = require('multer');
const csvParser = require('csv-parser');
const fs = require('fs');
const Strand = require('../../../models/cms/content/strand');
const {Parser} = require('json2csv'); // For converting JSON to CSV

// Set up multer for file uploads
const upload = multer({dest: 'uploads/'});

const PAGE_SIZE = 10;

// router.post('/', async (req, res) => {
//   try {
//     const {is_child, parent, name, strand, learning_outcome, indicators} = req.body;

//     let newSubstrand;
//     const filtered_indicators = indicators.filter(indicator => {
//       return indicator[0].description !== '';
//     });
//     console.log(filtered_indicators);
//     if (is_child && parent) {
//       // If it's a child substrand and there's a parent specified
//       newSubstrand = await Substrand.create({
//         name,
//         strand,
//         is_child,
//         parent,
//         learning_outcome,
//       });

//       // Update the parent's children field with the newly created child's ID
//       await Substrand.findByIdAndUpdate(parent, {
//         $push: {children: newSubstrand._id}, // Assuming children is an array
//       });
//     } else {
//       // If it's not a child substrand or doesn't have a parent specified
//       newSubstrand = await Substrand.create({
//         name,
//         strand,
//         is_child,
//         learning_outcome,
//       });
//     }
//     // Update indicators if present in the request body
//     if (filtered_indicators) {
//       newSubstrand.indicators = filtered_indicators;
//     }

//     // Save the updated substrand
//     const updatednewSubstrand = await newSubstrand.save();

//     return res.status(201).json({
//       success: true,
//       data: updatednewSubstrand,
//       message: 'Created Successfully',
//     });
//   } catch (err) {
//     logger.error(`Error creating substrand: ${err.message}`);
//     return res.status(404).json({
//       success: false,
//       message: 'Failed to create substrand ' + `${err.message}`,
//     });
//   }
// });
router.post('/', async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      is_child,
      parent,
      name,
      strand,
      learning_outcome,
      key_inquiry_questions,
      core_competencies,
      values,
      contemporary_issues,
      links_to_learning_areas,
      indicators,
      row_number,
      suggested_assessment_methods,
      suggested_learning_resources,
      non_formal_activities,
    } = req.body;

    let newSubstrand;
    const filtered_indicators = indicators?.filter(indicator => {
      return indicator[0].description !== '';
    });

    if (is_child && parent) {
      // If it's a child substrand and there's a parent specified
      newSubstrand = await Substrand.create({
        name,
        strand,
        is_child,
        parent,
        learning_outcome,
        key_inquiry_questions,
        core_competencies,
        values,
        contemporary_issues,
        links_to_learning_areas,
        suggested_assessment_methods,
        suggested_learning_resources,
        non_formal_activities,
      });

      // Update the parent's children field with the newly created child's ID
      await Substrand.findByIdAndUpdate(parent, {
        $push: {children: newSubstrand._id},
      }).session(session);
    } else {
      if (row_number !== undefined) {
        // If row_number is provided, add the substrand in between existing rows
        const substrands = await Substrand.find({
          strand: strand,
          row_number: {$gte: row_number},
        }).session(session);

        // Update row numbers of substrands >= row_number
        for (const substrand of substrands) {
          await Substrand.findOneAndUpdate({_id: substrand._id}, {$inc: {row_number: 1}}, {session});
        }

        newSubstrand = await Substrand.create({
          name,
          strand,
          is_child,
          learning_outcome,
          key_inquiry_questions,
          core_competencies,
          values,
          contemporary_issues,
          links_to_learning_areas,
          row_number,
          suggested_assessment_methods,
          suggested_learning_resources,
          non_formal_activities,
        });
      } else {
        // If row_number is not provided, create the substrand without adding in between
        newSubstrand = await Substrand.create({
          name,
          strand,
          is_child,
          learning_outcome,
          key_inquiry_questions,
          core_competencies,
          values,
          contemporary_issues,
          links_to_learning_areas,
          suggested_assessment_methods,
          suggested_learning_resources,
          non_formal_activities,
        });
      }
    }

    // Update indicators if present in the request body
    if (filtered_indicators) {
      newSubstrand.indicators = filtered_indicators;
    }

    // Save the updated substrand
    await newSubstrand.save();

    await session.commitTransaction();
    session.endSession();

    return res.status(201).json({
      success: true,
      data: newSubstrand,
      message: 'Created Successfully',
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.log(err);
    logger.error(`Error creating substrand: ${err.message}`);
    return res.status(404).json({
      success: false,
      message: 'Failed to create substrand ' + `${err.message}`,
    });
  }
});
router.put('/relocate', async (req, res) => {
  try {
    const {strand, substrands} = req.body;

    // Check if the target strand exists
    const targetStrand = await Strand.findById(strand);
    if (!targetStrand) {
      return res.status(404).json({success: false, message: 'Target strand not found'});
    }

    // Check if the substrands exist and update their strand reference
    const updatedSubstrands = await Promise.all(
      substrands.map(async substrandId => {
        const existingSubstrand = await Substrand.findById(substrandId);

        if (!existingSubstrand) {
          throw new Error(`Substrand with ID ${substrandId} not found`);
        }

        // Update the strand reference to the new one
        existingSubstrand.strand = strand;
        return existingSubstrand.save(); // Save updated substrand
      }),
    );

    return res.status(200).json({
      success: true,
      data: updatedSubstrands,
      message: 'Substrands relocated successfully',
    });
  } catch (err) {
    logger.error(`Error relocating substrands: ${err.message}`);
    return res.status(404).json({
      success: false,
      message: 'Failed to relocate substrands: ' + err.message,
    });
  }
});

// Assuming you have the Substrand model and required dependencies imported
router.put('/:id', async (req, res) => {
  try {
    const {
      name,
      strand,
      is_child,
      parent,
      learning_outcome,
      key_inquiry_questions,
      core_competencies,
      values,
      contemporary_issues,
      links_to_learning_areas,
      indicators,
      number_of_lessons,
      suggested_learning_experiences,
      suggested_assessment_methods,
      suggested_learning_resources,
      non_formal_activities,
    } = req.body;

    const substrandId = req.params.id;
    const filtered_indicators = indicators?.filter(indicator => {
      return indicator[0].description !== '';
    });

    // Check if the substrand exists
    const existingSubstrand = await Substrand.findById(substrandId);
    if (!existingSubstrand) {
      return res.status(404).json({success: false, message: 'Substrand not found'});
    }

    // Update the substrand properties
    existingSubstrand.name = name;
    existingSubstrand.strand = strand;
    existingSubstrand.is_child = is_child;
    existingSubstrand.parent = parent;
    existingSubstrand.learning_outcome = learning_outcome;
    existingSubstrand.key_inquiry_questions = key_inquiry_questions;
    existingSubstrand.core_competencies = core_competencies;
    existingSubstrand.values = values;
    existingSubstrand.contemporary_issues = contemporary_issues;
    existingSubstrand.links_to_learning_areas = links_to_learning_areas;
    existingSubstrand.number_of_lessons = number_of_lessons;
    existingSubstrand.suggested_learning_experiences = suggested_learning_experiences;
    existingSubstrand.suggested_assessment_methods = suggested_assessment_methods;
    existingSubstrand.suggested_learning_resources = suggested_learning_resources;
    existingSubstrand.non_formal_activities = non_formal_activities;

    // Update indicators if present in the request body
    if (filtered_indicators) {
      existingSubstrand.indicators = filtered_indicators;
    }

    // Save the updated substrand
    const updatedSubstrand = await existingSubstrand.save();

    return res.status(200).json({
      success: true,
      data: updatedSubstrand,
      message: 'Updated Successfully',
    });
  } catch (err) {
    logger.error(`Error updating substrand: ${err.message}`);
    return res.status(404).json({
      success: false,
      message: 'Failed to update substrand ' + `${err.message}`,
    });
  }
});
router.get('/byStrand/:strandId', async (req, res) => {
  try {
    const strandId = req.params.strandId;
    if (!mongoose.Types.ObjectId.isValid(strandId)) {
      return res.status(404).json({
        success: false,
        error: 'Invalid ObjectId format for strandId',
      });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const searchName = req.query.search || '';
    const sortField = req.query.sortField || 'name'; // Default sort field is 'name'
    const sortOrder = req.query.sortOrder === 'desc' ? -1 : 1; // Default sort order is ascending

    const query = {
      strand: strandId,
      name: {$regex: new RegExp(searchName, 'i')},
    };

    const totalSubstrands = await Substrand.countDocuments(query);
    const total_pages = Math.ceil(totalSubstrands / limit);

    const substrands = await Substrand.find(query)
      .sort({[sortField]: sortOrder}) // Apply sorting here
      .skip(skip)
      .limit(limit);

    res.status(200).json({
      success: true,
      data: substrands,
      pagination: {
        current_page: page,
        total: totalSubstrands,
        total_pages: total_pages,
        per_page: limit,
      },
      search: searchName,
      sort: {field: sortField, order: sortOrder},
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
    });
  }
});

router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.page) || 1;
    const skip = (page - 1) * PAGE_SIZE;

    const searchName = req.query.name || '';
    const query = {name: {$regex: new RegExp(searchName, 'i')}};

    const substrandsList = await Substrand.find(query)

      .skip(skip)
      .limit(PAGE_SIZE)
      .populate('strand', 'name');

    const totalSubstrands = await Substrand.countDocuments(query);
    const total_pages = Math.ceil(totalSubstrands / PAGE_SIZE);

    res.status(200).json({
      success: true,
      data: substrandsList,
      pagination: {
        current_page: page,
        total: totalSubstrands,
        total_pages: total_pages,
        per_page: PAGE_SIZE,
      },
      search: searchName,
    });
  } catch (error) {
    logger.error(`Internal Server Error: ${error.message}`);
    res.status(404).json({success: false, error: 'Internal Server Error'});
  }
});
router.delete('/:substrandId', async (req, res) => {
  try {
    const substrandId = req.params.substrandId;
    const deletedSubstrand = await Substrand.findOneAndDelete({
      _id: substrandId,
    });
    if (deletedSubstrand) {
      res.status(200).json({
        success: true,
        data: deletedSubstrand,
        message: 'Deleted Successfully',
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'No record found to delete',
      });
    }
  } catch (error) {
    logger.error(`Failed to delete substrand: ${error.message}`);
    res.status(404).json({success: false, error: 'Internal Server Error'});
  }
});
router.patch('/rows', async (req, res) => {
  const session = await Substrand.startSession();

  try {
    await session.withTransaction(async () => {
      // Retrieve all unique strands
      const uniqueStrands = await Substrand.distinct('strand').session(session);

      // Iterate over each unique strand
      for (const strandId of uniqueStrands) {
        let rowNumber = 1;

        // Retrieve substrands for the current strand sorted by creation date
        const substrands = await Substrand.find({strand: strandId}).sort({createdAt: 1}).session(session);

        // Update each substrand with the incremented row_number using findOneAndUpdate
        for (const substrand of substrands) {
          const updatedSubstrand = await Substrand.findOneAndUpdate(
            {_id: substrand._id},
            {$set: {row_number: rowNumber++}},
            {new: true, session},
          );
          // Ensure updatedSubstrand is not null before using it
          if (updatedSubstrand) {
            // You can log the updated substrand if needed
            console.log('Updated Substrand:', updatedSubstrand);
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

// Define the route to handle the CSV file upload
router.post('/import', upload.single('csvFile'), (req, res) => {
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
                const existingSubstrand = await Substrand.findOne({name: substrand.name, strand: strand});
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

router.post('/export', async (req, res) => {
  const {strandId} = req.body; // Get strand name from query parameters

  // Sample JSON data (similar to your template)
  const jsonData = [
    {
      name: 'Substrand1 toj',
      learning_outcome: 'Learning Outcome 1',
      indicators: [
        {
          Indicator_id: 1,
          indicators_description: 'Description 1',
          indicators_EE: 'EE 1',
          indicators_ME: 'ME 1',
          indicators_AE: 'AE 1',
          indicators_BE: 'BE 1',
        },
        {
          Indicator_id: 1,
          indicators_description: 'Description 2',
          indicators_EE: 'EE 1',
          indicators_ME: 'ME 1',
          indicators_AE: 'AE 1',
          indicators_BE: 'BE 1',
        },
        {
          Indicator_id: 2,
          indicators_description: 'Description 3',
          indicators_EE: 'EE 1',
          indicators_ME: 'ME 1',
          indicators_AE: 'AE 1',
          indicators_BE: 'BE 1',
        },
      ],
    },
    {
      name: 'Substrand1-tohgh',
      learning_outcome: 'Learning Outcome 1',
      indicators: [
        {
          Indicator_id: 1,
          indicators_description: 'Description 1',
          indicators_EE: 'EE 1',
          indicators_ME: 'ME 1',
          indicators_AE: 'AE 1',
          indicators_BE: 'BE 1',
        },
        {
          Indicator_id: 1,
          indicators_description: 'Description 2',
          indicators_EE: 'EE 1',
          indicators_ME: 'ME 1',
          indicators_AE: 'AE 1',
          indicators_BE: 'BE 1',
        },
        {
          Indicator_id: 2,
          indicators_description: 'Description 3',
          indicators_EE: 'EE 1',
          indicators_ME: 'ME 1',
          indicators_AE: 'AE 1',
          indicators_BE: 'BE 1',
        },
      ],
    },
    {
      name: 'Substrand2-tyih',
      learning_outcome: 'Learning Outcome 2',
      indicators: [
        {
          Indicator_id: 2,
          indicators_description: 'Description 2',
          indicators_EE: 'EE 2',
          indicators_ME: 'ME 2',
          indicators_AE: 'AE 2',
          indicators_BE: 'BE 2',
        },
      ],
    },
  ];
  const csv = exportJsonToCsvNew(jsonData);
  res.header('Content-Type', 'text/csv');
  res.attachment(`${strandId}_substrands.csv`);
  res.send(csv);
});

// Function to convert JSON to CSV
function exportJsonToCsvNew(data) {
  const rows = [];

  // Loop through each strand
  data.forEach(substrand => {
    substrand.indicators.forEach((indicator, index) => {
      rows.push({
        name: index === 0 ? substrand.name : '',
        learning_outcome: index === 0 ? substrand.learning_outcome : '',
        Indicator_id: indicator.Indicator_id,
        indicators_description: indicator.indicators_description,
        indicators_EE: indicator.indicators_EE,
        indicators_ME: indicator.indicators_ME,
        indicators_AE: indicator.indicators_AE,
        indicators_BE: indicator.indicators_BE,
      });
    });
  });

  // Define CSV fields (headers)
  const fields = [
    {label: 'name', value: 'name'},
    {label: 'learning_outcome', value: 'learning_outcome'},
    // {label: 'Indicator_id', value: 'Indicator_id'},
    {label: 'indicators_description', value: 'indicators_description'},
    {label: 'indicators_EE', value: 'indicators_EE'},
    {label: 'indicators_ME', value: 'indicators_ME'},
    {label: 'indicators_AE', value: 'indicators_AE'},
    {label: 'indicators_BE', value: 'indicators_BE'},
  ];

  // Use json2csv to generate the CSV
  const parser = new Parser({fields});
  const csv = parser.parse(rows);
  return csv;
  // Save the CSV file
  // fs.writeFileSync('substrands_export.csv', csv);

  console.log('CSV file successfully created.');
}

// Call the function to export JSON to CSV

router.post('/export', async (req, res) => {
  const {strandId} = req.body; // Get strand name from query parameters

  try {
    // Fetch the strand by its name
    const strand = await Strand.findById(strandId);
    if (!strand) {
      return res.status(404).json({success: false, error: 'Strand not found'});
    }

    // Find substrands related to the strand
    const substrands = await Substrand.find({strand: strand._id}).populate('strand');
    const substrandsJSON = substrands.map(substrand => {
      const flattenedIndicators = substrand.indicators.flat();
      console.log(flattenedIndicators);
      // Flatten nested arrays
      return {
        ...substrand.toJSON(), // Convert substrand document to plain JS object
        indicators: flattenedIndicators, // Replace indicators with the flattened version
      };
    });
    console.log(substrandsJSON);

    if (substrands.length === 0) {
      return res.status(404).json({success: false, error: 'No substrands found for the specified strand'});
    }

    // Convert to CSV using json2csv
    const fields = [
      'strand',
      'name',
      'learning_outcome',
      'indicators.description',
      'indicators.EE',
      'indicators.ME',
      'indicators.AE',
      'indicators.BE',
    ];
    // const json2csvParser = [
    //   {
    //     name: 'Substrand1 toj',
    //     learning_outcome: 'Learning Outcome 1',
    //     indicators: [
    //       {
    //         Indicator_id: 1,
    //         indicators_description: 'Description 1',
    //         indicators_EE: 'EE 1',
    //         indicators_ME: 'ME 1',
    //         indicators_AE: 'AE 1',
    //         indicators_BE: 'BE 1',
    //       },
    //       {
    //         Indicator_id: 1,
    //         indicators_description: 'Description 2',
    //         indicators_EE: 'EE 1',
    //         indicators_ME: 'ME 1',
    //         indicators_AE: 'AE 1',
    //         indicators_BE: 'BE 1',
    //       },
    //       {
    //         Indicator_id: 2,
    //         indicators_description: 'Description 3',
    //         indicators_EE: 'EE 1',
    //         indicators_ME: 'ME 1',
    //         indicators_AE: 'AE 1',
    //         indicators_BE: 'BE 1',
    //       },
    //     ],
    //   },
    //   {
    //     name: 'Substrand1-tohgh',
    //     learning_outcome: 'Learning Outcome 1',
    //     indicators: [
    //       {
    //         Indicator_id: 1,
    //         indicators_description: 'Description 1',
    //         indicators_EE: 'EE 1',
    //         indicators_ME: 'ME 1',
    //         indicators_AE: 'AE 1',
    //         indicators_BE: 'BE 1',
    //       },
    //       {
    //         Indicator_id: 1,
    //         indicators_description: 'Description 2',
    //         indicators_EE: 'EE 1',
    //         indicators_ME: 'ME 1',
    //         indicators_AE: 'AE 1',
    //         indicators_BE: 'BE 1',
    //       },
    //       {
    //         Indicator_id: 2,
    //         indicators_description: 'Description 3',
    //         indicators_EE: 'EE 1',
    //         indicators_ME: 'ME 1',
    //         indicators_AE: 'AE 1',
    //         indicators_BE: 'BE 1',
    //       },
    //     ],
    //   },
    //   {
    //     name: 'Substrand2-tyih',
    //     learning_outcome: 'Learning Outcome 2',
    //     indicators: [
    //       {
    //         Indicator_id: 2,
    //         indicators_description: 'Description 2',
    //         indicators_EE: 'EE 2',
    //         indicators_ME: 'ME 2',
    //         indicators_AE: 'AE 2',
    //         indicators_BE: 'BE 2',
    //       },
    //     ],
    //   },
    // ];
    const csv = exportJsonToCsv(substrandsJSON);

    // Set headers and send the CSV file as a response
    res.header('Content-Type', 'text/csv');
    res.attachment(`${strandId}_substrands.csv`);
    res.send(csv);
  } catch (error) {
    console.error('Error exporting data:', error);
    res.status(404).json({success: false, error: 'An error occurred while exporting the data'});
  }
});
function exportJsonToCsv(data) {
  const rows = [];

  // Loop through each strand
  data.forEach(substrand => {
    substrand.indicators.forEach((indicator, index) => {
      rows.push({
        name: index === 0 ? substrand.name : '',
        learning_outcome: index === 0 ? substrand.learning_outcome : '',
        Indicator_id: indicator.Indicator_id,
        indicators_description: indicator.indicators_description,
        indicators_EE: indicator.EE,
        indicators_ME: indicator.ME,
        indicators_AE: indicator.AE,
        indicators_BE: indicator.BE,
      });
    });
  });

  // Define CSV fields (headers)
  const fields = [
    {label: 'name', value: 'name'},
    {label: 'learning_outcome', value: 'learning_outcome'},
    {label: 'Indicator_id', value: 'Indicator_id'},
    {label: 'indicators_description', value: 'indicators_description'},
    {label: 'indicators_EE', value: 'indicators_EE'},
    {label: 'indicators_ME', value: 'indicators_ME'},
    {label: 'indicators_AE', value: 'indicators_AE'},
    {label: 'indicators_BE', value: 'indicators_BE'},
  ];

  // Use json2csv to generate the CSV
  const parser = new Parser({fields});
  const csv = parser.parse(rows);

  // Save the CSV file
  return csv;
}
// Call the function to update row numbers

module.exports = router;
