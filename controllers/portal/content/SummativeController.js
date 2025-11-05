const express = require('express');
const app = express();
const path = require('path');
const Comments = require('../../../models/portal/content/Comments');
const ReportGenerationService = require('../../../services/ReportGenerationService');
const reportUtils = require('../../../utils/reportUtils');
const reportTemplates = require('../../../utils/reportTemplates');

app.set('view engine', 'ejs');
app.set('views', path.join('views'));

const router = express.Router();
const summativeAssessment = require('../../../services/portal/SummativeAssessmentService'); // Adjust the path as necessary
const SummativeAssessment = require('../../../models/portal/content/SummativeAssessment'); // Adjust the path as necessary
const LearningArea = require('../../../models/cms/content/learning_area'); // Adjust the path as necessary
const Stream = require('../../../models/portal/content/Stream'); // Adjust the path as necessary
const Term = require('../../../models/portal/content/Term');
const wkhtmltopdf = require('wkhtmltopdf');
const {checkPermission} = require('../../../middleware/portal-auth');

const Joi = require('joi');
const Enrollment = require('../../../models/portal/content/Enrollment');
const fs = require('fs');
const pdf = require('html-pdf');
const Grade = require('../../../models/cms/content/grade');
const Learner = require('../../../models/portal/content/Learner');
const Test = require('../../../models/portal/content/Test');
const Jimp = require('jimp');
const {generateThumbnail} = require('../../../utils/thumbnail');
const PlDescriptorService = require('../../../services/cms/PlDescriptor'); // Import the service

const testSchema = Joi.object({
  name: Joi.string().required(),
  term: Joi.string().required(),
  grade: Joi.string().required(),
});

const validateTest = (req, res, next) => {
  const {error} = testSchema.validate(req.body);
  if (error) {
    return res.status(404).json({error: error.details[0].message});
  }
  next();
};

// Create a new test
// router.post('/', validateTest, async (req, res) => {
//   try {
//     let current_session = req?.current_session;
//     const test = await testService.({...req.body, session: current_session});
//     res.status(200).json({success: true, data: test});
//   } catch (error) {
//     res.status(404).json({success: false, error: error.message});
//   }
// });kk
router.patch('/publish/:id', checkPermission('tests', 'publish'), async (req, res) => {
  try {
    const assessmentId = req.params.id;

    // Validate assessment ID
    if (!assessmentId) {
      return res.status(400).json({error: 'Assessment ID is required'});
    }

    // Find the assessment
    const assessment = await SummativeAssessment.findById(assessmentId);

    if (!assessment) {
      return res.status(404).json({error: 'Assessment not found'});
    }

    // Toggle the isPublished field
    const updatedAssessment = await SummativeAssessment.findByIdAndUpdate(
      assessmentId,
      {isPublished: !assessment.isPublished},
      {new: true},
    );

    res.status(200).json({
      message: `Assessment ${updatedAssessment.isPublished ? 'published' : 'unpublished'} successfully`,
      assessment: updatedAssessment,
    });
  } catch (error) {
    logger.error(error);
    return res.status(500).json({error: 'Internal Server Error', message: error.message});
  }
});

// Get all tests
router.get('/', checkPermission('tests', 'read'), async (req, res) => {
  try {
    const {stream, term, learning_area, test, adm_no} = req.query;
    let school = req?.school?._id;

    let session = req?.current_session;
    if (!school || !stream || !session || !term) {
      return res.status(404).json({error: 'Missing required query parameters'});
    }
    const streamFound = await Stream.findOne({_id: stream}).populate('grade');
    const learningArea = await LearningArea.findById(learning_area);
    if (!streamFound || !learningArea) {
      return res.status(404).json({success: false, error: 'No leaning area found'});
    }
    const tests = await summativeAssessment.getLearnersWithAssessmentStatus(
      school,
      stream,
      session,
      test,
      learning_area,
      adm_no,
    );
    return res.status(200).json({
      success: true,
      data: tests,
      meta: {
        learningArea,
        stream: streamFound,
      },
    });
  } catch (error) {
    res.status(404).json({success: false, error: error.message});
  }
});

router.post('/', checkPermission('tests', 'assess'), async (req, res) => {
  try {
    const {body: data, school, current_session} = req;
    const schoolId = school?._id;

    if (!data || !data.learner || !data.test || !data.learning_area) {
      return res.status(400).json({error: 'Missing required fields'});
    }
    if (data.score === '' || data.score === null || data.score === undefined) {
      // If score is empty, delete the existing assessment
      const deletedAssessment = await SummativeAssessment.findOneAndDelete({
        learner: data.learner,
        test: data.test,
        learning_area: data.learning_area,
        session: current_session,
      });

      if (deletedAssessment) {
        return res.status(200).json({
          message: 'Assessment deleted successfully',
          assessment: deletedAssessment,
        });
      } else {
        return res.status(404).json({
          error: 'Assessment not found for deletion',
        });
      }
    }

    if (isNaN(data.score) || Number(data.score) < 0 || Number(data.score) > 100) {
      return res.status(400).json({error: 'Invalid score', score: data.score});
    }

    const learner = await Learner.findOne({_id: data.learner, school: schoolId});
    if (!learner) {
      return res.status(404).json({error: 'Learner not found'});
    }

    const updateData = {
      learner: data.learner,
      test: data.test,
      learning_area: data.learning_area,
      session: current_session,
      score: data.score,
      term: data.term,
      stream: learner.stream,
      grade: learner.grade,
    };

    const updatedAssessment = await SummativeAssessment.findOneAndUpdate(
      {
        learner: data.learner,
        test: data.test,
        learning_area: data.learning_area,
        session: current_session,
      },
      updateData,
      {upsert: true, new: true, setDefaultsOnInsert: true},
    );

    res.status(200).json({
      message: 'Assessment created or updated',
      assessment: updatedAssessment,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({error: 'Duplicate assessment entry', details: error.message});
    }

    logger.error(error);
    return res.status(500).json({error: 'Internal Server Error', message: error.message});
  }
});

async function makeImageTransparent(imagePath) {
  if (!fs.existsSync(imagePath)) {
    logger.warn('Image file path is invalid or file does not exist:', imagePath);
    return null;
  }

  try {
    const image = await Jimp.read(imagePath);

    // Convert white background to transparent (adjust tolerance if needed)
    image.scan(0, 0, image.bitmap.width, image.bitmap.height, function (x, y, idx) {
      const r = this.bitmap.data[idx + 0]; // Red
      const g = this.bitmap.data[idx + 1]; // Green
      const b = this.bitmap.data[idx + 2]; // Blue

      // If the pixel is close to white, make it transparent
      if (r > 200 && g > 200 && b > 200) {
        this.bitmap.data[idx + 3] = 0; // Set alpha to 0 (transparent)
      }
    });

    // Convert to Base64
    const buffer = await image.getBufferAsync(Jimp.MIME_PNG);
    return `data:image/png;base64,${buffer.toString('base64')}`;
  } catch (error) {
    logger.error('Error processing image:', error);
    return null;
  }
}

// Example usage within your route
router.get('/assessments', checkPermission('tests', 'learners-report'), async (req, res) => {
  try {
    const {term, learner, test} = req.query;
    const query = {};
    let oldSchool = req?.school?._id;

    if (!term || !learner) {
      return res.status(404).json({error: 'Term and Learning Area are required'});
    }
    query.term = term;
    const learner_data = await Learner.findOne({_id: learner, school: oldSchool}).populate('grade stream');
    if (!learner_data) {
      return res.status(404).json({error: 'Learner not found'});
    }

    query.enrollment = learner_data._id;
    const imageFilePath = learner_data.photo || '';
    let imageDataUrl = '';
    const assessment_data = await SummativeAssessment.findOne({test})
      .populate({
        path: 'stream', // Populate stream first
        populate: {
          path: 'school', // Then populate school within stream
        },
      })
      .populate('test'); // Populate test separately

    const session = assessment_data.session;
    let school = assessment_data?.stream?.school;
    // generateThumbnailBase64(imageFilePath).then(base64Image => {
    //   if (base64Image) {
    //     imageBuffer = base64Image;
    //   }
    // });
    // School stamp now handled by shared utilities
    imageDataUrl = await generateThumbnail(imageFilePath);

    // Ensure the image file path is valid and exists
    // if (imageFilePath && fs.existsSync(imageFilePath)) {
    //   try {
    //     const imageBuffer = fs.readFileSync(imageFilePath);
    //     const base64Image = imageBuffer.toString('base64');
    //     const imageType = 'image/png'; // Adjust based on your image type (e.g., image/jpeg)
    //     imageDataUrl = `data:${imageType};base64,${base64Image}`;
    //   } catch (error) {
    //     logger.error('Error reading or encoding image file:', error);
    //   }
    // } else {
    //   logger.warn('Image file path is invalid or file does not exist:', imageFilePath);
    // }
    let logoDataUrl = '';
    // let school = req?.user?.school;
    let elimuriselogoDataUrl = '';
    const elimuriselogo = 'logo.png';
    var _basePath = elimuriselogo;

    if (_basePath && fs.existsSync(_basePath)) {
      try {
        const imageBuffer = fs.readFileSync(_basePath);
        const base64Image = imageBuffer.toString('base64');
        const imageType = 'image/png'; // Adjust based on your image type (e.g., image/jpeg)
        elimuriselogoDataUrl = `data:${imageType};base64,${base64Image}`;
      } catch (error) {
        logger.error('Error reading or encoding image file:', error);
      }
    } else {
      logger.warn('Image file path is invalid or file does not exist:', imageDataUrl);
    }
    // Image generation now handled by shared utilities
    // Ensure the image file path is valid and exists
    if (school.logo && fs.existsSync(school.logo)) {
      try {
        const imageBuffer = fs.readFileSync(school.logo);
        const base64Image = imageBuffer.toString('base64');
        const imageType = 'image/png'; // Adjust based on your image type (e.g., image/jpeg)
        logoDataUrl = `data:${imageType};base64,${base64Image}`;
      } catch (error) {
        logger.error('Error reading or encoding image file:', error);
      }
    } else {
      logger.warn('Image file path is invalid or file does not exist:', imageFilePath);
    }
    // console.log('Learner data:', learner_data);
    const {testData, assessments} = await summativeAssessment.getLearnerAssessment(
      learner_data,
      assessment_data.test,
      session,
    );

    const teacher_comment = await Comments.findOne({
      school: school._id,
      session: session,
      term: parseInt(term),
      learner: new mongoose.Types.ObjectId(learner_data._id),
      stream: learner_data.stream._id,
      assessment: assessment_data.test,
      commentType: 'per-assessment',
    }).populate('learner');
    // Use shared utilities for image generation
    const schoolStampDataUrl = reportUtils.generateSchoolStampUrl(school);
    const signatoryInfo = reportUtils.getSignatoryInfo(school);
    
    // Use shared signatory info
    const signatoryRole = signatoryInfo.role;
    const signatoryName = signatoryInfo.name;
    const signatorySignatureUrl = signatoryInfo.signature;
    let html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="Fun Report Card for ${school.name}">
    <meta name="author" content="${school.name}">
    <title>Fun Report Card - ${school.name}</title>
    <style>
      

:root {
    /* Colors remain unchanged */
    --primary-color: #ff3333; /* Red */
    --secondary-color: #33cc33; /* Green */
    /* School color overrides unchanged */
    ${
      school.primaryColor
        ? school.primaryColor.toLowerCase() === '#ffffff' || school.primaryColor.toLowerCase() === 'white'
          ? '--primary-color: #ff6666;'
          : `--primary-color: ${school.primaryColor};`
        : ''
    }
    ${
      school.secondaryColor
        ? school.secondaryColor.toLowerCase() === '#ffffff' || school.secondaryColor.toLowerCase() === 'white'
          ? '--secondary-color: #66cc66;'
          : `--secondary-color: ${school.secondaryColor};`
        : ''
    }
    --accent1: #0066ff; /* Blue */
    --accent2: #ffcc00; /* Yellow */
}

body {
    font-family: 'Comic Sans MS', cursive, sans-serif;
    background: #ffffff;
    margin: 0;
    padding: 0;
    color: #333;
    font-size: 1em; /* Increased from 0.6em to ensure ~12pt base for print */
}

.watermark {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    font-size: 5em; /* Increased from 3.75em for prominence but kept subtle */
    color: rgba(0, 0, 0, 0.1);
    z-index: -1;
}

.page {
    width: 90%; /* Increased from 85% to utilize A4 width better */
    margin: 40px auto; /* Increased from 30px for more page margin */
    background: white;
    border: 5px solid var(--primary-color); /* Restored to 5px for visibility */
    border-radius: 15px; /* Restored to 15px for consistency */
    padding: 20px; /* Increased from 11.25px for internal spacing */
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2); /* Restored original shadow */
    position: relative;
}

.letterhead {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 5px; /* Increased from 6px */
    background: var(--primary-color);
    color: white;
    border-radius: 10px 10px 0 0; /* Restored to 10px */
    border-bottom: 3px dashed var(--secondary-color); /* Restored to 3px */
    max-height: 150px; /* Increased from 125px */
    overflow: hidden;
    position: relative;
}

.letterhead img {
    width: 120px; /* Restored to 120px for clarity */
    height: auto;
    background: white;
    padding: 2px; /* Restored to 2px */
    border-radius: 10px; /* Restored to 10px */
    margin-left: 10px; /* Restored to 10px */
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); /* Restored original shadow */
}

.school-info {
    text-align: center;
    margin-left: 10px; /* Restored to 10px */
}

.school-name {
    font-size: 2em; /* Increased from 1.55em for prominence */
    font-weight: bold;
    text-transform: uppercase;
    margin: 0;
    line-height: 1.3; /* Adjusted for better spacing */
}

.address {
    font-size: 0.9em; /* Increased from 0.6em for readability */
    font-style: italic;
    margin: 3px 0 0 0; /* Increased from 1.5px */
    line-height: 1.3;
}

.report-title {
    text-align: center;
    font-size: 1.8em; /* Increased from 1.975em for emphasis */
    font-weight: bold;
    color: var(--primary-color);
    margin: 7px 0; /* Increased from 7.5px */
    text-transform: uppercase;
    line-height: 1.3;
    position: relative;
}


.info-container {
    display: flex;
    align-items: flex-start;
    justify-content: flex-start;
    margin: 7px 0; /* Increased from 7.5px */
    max-height: 120px; /* Increased from 7.5px */
    padding-bottom: 7px; /* Increased from 7.5px */
}

.info-container img {
    width: 100px; /* Restored to 100px */
    height: auto;
    border: 2px solid var(--primary-color); /* Restored to 2px */
    border-radius: 10px; /* Restored to 10px */
    background: white;
}

.info-table {
    margin-left: 10px; /* Restored to 10px */
    width: 65%; /* Increased from 60% for balance */
    border-collapse: collapse;
}

.info-table td {
    padding: 2px; /* Increased from 3.25px */
    font-size: 1.2em; /* Increased from 1.825em (assuming typo; adjusted to reasonable size) */
    color: #000;
    border-bottom: 1px dashed var(--primary-color); /* Restored to 1px */
    line-height: 1.3;
}

.label {
    font-weight: bold;
    color: var(--primary-color);
}

.result {
    width: 100%;
    border-collapse: collapse;
    margin-top: 1px; /* Restored to 15px */
    background: white;
}

.result th, .result td {
    border: 2px solid var(--primary-color); /* Restored to 2px */
    padding: 2px; /* Increased from 6px */
    text-align: left;
    font-size: 1.2em; /* Increased from 1.2em for table readability */
    color: #333;
    line-height: 1.3;
}

.result th {
    background: var(--primary-color);
    color: white;
    text-transform: uppercase;
}

.result tr:nth-child(even) {
    background: #f9f9f9;
}

.key-section {
    margin: 0; /* Increased from 1.25px for better spacing */
    background: #f9f9f9; /* Light background */
}

.key-section h3 {
    font-size: 1.2em; /* Increased from 1.35em for emphasis */
    color: var(--primary-color);
    margin: 0 0 12px 0; /* Increased from 7.5px */
    text-align: left;
    text-transform: uppercase;
}

.key-table {
    width: 100%; /* Increased from 80% to utilize space */
    margin: 0 auto; /* Centered */
    border-collapse: collapse;
}

.key-table th, .key-table td {
    border: 2px solid var(--primary-color); /* Increased from 1.5px */
    text-align: left;
    font-size: 1em; /* Increased from 1.2em for consistency with result table */
    color: #333;
    font-style: italic;
    padding: 2px; /* Added padding for better spacing */
}

.key-table th {
    background: var(--primary-color); /* Secondary color for header */
    color: white;
    text-transform: uppercase;
}

.key-table tr:nth-child(even) {
    background: #fff; /* White background for even rows */
}

.comments {
    font-size: 1.2em; /* Increased from 1.25em for readability */
    padding: 7px 10px; /* Increased from 7.5px 15px */
    margin: 2px 0; /* Increased from 7.5px */
    border: 2px solid var(--primary-color); /* Restored to 2px */
    background: #fff;
    color: #000;
    border-radius: 10px; /* Restored to 10px */
    line-height: 1;
    position: relative;
    margin-left: 20px; /* Restored to 20px */
}

.comments::before {
    content: '';
    position: absolute;
    top: 10px; /* Restored to 10px */
    left: -20px; /* Restored to -20px */
    width: 0;
    height: 0;
    border: 10px solid transparent; /* Restored to 10px */
    border-right-color: var(--primary-color);
}

.comments::after {
    content: '';
    position: absolute;
    top: 12px; /* Restored to 12px */
    left: -16px; /* Restored to -16px */
    width: 0;
    height: 0;
    border: 8px solid transparent; /* Restored to 8px */
    border-right-color: #fff;
}



.signature img {
    width: 100px; /* Restored to 100px */
    height: auto;
    border: none;
    border-radius: 5px; /* Restored to 5px */
}

.signature-label {
    font-size: 1em; /* Increased from 1.275em */
    font-weight: bold;
    text-transform: uppercase;
    color: var(--primary-color);
    line-height: 1.3;
}

.signature-section {
    text-align: center;
    border-top: 2px solid var(--primary-color); /* Restored to 2px */
}

.signature {
    display: flex;
    flex-direction: row;
    align-items: center;
    width: 300px; /* Restored to 180px */
    margin: auto;
}

.signature img {
    width: 100px; /* Restored to 100px */
    height: auto;
    border: none;
    border-radius: 5px; /* Restored to 5px */
}

.signature-label {
    font-size: 1.0em; /* Increased from 1.275em */
    font-weight: bold;
    text-transform: uppercase;
    color: var(--primary-color);
    line-height: 1.1;
}
    </style>
</head>
<body>
    <div class="watermark">${school.name}</div>
    <div class="page">
        <div class="letterhead">
            <img src="${logoDataUrl}" alt="School Logo">
            <div class="school-info">
                <div class="school-name">${school.name}</div>
                <div class="address">${school.address}</div>
            </div>
        </div>
        <div class="report-title">${testData?.name}</div>
        <div class="report-title">
          SUMMATIVE REPORT ${testData?.type} - Term ${term}, ${session}
        </div>
        <div class="info-container">
            <img src="${imageDataUrl}" alt="Learner's Profile Picture">
            <div class="info-inline" style="display: flex; flex-direction: row; margin-left: 20px; gap: 30px; align-items: center;">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-weight: bold; color: var(--primary-color);">NAME:</span>
                    <span>${learner_data.first_name.toUpperCase()} ${learner_data.last_name.toUpperCase()} ${learner_data.surname.toUpperCase()}</span>
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-weight: bold; color: var(--primary-color);">ADM NO:</span>
                    <span>${learner_data.adm_no}</span>
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-weight: bold; color: var(--primary-color);">CLASS:</span>
                    <span>${learner_data.stream.grade.name}</span>
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-weight: bold; color: var(--primary-color);">STREAM:</span>
                    <span>${learner_data.stream.name}</span>
                </div>
            </div>
        </div>
        <table class="result">
      <col style="width: 25%;" />
    ${school.summative_has_score ? `<col style="width: 10%;" />` : ''}
    <col style="width: 60%;" />
    ${school.summative_has_score ? `<col style="width: 10%;" />` : ''}

            <tr>
                <th>LEARNING AREA</th>
                ${school.summative_has_score ? `<th>SCORE</th>` : ''}
                <th>PERFORMANCE DESCRIPTOR</th>
                ${school.summative_has_pos ? `<th>POS</th>` : ''}
            </tr>
            ${assessments
              .map(
                assessment =>
                  `
                    <tr>
                        <td>${assessment?.learning_area?.name}</td>
                        ${
                          school.summative_has_score
                            ? `<td><b>${assessment.score != 0 ? assessment.score + '%' : '_'}</b></td>`
                            : ''
                        }
                        <td>${assessment.description}</td>
                        ${school.summative_has_pos ? `<td>${assessment.position}</td>` : ''}
                    </tr>
                  `,
              )
              .join('')}
     
        </table>
 ${reportTemplates.generateCommentsSection(teacher_comment)}
        
        <div class="signature-section" style="page-break-inside: avoid;">
            <div class="signature-container" style="display: flex; justify-content: space-between; align-items: flex-start; width: 100%; margin: 40px 0; padding: 0 20px;">
                <div class="signature-item" style="flex: 1; text-align: center; margin: 0 15px;">
                    <div class="signature-image-container" style="margin-bottom: 15px;">
                        <img src="${signatorySignatureUrl}" alt="Signature" style="width: 120px; height: auto; max-height: 80px; object-fit: contain; border: 1px solid #e0e0e0; border-radius: 8px; padding: 8px; background: white; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                    </div>
                    <div class="signature-details" style="border-top: 2px solid var(--primary-color); padding-top: 12px;">
                        <div class="signature-title" style="font-size: 0.85em; font-weight: 600; color: var(--primary-color); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">${signatoryRole}</div>
                        <div class="signature-name" style="font-size: 1em; font-weight: 700; color: #333; margin-bottom: 2px;">${signatoryName}</div>
                        <div class="signature-line" style="width: 80px; height: 1px; background: var(--primary-color); margin: 8px auto 0;"></div>
                    </div>
                </div>
                
                <div class="signature-divider" style="width: 2px; height: 120px; background: linear-gradient(to bottom, transparent, var(--primary-color), transparent); margin: 0 20px;"></div>
                
                <div class="stamp-item" style="flex: 1; text-align: center; margin: 0 15px;">
                    <div class="stamp-image-container" style="margin-bottom: 15px;">
                        <img src="${schoolStampDataUrl}" alt="School Stamp" style="width: 120px; height: auto; max-height: 80px; object-fit: contain; border: 1px solid #e0e0e0; border-radius: 8px; padding: 8px; background: white; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                    </div>
                    <div class="stamp-details" style="border-top: 2px solid var(--primary-color); padding-top: 12px;">
                        <div class="stamp-title" style="font-size: 0.85em; font-weight: 600; color: var(--primary-color); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Official Stamp</div>
                        <div class="stamp-subtitle" style="font-size: 0.9em; font-weight: 500; color: #666; margin-bottom: 2px;">School Authority</div>
                        <div class="stamp-line" style="width: 80px; height: 1px; background: var(--primary-color); margin: 8px auto 0;"></div>
                    </div>
                </div>
            </div>
        </div>
        <div class="motto" style="text-align: center; font-style: italic; margin-top: 20px; page-break-inside: avoid;">
          ${school.school_motto || 'Empowering Learners for a Brighter Future'}
        </div>
</body>
</html>`;
    if (!html) {
      return res.status(404).send('HTML content is required');
    }

    // if (elimuriselogo && fs.existsSync(elimuriselogo)) {
    //   try {
    //     const imageBuffer = fs.readFileSync(elimuriselogo);
    //     const base64Image = imageBuffer.toString('base64');

    //     const imageType = 'image/png'; // Adjust based on your image type (e.g., image/jpeg)
    //     elimuriselogoDataUrl = `data:${imageType};base64,${base64Image}`;
    //     logger.warn(`<img src="${elimuriselogoDataUrl}"  alt="Learner"
    //  style="width:100px;
    //  height:100;
    //         border-radius: 5px;
    //         border: 1px solid black;

    //        ">`);
    //   } catch (error) {
    //     logger.error('Error reading or encoding image file:', error);
    //   }
    // } else {
    //   logger.warn('Image file path is invalid or file does not exist:', 'logo');
    // }

    wkhtmltopdf(html, {
      pageSize: 'A4',
      orientation: 'Portrait', // Optional: change to 'Landscape' if needed
    }).pipe(res);

    // pdf.create(html, options).toBuffer((err, buffer) => {
    //   if (err) {
    //     return res.status(404).send(err.message);
    //   }

    //   res.setHeader('Content-Type', 'application/pdf');
    //   res.setHeader('Content-Disposition', 'attachment; filename=output.pdf');
    //   res.send(buffer);
    // });
  } catch (err) {
    console.log('Error generating PDF:', err);
    logger.error('Error generating PDF:', err.stack);
    res.status(500).json({error: 'Failed to generate PDF', details: err.message});
  }
});
const {ChartJSNodeCanvas} = require('chartjs-node-canvas');
const logger = require('../../../utils/logger');
const {default: mongoose} = require('mongoose');
const chartJSNodeCanvas = new ChartJSNodeCanvas({width: 400, height: 300});

// Function to generate chart as base64 image
async function generateChartImage(assessments) {
  const brightColors = [
    'rgba(255, 99, 132, 0.9)', // red
    'rgba(54, 162, 235, 0.9)', // blue
    'rgba(255, 206, 86, 0.9)', // yellow
    'rgba(75, 192, 192, 0.9)', // teal
    'rgba(153, 102, 255, 0.9)', // purple
    'rgba(255, 159, 64, 0.9)', // orange
    'rgba(0, 204, 102, 0.9)', // green
  ];

  const borderColors = brightColors.map(color => color.replace('0.9', '1'));

  const configuration = {
    type: 'bar',
    data: {
      labels: assessments.map(a => a.learning_area),
      datasets: assessments[0]?.allTestTypes.map((testType, index) => ({
        label: testType,
        data: assessments.map(assessment => assessment.assessments[index]?.score ?? 0),
        backgroundColor: brightColors[index % brightColors.length],
        borderColor: borderColors[index % borderColors.length],
        borderWidth: 2,
      })),
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          max: 100,
          grid: {
            color: '#e0e0e0',
          },
          title: {
            display: true,
            text: 'Score',
            font: {
              size: 14,
              weight: 'bold',
            },
          },
        },
        x: {
          grid: {
            display: false,
          },
          title: {
            display: true,
            text: 'Learning Areas',
            font: {
              size: 14,
              weight: 'bold',
            },
          },
          ticks: {
            autoSkip: false,
            maxRotation: 45,
            minRotation: 20,
          },
        },
      },
      plugins: {
        legend: {
          position: 'top',
          labels: {
            font: {
              size: 12,
            },
          },
        },
        title: {
          display: true,
          text: 'Assessment Scores by Learning Area',
          font: {
            size: 16,
            weight: 'bold',
          },
        },
      },
    },
  };

  const imageBuffer = await chartJSNodeCanvas.renderToBuffer(configuration);
  return `data:image/png;base64,${imageBuffer.toString('base64')}`;
}

// Function to generate a simple placeholder image (e.g., gray square)
function generatePlaceholderImage() {
  // This is a base64-encoded 100x100 gray PNG image
  const placeholderBase64 =
    'iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAABHUlEQVR4nO3QsQkAIBADQe7/6aN2hVbIdLzLB33RgQIECBAgAABAgQIECBAgACB/wqrsAsWsCMZsbAIBAgQIECBAgAABAgQIECBAgEC/A1dYBiy4sWIAY9vAIBAgQIECBAgAABAgQIECBAgEC/A1dYBiy4sWIAY9vAIBAgQIECBAgAABAgQIECBAgEC/A1dYBiy4sWIAY9vAIBAgQIECBAgAABAgQIECBAgEC/A1dYBiy4sWIAY9vAIBAgQIECBAgAABAgQIECBAgEC/A1dYBiy4sWIAY9vAIBAgQIECBAgAABAgQIECBAgEC/A1dYBiy4sWIAY9vAIBAgQIECBAgAABAgQIECBAgED/AGXzDLd5ekfA4QAAAABJRU5ErkJggg==';
  return `data:image/png;base64,${placeholderBase64}`;
}
router.get('/assessments-comparison', checkPermission('tests', 'learners-report'), async (req, res) => {
  try {
    const {term, learner, stream} = req.query;
    const query = {};

    if (!term || !learner) {
      return res.status(404).json({error: 'Term and Learner are required'});
    }

    query.term = term;
    const learner_data = await Learner.findById(learner).populate('grade stream');
    if (!learner_data) {
      return res.status(404).json({error: 'Enrollment not found'});
    }
    query.enrollment = learner_data._id;

    // Load learner photo
    const imageFilePath = learner_data.photo || 'student.jpeg';
    let imageDataUrl = '';

    if (imageFilePath && fs.existsSync(imageFilePath)) {
      try {
        const imageBuffer = fs.readFileSync(imageFilePath);
        const base64Image = imageBuffer.toString('base64');
        imageDataUrl = `data:image/png;base64,${base64Image}`;
      } catch (error) {
        logger.error('Error reading learner image file:', imageFilePath, error);
        imageDataUrl = generatePlaceholderImage(); // Fallback to placeholder
      }
    } else {
      logger.warn('Learner image file not found:', imageFilePath);
      imageDataUrl = generatePlaceholderImage(); // Fallback to placeholder
    }

    // Load school logo
    let school = req?.user?.school;
    let logoDataUrl = '';
    if (school.logo && fs.existsSync(school.logo)) {
      const imageBuffer = fs.readFileSync(school.logo);
      const base64Image = imageBuffer.toString('base64');
      logoDataUrl = `data:image/png;base64,${base64Image}`;
    } else {
      logger.warn('School logo not found:', school.logo);
    }

    // Load elimurise logo
    let elimuriselogoDataUrl = '';
    const elimuriselogo = 'logo.png';
    if (fs.existsSync(elimuriselogo)) {
      const imageBuffer = fs.readFileSync(elimuriselogo);
      const base64Image = imageBuffer.toString('base64');
      elimuriselogoDataUrl = `data:image/png;base64,${base64Image}`;
    } else {
      logger.warn('Elimurise logo not found:', elimuriselogo);
    }

    // Load school stamp and headteacher signature
    let schoolStampDataUrl = '';
    let headteacherSignatureDataUrl = '';
    if (school.school_stamp && fs.existsSync(school.school_stamp)) {
      const imageBuffer = fs.readFileSync(school.school_stamp);
      const base64Image = imageBuffer.toString('base64');
      schoolStampDataUrl = `data:image/png;base64,${base64Image}`;
    }
    if (school.signatory_signature && fs.existsSync(school.signatory_signature)) {
      const imageBuffer = fs.readFileSync(school.signatory_signature);
      const base64Image = imageBuffer.toString('base64');
      headteacherSignatureDataUrl = `data:image/png;base64,${base64Image}`;
    }
    const signatoryRole = school.signatory_role || 'Head Teacher'; // Fallback to "Head Teacher" if not set
    const signatoryName = school.signatory_name || ''; // Empty if not provided
    const signatorySignatureUrl = school.signatory_signature ? `${headteacherSignatureDataUrl}` : '';
    // const teacher_comment = await Comments.findOne({
    //   school: school._id,
    //   session: session,
    //   term: parseInt(term),
    //   learner: new mongoose.Types.ObjectId(learner_data._id),
    //   stream: learner_data.stream._id,
    //   assessment: assessment_data.test,
    //   commentType: 'per-assessment',
    // }).populate('learner');

    // Fetch assessments first to get available assessment IDs
    const assessments = await summativeAssessment.getLearnerAssessmentComparison(
      learner_data,
      term,
      req.current_session,
    );

    // Get the latest assessment comment based on test creation date
    let teacher_comment = null;
    if (assessments && assessments.length > 0 && assessments[0].allTestTypes) {
      // Try to find the comment for the most recently created test
      const allComments = await Comments.find({
        commentType: 'per-assessment',
        school: school._id,
        session: req.current_session,
        term: parseInt(term),
        learner: new mongoose.Types.ObjectId(learner_data._id),
        stream: learner_data.stream._id,
        assessment: { $exists: true } // Ensure assessment field exists
      }).populate('learner assessment');
      
      // Sort by test creation date and get the latest one
      if (allComments && allComments.length > 0) {
        allComments.sort((a, b) => {
          const dateA = a.assessment?.createdAt || new Date(0);
          const dateB = b.assessment?.createdAt || new Date(0);
          return new Date(dateB) - new Date(dateA); // Sort descending (newest first)
        });
        teacher_comment = allComments[0]; // Get the first one after sorting
      }
    }
    
    console.log('Latest assessment comment:', teacher_comment);
    
    // If no comment exists, create a placeholder or show message
    if (!teacher_comment) {
      console.log('No assessment comment found for this learner. Creating placeholder...');
    }


    // logger.warn(JSON.stringify(assessments[0]));
    let html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="Assessment Comparison Report for ${school.name}">
    <meta name="author" content="${school.name}">
    <title>Assessment Comparison - ${school.name}</title>
    <style>
  

:root {
    /* Colors remain unchanged */
    --primary-color: #ff3333; /* Red */
    --secondary-color: #33cc33; /* Green */
    /* School color overrides unchanged */
    ${
      school.primaryColor
        ? school.primaryColor.toLowerCase() === '#ffffff' || school.primaryColor.toLowerCase() === 'white'
          ? '--primary-color: #ff6666;'
          : `--primary-color: ${school.primaryColor};`
        : ''
    }
    ${
      school.secondaryColor
        ? school.secondaryColor.toLowerCase() === '#ffffff' || school.secondaryColor.toLowerCase() === 'white'
          ? '--secondary-color: #66cc66;'
          : `--secondary-color: ${school.secondaryColor};`
        : ''
    }
    --accent1: #0066ff; /* Blue */
    --accent2: #ffcc00; /* Yellow */
}

body {
    font-family: 'Comic Sans MS', cursive, sans-serif;
    background: #ffffff;
    margin: 0;
    padding: 0;
    color: #333;
    font-size: 1em; /* Increased from 0.6em to ensure ~12pt base for print */
}

/* Page break controls */
@media print {
    .page {
        page-break-after: always;
    }
    
    .page:last-child {
        page-break-after: avoid;
    }
    
    table {
        page-break-inside: avoid;
    }
    
    tr {
        page-break-inside: avoid;
    }
}

.watermark {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    font-size: 5em; /* Increased from 3.75em for prominence but kept subtle */
    color: rgba(0, 0, 0, 0.1);
    z-index: -1;
}

.page {
    width: 90%; /* Increased from 85% to utilize A4 width better */
    margin: 40px auto; /* Increased from 30px for more page margin */
    background: white;
    border: 5px solid var(--primary-color); /* Restored to 5px for visibility */
    border-radius: 15px; /* Restored to 15px for consistency */
    padding: 20px; /* Increased from 11.25px for internal spacing */
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2); /* Restored original shadow */
    position: relative;
}

.letterhead {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 3px;
    color: white;
    color: var(--primary-color);
    border-radius: 8px 8px 0 0;
    max-height: 80px;
    overflow: hidden;
    position: relative;
}

.letterhead img {
    width: 120px; /* Restored to 120px for clarity */
    height: auto;
    background: white;
    padding: 2px; /* Restored to 2px */
    border-radius: 10px; /* Restored to 10px */
    margin-left: 10px; /* Restored to 10px */
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); /* Restored original shadow */
}

.school-info {
    text-align: center;
    margin-left: 10px; /* Restored to 10px */
}

.school-name {
    font-size: 2em; /* Increased from 1.55em for prominence */
    font-weight: bold;
    text-transform: uppercase;
    margin: 0;
    line-height: 1.3; /* Adjusted for better spacing */
}

.address {
    font-size: 0.9em; /* Increased from 0.6em for readability */
    font-style: italic;
    margin: 3px 0 0 0; /* Increased from 1.5px */
    line-height: 1.3;
}

.report-title {
    text-align: center;
    font-size: 1.6em; /* Increased from 1.975em for emphasis */
    font-weight: bold;
    color: var(--primary-color);
    margin: 7px 0; /* Increased from 7.5px */
    text-transform: uppercase;
    line-height: 1.3;
    position: relative;
}


.info-container {
    display: flex;
    align-items: flex-start;
    justify-content: flex-start;
    margin: 7px 0; /* Increased from 7.5px */
    max-height: 120px; /* Increased from 7.5px */
    padding-bottom: 7px; /* Increased from 7.5px */
}

.info-container img {
    width: 100px; /* Restored to 100px */
    height: auto;
    border: 2px solid var(--primary-color); /* Restored to 2px */
    border-radius: 10px; /* Restored to 10px */
    background: white;
}

.info-table {
    margin-left: 10px; /* Restored to 10px */
    width: 65%; /* Increased from 60% for balance */
    border-collapse: collapse;
}

.info-table td {
    padding: 2px; /* Increased from 3.25px */
    font-size: 1.2em; /* Increased from 1.825em (assuming typo; adjusted to reasonable size) */
    color: #000;
    border-bottom: 1px dashed var(--primary-color); /* Restored to 1px */
    line-height: 1.3;
}

.label {
    font-weight: bold;
    color: var(--primary-color);
}

.result {
    width: 100%;
    border-collapse: collapse;
    margin-top: 15px; /* Restored to 15px */
    background: white;
}

.result th, .result td {
    border: 2px solid var(--primary-color); /* Restored to 2px */
    padding: 2px; /* Increased from 6px */
    text-align: left;
    font-size: 1.2em; /* Increased from 1.2em for table readability */
    color: #333;
    line-height: 1.3;
}

.result th {
    background: var(--primary-color);
    color: white;
    text-transform: uppercase;
}

.result tr:nth-child(even) {
    background: #f9f9f9;
}

.key-section {
    margin: 0; /* Increased from 1.25px for better spacing */
    background: #f9f9f9; /* Light background */
}

.key-section h3 {
    font-size: 1.2em; /* Increased from 1.35em for emphasis */
    color: var(--primary-color);
    margin: 0 0 12px 0; /* Increased from 7.5px */
    text-align: left;
    text-transform: uppercase;
}

.key-table {
    width: 100%; /* Increased from 80% to utilize space */
    margin: 0 auto; /* Centered */
    border-collapse: collapse;
}

.key-table th, .key-table td {
    border: 2px solid var(--primary-color); /* Increased from 1.5px */
    text-align: left;
    font-size: 1em; /* Increased from 1.2em for consistency with result table */
    color: #333;
    font-style: italic;
    padding: 2px; /* Added padding for better spacing */
}

.key-table th {
    background: var(--primary-color); /* Secondary color for header */
    color: white;
    text-transform: uppercase;
}

.key-table tr:nth-child(even) {
    background: #fff; /* White background for even rows */
}

.comments {
    font-size: 1.2em; /* Increased from 1.25em for readability */
    padding: 7px 10px; /* Increased from 7.5px 15px */
    margin: 2px 0; /* Increased from 7.5px */
    border: 2px solid var(--primary-color); /* Restored to 2px */
    background: #fff;
    color: #000;
    border-radius: 10px; /* Restored to 10px */
    line-height: 1;
    position: relative;
    margin-left: 20px; /* Restored to 20px */
}

.comments::before {
    content: '';
    position: absolute;
    top: 10px; /* Restored to 10px */
    left: -20px; /* Restored to -20px */
    width: 0;
    height: 0;
    border: 10px solid transparent; /* Restored to 10px */
    border-right-color: var(--primary-color);
}

.comments::after {
    content: '';
    position: absolute;
    top: 12px; /* Restored to 12px */
    left: -16px; /* Restored to -16px */
    width: 0;
    height: 0;
    border: 8px solid transparent; /* Restored to 8px */
    border-right-color: #fff;
}



.signature img {
    width: 100px; /* Restored to 100px */
    height: auto;
    border: none;
    border-radius: 5px; /* Restored to 5px */
}

.signature-label {
    font-size: 1em; /* Increased from 1.275em */
    font-weight: bold;
    text-transform: uppercase;
    color: var(--primary-color);
    line-height: 1.3;
}

.signature-section {
    text-align: center;
    border-top: 2px solid var(--primary-color); /* Restored to 2px */
}

.signature {
    display: flex;
    flex-direction: row;
    align-items: center;
    width: 300px; /* Restored to 180px */
    margin: auto;
}

.signature img {
    width: 100px; /* Restored to 100px */
    height: auto;
    border: none;
    border-radius: 5px; /* Restored to 5px */
}

.signature-label {
    font-size: 1.0em; /* Increased from 1.275em */
    font-weight: bold;
    text-transform: uppercase;
    color: var(--primary-color);
    line-height: 1.1;
}
    </style>
</head>
<body>
    <div class="watermark">${school.name}</div>
    <div class="page">
        <div class="letterhead" style="page-break-inside: avoid;">
            <img src="${logoDataUrl}" alt="School Logo">
            <div class="school-info">
                <div class="school-name">${school.name}</div>
                <div class="address">${school.address}</div>
            </div>
            <div style="width: 90px; margin: 0 7.5px;"></div> <!-- Spacer for balance -->
        </div>
        <div class="report-title" style="page-break-inside: avoid;">Summative Assessment  REPORT - Term ${term} - ${req.current_session} </div>

        <div class="info-container" style="page-break-inside: avoid;">
            <img src="${imageDataUrl}" alt="Learner's Profile Picture">
            <div class="info-inline" style="display: flex; flex-direction: column; margin-left: 20px; gap: 8px;">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-weight: bold; color: var(--primary-color);">NAME:</span>
                    <span>${learner_data.first_name} ${learner_data.last_name} ${learner_data.surname}</span>
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-weight: bold; color: var(--primary-color);">ADM NO:</span>
                    <span>${learner_data.adm_no}</span>
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-weight: bold; color: var(--primary-color);">CLASS:</span>
                    <span>${learner_data.stream.grade.name}</span>
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-weight: bold; color: var(--primary-color);">STREAM:</span>
                    <span>${learner_data.stream.name}</span>
                </div>
            </div>
        </div>
        <table class="result" style="page-break-inside: avoid;">
            <tr>
                <th>LEARNING AREA</th>`;
    if (assessments.length > 0 && assessments[0].allTestTypes) {
      assessments[0].allTestTypes.forEach(testType => {
        html += `<th><b>${testType}</b></th>`;
        html += `<th><b>DESC</b></th>`;
      });
    }

    html += `</tr>`;
    assessments?.forEach(assessment => {
      html += `
                        <tr>
                            <td>${assessment?.learning_area}</td>`;
      assessment.assessments.forEach(assessment => {
        html += `<td><b>${assessment.score ?? '_'}</b></td>`;
        const description = assessment.score === 0 ? 'Assessment Not Done' : rank(assessment.gradingScore ?? 0);
        html += `<td><b>${description}</b></td>`;
      });
      html += `
                        </tr>     `;
    });
    const descriptors = await PlDescriptorService.getAllDescriptorsByLanguage();
    // html += `

    //     <div class="key-section">
    //         <h3>Grading Key</h3>
    //         <table class="key-table">
    //             <tr>
    //                 <th>Abbreviation</th>
    //                 <th>Description</th>
    //             </tr>
    //             <tr>
    //                 <td><b>EE</b></td>
    //                 <td>Exceeding Expectation</td>
    //             </tr>
    //             <tr>
    //                 <td><b>ME</b></td>
    //                 <td>Meeting Expectation</td>
    //             </tr>
    //             <tr>
    //                 <td><b>AE</b></td>
    //                 <td>Approaching Expectation</td>
    //             </tr>
    //             <tr>
    //                 <td><b>BE</b></td>
    //                 <td>Below Expectation</td>
    //             </tr>
    //         </table>
    //     </div>`;

    const gradingMap = {
      4: {abbr: 'EE', full: 'Exceeding Expectation'},
      3: {abbr: 'ME', full: 'Meeting Expectation'},
      2: {abbr: 'AE', full: 'Approaching Expectation'},
      1: {abbr: 'BE', full: 'Below Expectation'},
    };
    const chartImageUrl = await generateChartImage(assessments);
    //   html += `
    //   </table>
    //   <div class="graph-section" style="margin: 20px 0;">
    //     <h3 style="font-size: 1.2em; color: var(--primary-color); text-align: center; text-transform: uppercase;">Performance Graph</h3>
    //     <img src="${chartImageUrl}" alt="Performance Chart" style="max-width: 100%; max-height: 400px;">
    //   </div>

    // // `;
    //   html += `

    // <div class="key-section">
    //     <h3>Grading Key</h3>
    //     <table class="key-table">
    //         <tr>
    //             <th>Abbreviation</th>
    //             <th>Description</th>
    //         </tr>`;

    //   descriptors.forEach(descriptor => {
    //     const abbreviation = gradingMap[descriptor.score] || '-';
    //     const description = descriptor.description.replace(/{{learner}}/g, 'Learner');

    //     html += `
    //         <tr>
    //             <td><b>${abbreviation.abbr}</b></td>
    //             <td><b>${abbreviation.full}</b></td>
    //         </tr>`;
    //   });
    //   html += `
    //     </table>
    // </div>`;
    html += `
    </table>
    <div class="row-container" style="display: flex; margin: 20px 0; gap: 20px; page-break-inside: avoid;">
      <div class="graph-section" style="flex: 1; max-width: 50%;">
        <h3 style="font-size: 1.2em; color: var(--primary-color); text-align: center; text-transform: uppercase; margin-bottom: 10px;">Performance Graph</h3>
        <img src="${chartImageUrl}" alt="Performance Chart" style="width: 100%; max-height: 300px; object-fit: contain;">
      </div>
      <div class="key-section" style="flex: 1; max-width: 50%;">
        <h3 style="font-size: 1.2em; color: var(--primary-color); text-align: center; text-transform: uppercase; margin-bottom: 10px;">Grading Key:</h3>
        <table class="key-table" style="width: 100%; border-collapse: collapse;">
          <tr>
            <th style="border: 2px solid var(--primary-color); padding: 5px; background: var(--primary-color); color: white; text-transform: uppercase;">Abbreviation</th>
            <th style="border: 2px solid var(--primary-color); padding: 5px; background: var(--primary-color); color: white; text-transform: uppercase;">Description</th>
          </tr>`;

    descriptors.forEach(descriptor => {
      const abbreviation = gradingMap[descriptor.score] || {abbr: '-', full: '-'};
      const description = descriptor.description.replace(/{{learner}}/g, 'Learner');

      html += `
          <tr>
            <td style="border: 2px solid var(--primary-color); padding: 5px; text-align: left;"><b>${abbreviation.abbr}</b></td>
            <td style="border: 2px solid var(--primary-color); padding: 5px; text-align: left;"><b>${description}</b></td>
          </tr>`;
    });

    html += `
        </table>
      </div>
    </div>`;
    //   // html += `

    //   //       <div class="key-section">
    //   //           <h3>Grading Key</h3>
    //   //           <table class="key-table">
    //   //               <tr>
    //   //                   <th>Abbreviation</th>
    //   //                   <th>Description</th>
    //   //               </tr>`;

    //   // descriptors.forEach(descriptor => {
    //   //   const abbreviation = gradingMap[descriptor.score] || '-';
    //   //   const description = descriptor.description.replace(/{{learner}}/g, 'Learner');

    //   //   html += `
    //   //               <tr>
    //   //                   <td><b>${abbreviation.abbr}</b></td>
    //   //                   <td><b>${abbreviation.full}</b>: ${description}</td>
    //   //               </tr>`;
    //   // });
    //   // html += `
    //   //           </table>
    //   //       </div>`;
    //   // logger.warn(html);

    html += `
        <div class="comments" style="page-break-inside: avoid;">
            <div><b>Class Manager's Report:</b></div>
            <p>${teacher_comment?.comment || 'No assessment comment has been added yet for this term. Please add a comment through the assessment comment form.'}</p>
        </div>
      `;
    html += `
        </table>
        <div class="signature-section" style="page-break-inside: avoid;">
            <div class="signature-container" style="display: flex; justify-content: space-between; align-items: flex-start; width: 100%; margin: 40px 0; padding: 0 20px;">
                <div class="signature-item" style="flex: 1; text-align: center; margin: 0 15px;">
                    <div class="signature-image-container" style="margin-bottom: 15px;">
                        <img src="${signatorySignatureUrl}" alt="Signature" style="width: 120px; height: auto; max-height: 80px; object-fit: contain; border: 1px solid #e0e0e0; border-radius: 8px; padding: 8px; background: white; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                    </div>
                    <div class="signature-details" style="border-top: 2px solid var(--primary-color); padding-top: 12px;">
                        <div class="signature-title" style="font-size: 0.85em; font-weight: 600; color: var(--primary-color); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">${signatoryRole}</div>
                        <div class="signature-name" style="font-size: 1em; font-weight: 700; color: #333; margin-bottom: 2px;">${signatoryName}</div>
                        <div class="signature-line" style="width: 80px; height: 1px; background: var(--primary-color); margin: 8px auto 0;"></div>
                    </div>
                </div>
                
                <div class="signature-divider" style="width: 2px; height: 120px; background: linear-gradient(to bottom, transparent, var(--primary-color), transparent); margin: 0 20px;"></div>
                
                <div class="stamp-item" style="flex: 1; text-align: center; margin: 0 15px;">
                    <div class="stamp-image-container" style="margin-bottom: 15px;">
                        <img src="${schoolStampDataUrl}" alt="School Stamp" style="width: 120px; height: auto; max-height: 80px; object-fit: contain; border: 1px solid #e0e0e0; border-radius: 8px; padding: 8px; background: white; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                    </div>
                    <div class="stamp-details" style="border-top: 2px solid var(--primary-color); padding-top: 12px;">
                        <div class="stamp-title" style="font-size: 0.85em; font-weight: 600; color: var(--primary-color); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Official Stamp</div>
                        <div class="stamp-subtitle" style="font-size: 0.9em; font-weight: 500; color: #666; margin-bottom: 2px;">School Authority</div>
                        <div class="stamp-line" style="width: 80px; height: 1px; background: var(--primary-color); margin: 8px auto 0;"></div>
                    </div>
                </div>
            </div>
        </div>
    </div>
        <div class="motto" style="text-align: center; font-style: italic; margin-top: 20px; page-break-inside: avoid;">
          ${school.school_motto || 'Empowering Learners for a Brighter Future'}
        </div>
</body>
</html>`;
    //    html+=`     <div class="signature-section">
    //             <div class="signature">
    //                 <img src="${schoolStampDataUrl}" alt="School Stamp">
    //                 <img src="${headteacherSignatureDataUrl}" alt="Headteacher's Signature">
    //                 <span class="signature-label">Headteacher: ${school.school_head_teacher || 'Signature'}</span>
    //             </div>
    //         </div>
    //     </div>
    // </body>
    // </html>`;

    if (!html) {
      return res.status(404).send('HTML content is required');
    }

    const options = {
      format: 'A4',
      border: {
        top: '0.15in' /* Further reduced from 0.225in */,
        right: '0.25in' /* Further reduced from 0.375in */,
        bottom: '0.1in' /* Further reduced from 0.375in */,
        left: '0.25in' /* Further reduced from 0.375in */,
      },
      footer: {
        height: '15mm' /* Reduced height for footer */,
        contents: `<hr style="border:1px solid black; margin: 0;"><div style="display: flex; align-items: center; justify-content: center; padding: 2px 0;">Powered By Elimurise. <span style="margin-left: 10px; color:#444;">{{page}}/{{pages}}</span></div>`,
      },
      childProcessOptions: {
        env: {
          OPENSSL_CONF: '/dev/null',
        },
      },
    };
    wkhtmltopdf(html, {
      pageSize: 'A4',
      encoding: 'UTF-8',
      // // disableSmartShrinking: true,
      // footerLine: true,

      orientation: 'Portrait', // Optional: change to 'Landscape' if needed
    }).pipe(res);
  } catch (err) {
    console.log(err);
    res.status(404).json({error: err.message});
  }
});
async function getImageDataUrl(filePath) {
  try {
    if (
      filePath &&
      (await fs
        .access(filePath)
        .then(() => true)
        .catch(() => false))
    ) {
      const imageBuffer = await fs.readFile(filePath);
      const base64Image = imageBuffer.toString('base64');
      return `data:image/png;base64,${base64Image}`;
    }
    logger.warn(`Image file not found: ${filePath}`);
    return '';
  } catch (err) {
    logger.warn(`Error reading image file ${filePath}:`, err.message);
    return '';
  }
}
router.get('/assessments-comparison-all', checkPermission('tests', 'learners-report'), async (req, res) => {
  try {
    const {term, stream} = req.query;

    if (!term) {
      return res.status(400).json({error: 'Term is required'});
    }

    // Build query for learners
    const query = {term};
    if (stream) {
      query.stream = stream;
    }

    // Fetch all learners
    const learners = await Learner.find().populate('grade stream');
    if (!learners || learners.length === 0) {
      return res.status(404).json({error: 'No learners found'});
    }

    // Load school data
    const school = req?.user?.school;
    if (!school) {
      return res.status(400).json({error: 'School information not found'});
    }

    // Load school logo, stamp, and signature
    const logoDataUrl = await getImageDataUrl(school.logo);
    const schoolStampDataUrl = await getImageDataUrl(school.school_stamp);
    const headteacherSignatureDataUrl = await getImageDataUrl(school.signatory_signature);
    const elimuriselogoDataUrl = await getImageDataUrl('logo.png');

    const signatoryRole = school.signatory_role || 'Head Teacher';
    const signatoryName = school.signatory_name || '';
    const signatorySignatureUrl = headteacherSignatureDataUrl;

    // Fetch grading descriptors once (shared across all reports)
    const descriptors = await PlDescriptorService.getAllDescriptorsByLanguage();
    const gradingMap = {
      4: {abbr: 'EE', full: 'Exceeding Expectation'},
      3: {abbr: 'ME', full: 'Meeting Expectation'},
      2: {abbr: 'AE', full: 'Approaching Expectation'},
      1: {abbr: 'BE', full: 'Below Expectation'},
    };

    // Process each learner's report in parallel
    const htmlReports = await Promise.all(
      learners.map(async learner_data => {
        // Load learner photo
        const imageDataUrl = await getImageDataUrl(learner_data.photo);

        // Fetch comments for the learner
        const [teacher_comment, head_comment] = await Promise.all([
          Comments.findOne({
            type: 'teacher',
            session: req.current_session,
            term,
            learner: learner_data._id,
            stream: learner_data.stream._id,
            commentType: 'termly',
          }).populate('learner'),
          Comments.findOne({
            type: 'head',
            session: req.current_session,
            term,
            learner: learner_data._id,
            stream: learner_data.stream._id,
          }).populate('learner'),
        ]);

        // Fetch assessments
        const assessments = await summativeAssessment.getLearnerAssessmentComparison(
          learner_data,
          term,
          req.current_session,
        );

        // Generate HTML for this learner
        let html = `
        <div class="page">
          <div class="watermark">${school.name}</div>
          <div class="letterhead">
            <img src="${logoDataUrl}" alt="School Logo">
            <div class="school-info">
              <div class="school-name">${school.name}</div>
              <div class="address">${school.address}</div>
            </div>
            <div style="width: 90px; margin: 0 7.5px;"></div>
          </div>
          <div class="report-title">Summative Assessment REPORT - Term ${term} - ${req.current_session}</div>
          <div class="info-container">
            <img src="${imageDataUrl}" alt="Learner's Profile Picture">
            <div class="info-inline" style="display: flex; flex-direction: column; margin-left: 20px; gap: 8px;">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-weight: bold; color: var(--primary-color);">NAME:</span>
                    <span>${learner_data.first_name} ${learner_data.last_name} ${learner_data.surname}</span>
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-weight: bold; color: var(--primary-color);">ADM NO:</span>
                    <span>${learner_data.adm_no}</span>
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-weight: bold; color: var(--primary-color);">CLASS:</span>
                    <span>${learner_data.stream.grade.name}</span>
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-weight: bold; color: var(--primary-color);">STREAM:</span>
                    <span>${learner_data.stream.name}</span>
                </div>
            </div>
          </div>
          <table class="result">
            <tr>
              <th>LEARNING AREA</th>`;

        if (assessments.length > 0 && assessments[0].allTestTypes) {
          assessments[0].allTestTypes.forEach(testType => {
            html += `<th><b>${testType}</b></th><th><b>DESC</b></th>`;
          });
        }

        html += `</tr>`;
        assessments?.forEach(assessment => {
          html += `
          <tr>
            <td>${assessment?.learning_area}</td>`;
          assessment.assessments.forEach(assessment => {
            html += `<td><b>${assessment.score ?? '_'}</b></td>`;
            const description = assessment.score === 0 ? 'Assessment Not Done' : rank(assessment.gradingScore ?? 0);
            html += `<td><b>${description}</b></td>`;
          });
          html += `</tr>`;
        });

        html += `
          </table>
          <div class="key-section">
            <h3>Grading Key:</h3>
            <table class="key-table">
              <tr>
                <th>Abbreviation</th>
                <th>Description</th>
              </tr>`;

        descriptors.forEach(descriptor => {
          const abbreviation = gradingMap[descriptor.score] || {abbr: '-', full: '-'};
          const description = descriptor.description.replace(/{{learner}}/g, 'Learner');
          html += `
          <tr>
            <td><b>${abbreviation.abbr}</b></td>
            <td><b>${abbreviation.full}</b>: ${description}</td>
          </tr>`;
        });

        html += `
            </table>
          </div>
          <div class="comments">
            <div><b>Class Manager's Report:</b></div>
            <p>${teacher_comment?.comment ?? ''}</p>
          </div>
          <div class="signature-section">
            <div class="signature-container" style="display: flex; justify-content: space-between; align-items: flex-start; width: 100%; margin: 40px 0; padding: 0 20px;">
                <div class="signature-item" style="flex: 1; text-align: center; margin: 0 15px;">
                    <div class="signature-image-container" style="margin-bottom: 15px;">
                        <img src="${signatorySignatureUrl}" alt="Signature" style="width: 120px; height: auto; max-height: 80px; object-fit: contain; border: 1px solid #e0e0e0; border-radius: 8px; padding: 8px; background: white; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                    </div>
                    <div class="signature-details" style="border-top: 2px solid var(--primary-color); padding-top: 12px;">
                        <div class="signature-title" style="font-size: 0.85em; font-weight: 600; color: var(--primary-color); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">${signatoryRole}</div>
                        <div class="signature-name" style="font-size: 1em; font-weight: 700; color: #333; margin-bottom: 2px;">${signatoryName}</div>
                        <div class="signature-line" style="width: 80px; height: 1px; background: var(--primary-color); margin: 8px auto 0;"></div>
                    </div>
                </div>
                
                <div class="signature-divider" style="width: 2px; height: 120px; background: linear-gradient(to bottom, transparent, var(--primary-color), transparent); margin: 0 20px;"></div>
                
                <div class="stamp-item" style="flex: 1; text-align: center; margin: 0 15px;">
                    <div class="stamp-image-container" style="margin-bottom: 15px;">
                        <img src="${schoolStampDataUrl}" alt="School Stamp" style="width: 120px; height: auto; max-height: 80px; object-fit: contain; border: 1px solid #e0e0e0; border-radius: 8px; padding: 8px; background: white; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                    </div>
                    <div class="stamp-details" style="border-top: 2px solid var(--primary-color); padding-top: 12px;">
                        <div class="stamp-title" style="font-size: 0.85em; font-weight: 600; color: var(--primary-color); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Official Stamp</div>
                        <div class="stamp-subtitle" style="font-size: 0.9em; font-weight: 500; color: #666; margin-bottom: 2px;">School Authority</div>
                        <div class="stamp-line" style="width: 80px; height: 1px; background: var(--primary-color); margin: 8px auto 0;"></div>
                    </div>
                </div>
            </div>
          </div>
        </div>
    
        <div style="page-break-after: always;"></div>`;

        return html;
      }),
    );

    // Combine all HTML reports into a single HTML document
    const combinedHtml = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta name="description" content="Assessment Comparison Reports for ${school.name}">
        <meta name="author" content="${school.name}">
        <title>Assessment Comparison Reports - ${school.name}</title>
        <style>
          ${/* Include the original CSS styles here */ ''}
          :root {
            --primary-color: ${
              school.primaryColor &&
              school.primaryColor.toLowerCase() !== '#ffffff' &&
              school.primaryColor.toLowerCase() !== 'white'
                ? school.primaryColor
                : '#ff6666'
            };
            --secondary-color: ${
              school.secondaryColor &&
              school.secondaryColor.toLowerCase() !== '#ffffff' &&
              school.secondaryColor.toLowerCase() !== 'white'
                ? school.secondaryColor
                : '#66cc66'
            };
            --accent1: #0066ff;
            --accent2: #ffcc00;
          }
          body {
            font-family: 'Comic Sans MS', cursive, sans-serif;
            background: #ffffff;
            margin: 0;
            padding: 0;
            color: #333;
            font-size: 1em;
          }
          .watermark {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            font-size: 5em;
            color: rgba(0, 0, 0, 0.1);
            z-index: -1;
          }
          .page {
            width: 90%;
            margin: 40px auto;
            background: white;
            border: 5px solid var(--primary-color);
            border-radius: 15px;
            padding: 20px;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
            position: relative;
          }
          .letterhead {
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 5px;
            background: var(--primary-color);
            color: white;
            border-radius: 10px 10px 0 0;
            border-bottom: 3px dashed var(--secondary-color);
            max-height: 150px;
            overflow: hidden;
            position: relative;
          }
          .letterhead img {
            width: 120px;
            height: auto;
            background: white;
            padding: 2px;
            border-radius: 10px;
            margin-left: 10px;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          }
          .school-info {
            text-align: center;
            margin-left: 10px;
          }
          .school-name {
            font-size: 2em;
            font-weight: bold;
            text-transform: uppercase;
            margin: 0;
            line-height: 1.3;
          }
          .address {
            font-size: 0.9em;
            font-style: italic;
            margin: 3px 0 0 0;
            line-height: 1.3;
          }
          .report-title {
            text-align: center;
            font-size: 1.8em;
            font-weight: bold;
            color: var(--primary-color);
            margin: 7px 0;
            text-transform: uppercase;
            line-height: 1.3;
            position: relative;
          }
          .info-container {
            display: flex;
            align-items: flex-start;
            justify-content: flex-start;
            margin: 7px 0; /* Increased from 7.5px */
            max-height: 120px; /* Increased from 7.5px */
            padding-bottom: 7px; /* Increased from 7.5px */
          }
          .info-container img {
            width: 100px; /* Restored to 100px */
            height: auto;
            border: 2px solid var(--primary-color); /* Restored to 2px */
            border-radius: 10px; /* Restored to 10px */
            background: white;
          }
          .info-table {
            margin-left: 10px; /* Restored to 10px */
            width: 65%; /* Increased from 60% for balance */
            border-collapse: collapse;
          }
          .info-table td {
            padding: 2px; /* Increased from 3.25px */
            font-size: 1.2em; /* Increased from 1.825em (assuming typo; adjusted to reasonable size) */
            color: #000;
            border-bottom: 1px dashed var(--primary-color); /* Restored to 1px */
            line-height: 1.3;
          }
          .label {
            font-weight: bold;
            color: var(--primary-color);
          }
          .result {
            width: 100%;
            border-collapse: collapse;
            margin-top: 15px; /* Restored to 15px */
            background: white;
          }
          .result th, .result td {
            border: 2px solid var(--primary-color); /* Restored to 2px */
            padding: 2px; /* Increased from 6px */
            text-align: left;
            font-size: 1.2em; /* Increased from 1.2em for table readability */
            color: #333;
            line-height: 1.3;
          }
          .result th {
            background: var(--primary-color);
            color: white;
            text-transform: uppercase;
          }
          .result tr:nth-child(even) {
            background: #f9f9f9;
          }
          .key-section {
            margin: 0; /* Increased from 1.25px for better spacing */
            background: #f9f9f9; /* Light background */
          }
          .key-section h3 {
            font-size: 1.2em; /* Increased from 1.35em for emphasis */
            color: var(--primary-color);
            margin: 0 0 12px 0; /* Increased from 7.5px */
            text-align: left;
            text-transform: uppercase;
          }
          .key-table {
            width: 100%; /* Increased from 80% to utilize space */
            margin: 0 auto; /* Centered */
            border-collapse: collapse;
          }
          .key-table th, .key-table td {
            border: 2px solid var(--primary-color); /* Increased from 1.5px */
            text-align: left;
            font-size: 1em; /* Increased from 1.2em for consistency with result table */
            color: #333;
            font-style: italic;
            padding: 2px; /* Added padding for better spacing */
          }
          .key-table th {
            background: var(--primary-color); /* Secondary color for header */
            color: white;
            text-transform: uppercase;
          }
          .key-table tr:nth-child(even) {
            background: #fff; /* White background for even rows */
          }
          .comments {
            font-size: 1.2em; /* Increased from 1.25em for readability */
            padding: 7px 10px; /* Increased from 7.5px 15px */
            margin: 2px 0; /* Increased from 7.5px */
            border: 2px solid var(--primary-color); /* Restored to 2px */
            background: #fff;
            color: #000;
            border-radius: 10px; /* Restored to 10px */
            line-height: 1;
            position: relative;
            margin-left: 20px; /* Restored to 20px */
          }
          .comments::before {
            content: '';
            position: absolute;
            top: 10px; /* Restored to 10px */
            left: -20px; /* Restored to -20px */
            width: 0;
            height: 0;
            border: 10px solid transparent; /* Restored to 10px */
            border-right-color: var(--primary-color);
          }
          .comments::after {
            content: '';
            position: absolute;
            top: 12px; /* Restored to 12px */
            left: -16px; /* Restored to -16px */
            width: 0;
            height: 0;
            border: 8px solid transparent; /* Restored to 8px */
            border-right-color: #fff;
          }
          .signature img {
            width: 100px; /* Restored to 100px */
            height: auto;
            border: none;
            border-radius: 5px; /* Restored to 5px */
          }
          .signature-label {
            font-size: 1em; /* Increased from 1.275em */
            font-weight: bold;
            text-transform: uppercase;
            color: var(--primary-color);
            line-height: 1.3;
          }
          .signature-section {
            text-align: center;
            border-top: 2px solid var(--primary-color); /* Restored to 2px */
          }
          .signature {
            display: flex;
            flex-direction: row;
            align-items: center;
            width: 300px; /* Restored to 180px */
            margin: auto;
          }
        </style>
      </head>
      <body>
        ${htmlReports.join('')}
            <div class="motto" style="text-align: center; font-style: italic; margin-top: 20px;">
          ${school.school_motto || 'Empowering Learners for a Brighter Future'}
        </div>
      </body>
      </html>`;

    if (!combinedHtml) {
      return res.status(404).json({error: 'No HTML content generated'});
    }

    // PDF generation options
    const options = {
      format: 'A4',
      border: {
        top: '0.15in',
        right: '0.25in',
        bottom: '0.1in',
        left: '0.25in',
      },
      footer: {
        height: '15mm',
        contents: `<hr style="border:1px solid black; margin: 0;"><div style="display: flex; align-items: center; justify-content: center; padding: 2px 0;">Powered By Elimurise. <span style="margin-left: 10px; color:#444;">{{page}}/{{pages}}</span></div>`,
      },
      childProcessOptions: {
        env: {
          OPENSSL_CONF: '/dev/null',
        },
      },
    };

    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="all_learners_assessment_comparison_${term}_${req.current_session}.pdf"`,
    );

    // Generate and stream PDF
    wkhtmltopdf(combinedHtml, {
      pageSize: 'A4',
      encoding: 'UTF-8',
      footerLine: true,
      orientation: 'Portrait',
    }).pipe(res);
  } catch (err) {
    logger.error('Error generating PDF:', err);
    res.status(500).json({error: 'Internal server error'});
  }
});
const rank = score => {
  return score === 4 ? 'EE' : score === 3 ? 'ME' : score === 2 ? 'AE' : score === 1 ? 'BE' : ''; // Return an empty string for any other score
};

router.get('/assessments/all', checkPermission('tests', 'analysis-report'), async (req, res) => {
  try {
    const {term, test, stream, grade} = req.query;
    const query = {};

    if (!term) {
      return res.status(404).json({error: 'Term and Learning Area are required'});
    }
    let school = req?.user?.school;

    query.term = term;
    const session = req.current_session;
    // const enrollment = await Enrollment.find({school, to_stream: stream, to_session: session}).populate('learner');
    // Find all enrollments for the specified criteria
    const testData = await Test.findOne({_id: test});
    let imageDataUrl = '';
    const streamObject = await Stream.findOne({_id: stream, school}).populate('grade');
    if (stream && !streamObject) {
      throw Error('Stream not found');
    }

    let header = {};
    if (grade) {
      const gradeObject = await Grade.findById(grade);
      if (!gradeObject) {
        throw Error('Grade not found');
      }

      header = {grade: gradeObject.name};
    }
    if (stream) {
      const streamObject = await Stream.findOne({_id: stream, school}).populate('grade');
      if (!streamObject) {
        throw Error('Stream not found');
      }
      header = {stream: streamObject.name, grade: streamObject.grade.name};
    }
    logger.warn(header);
    // Ensure the image file path is valid and exists
    let logoDataUrl = '';
    let elimuriselogoDataUrl = '';
    const elimuriselogo = 'logo.png';
    var _basePath = elimuriselogo;

    if (_basePath && fs.existsSync(_basePath)) {
      try {
        const imageBuffer = fs.readFileSync(_basePath);
        const base64Image = imageBuffer.toString('base64');
        const imageType = 'image/png'; // Adjust based on your image type (e.g., image/jpeg)
        elimuriselogoDataUrl = `data:${imageType};base64,${base64Image}`;
      } catch (error) {
        logger.error('Error reading or encoding image file:', error);
      }
    } else {
      logger.warn('Image file path is invalid or file does not exist:', imageDataUrl);
    }
    // Ensure the image file path is valid and exists
    if (school.logo && fs.existsSync(school.logo)) {
      try {
        const imageBuffer = fs.readFileSync(school.logo);
        const base64Image = imageBuffer.toString('base64');
        const imageType = 'image/png'; // Adjust based on your image type (e.g., image/jpeg)
        logoDataUrl = `data:${imageType};base64,${base64Image}`;
      } catch (error) {
        logger.error('Error reading or encoding image file:', error);
      }
    } else {
      logger.warn('Image file path is invalid or file does not exist:');
    }

    const {data, learningAreaStats} = await summativeAssessment.generateBroadsheet(
      school._id,
      grade,
      stream,
      term,
      test,
      session,
    );

    const subjects = Array.from(new Set(data.flatMap(item => Object.keys(item.assessments))));

    const html = await new Promise((resolve, reject) => {
      app.render(
        'SummativeBroadsheet',
        {school, logoDataUrl, data, subjects, header, elimuriselogoDataUrl, testData, term, learningAreaStats},
        (err, renderedHtml) => {
          if (err) reject(err);
          resolve(renderedHtml);
        },
      );
    });

    // pdf.create(htmls, options).toBuffer((err, buffer) => {
    //   if (err) {
    //     return res.status(404).send(err.message);
    //   }

    //   res.setHeader('Content-Type', 'application/pdf');
    //   res.setHeader('Content-Disposition', 'attachment; filename=output.pdf');
    //   res.send(buffer);
    // });
    wkhtmltopdf(html, {
      pageSize: 'A4',
      encoding: 'UTF-8',
      disableSmartShrinking: true,
      footerLine: true,

      orientation: 'Landscape', // Optional: change to 'Landscape' if needed
    }).pipe(res);
  } catch (err) {
    logger.warn(err);
    res.status(404).json({error: err.message});
  }
});
router.get('/assessments/analysis', checkPermission('tests', 'analysis-report'), async (req, res) => {
  const {term, test, stream, grade, type} = req.query;
  const query = {};
  let school = req?.user?.school;
  let elimuriselogoDataUrl = '';
  let imageDataUrl = '';
  const elimuriselogo = 'logo.png';
  const session = req.current_session;
  let logoDataUrl = '';
  var _basePath = elimuriselogo;

  if (_basePath && fs.existsSync(_basePath)) {
    try {
      const imageBuffer = fs.readFileSync(_basePath);
      const base64Image = imageBuffer.toString('base64');
      const imageType = 'image/png'; // Adjust based on your image type (e.g., image/jpeg)
      elimuriselogoDataUrl = `data:${imageType};base64,${base64Image}`;
    } catch (error) {
      logger.error('Error reading or encoding image file:', error);
    }
  } else {
    logger.warn('Image file path is invalid or file does not exist:', imageDataUrl);
  }
  if (school.logo && fs.existsSync(school.logo)) {
    try {
      const imageBuffer = fs.readFileSync(school.logo);
      const base64Image = imageBuffer.toString('base64');
      const imageType = 'image/png'; // Adjust based on your image type (e.g., image/jpeg)
      logoDataUrl = `data:${imageType};base64,${base64Image}`;
    } catch (error) {
      logger.error('Error reading or encoding image file:', error);
    }
  } else {
    logger.warn('Image file path is invalid or file does not exist:');
  }
  let header = {};
  if (grade) {
    const gradeObject = await Grade.findById(grade);
    if (!gradeObject) {
      throw Error('Grade not found');
    }

    header = {grade: gradeObject.name};
  }
  if (stream) {
    const streamObject = await Stream.findById(stream).populate('grade');
    if (!streamObject) {
      throw Error('Stream not found');
    }
    header = {stream: streamObject.name, grade: streamObject.grade.name};
  }
  const data = await summativeAssessment.analyzePerformance(grade, stream, term, test, school._id, session);

  const html = await new Promise((resolve, reject) => {
    app.render('SummativeAnalysis', {school, logoDataUrl, data, header, elimuriselogoDataUrl}, (err, renderedHtml) => {
      if (err) reject(err);
      resolve(renderedHtml);
    });
  });
  const options = {
    format: 'A4',
    orientation: 'portrait', // Set the orientation to landscape
    border: {
      top: '0.3in',
      right: '0.5in',
      bottom: '0.2in',
      left: '0.5in',
    },
    footer: {
      contents: `
        <hr style="border:2px solid black">
        <div id="pageHeader">
          <img src="${elimuriselogoDataUrl}" alt="Learner" style="width:50px; border-radius: 5px;">
          Powered By Elimurise
        </div>
        <div style="margin-top:10px;color: #444;text-align:center">
          {{page}} / {{pages}}
        </div>`,
    },
    childProcessOptions: {
      env: {
        OPENSSL_CONF: '/dev/null',
      },
    },
  };

  pdf.create(html, options).toBuffer((err, buffer) => {
    if (err) {
      return res.status(404).send(err.message);
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=output.pdf');
    res.send(buffer);
  });
  // return res.json(data);
});
router.get('/assessments/analysis-stream', checkPermission('tests', 'analysis-report'), async (req, res) => {
  const {term, test, stream, grade, type} = req.query;
  const query = {};
  let school = req?.user?.school;
  let elimuriselogoDataUrl = '';
  let imageDataUrl = '';
  const elimuriselogo = 'logo.png';
  const session = req.current_session;
  let logoDataUrl = '';
  var _basePath = elimuriselogo;

  if (_basePath && fs.existsSync(_basePath)) {
    try {
      const imageBuffer = fs.readFileSync(_basePath);
      const base64Image = imageBuffer.toString('base64');
      const imageType = 'image/png'; // Adjust based on your image type (e.g., image/jpeg)
      elimuriselogoDataUrl = `data:${imageType};base64,${base64Image}`;
    } catch (error) {
      logger.error('Error reading or encoding image file:', error);
    }
  } else {
    logger.warn('Image file path is invalid or file does not exist:', imageDataUrl);
  }
  if (school.logo && fs.existsSync(school.logo)) {
    try {
      const imageBuffer = fs.readFileSync(school.logo);
      const base64Image = imageBuffer.toString('base64');
      const imageType = 'image/png'; // Adjust based on your image type (e.g., image/jpeg)
      logoDataUrl = `data:${imageType};base64,${base64Image}`;
    } catch (error) {
      logger.error('Error reading or encoding image file:', error);
    }
  } else {
    logger.warn('Image file path is invalid or file does not exist:');
  }
  let header = {};
  if (grade) {
    const gradeObject = await Grade.findById(grade);
    if (!gradeObject) {
      throw Error('Grade not found');
    }

    header = {grade: gradeObject.name};
  }
  if (stream) {
    const streamObject = await Stream.findById(stream).populate('grade');
    if (!streamObject) {
      throw Error('Stream not found');
    }
    header = {stream: streamObject.name, grade: streamObject.grade.name};
  }
  const data = await summativeAssessment.analyzeStreamsAndLearners(grade, term, test, school._id, session);
  logger.warn(JSON.stringify(data));
  const testData = await Test.findOne({_id: test});
  const html = await new Promise((resolve, reject) => {
    app.render(
      'SummativeStreamAnalysis',
      {school, logoDataUrl, data, header, elimuriselogoDataUrl, term, test: testData.name, isMultiStream: true},
      (err, renderedHtml) => {
        if (err) reject(err);
        resolve(renderedHtml);
      },
    );
  });
  const options = {
    format: 'A4',
    orientation: 'portrait', // Set the orientation to landscape
    border: {
      top: '0.3in',
      right: '0.5in',
      bottom: '0.2in',
      left: '0.5in',
    },
    footer: {
      contents: `
        <hr style="border:2px solid black">
        <div id="pageHeader">
          <img src="${elimuriselogoDataUrl}" alt="Learner" style="width:50px; border-radius: 5px;">
          Powered By Elimurise
        </div>
        <div style="margin-top:10px;color: #444;text-align:center">
          {{page}} / {{pages}}
        </div>`,
    },
    childProcessOptions: {
      env: {
        OPENSSL_CONF: '/dev/null',
      },
    },
  };

  pdf.create(html, options).toBuffer((err, buffer) => {
    if (err) {
      return res.status(404).send(err.message);
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=output.pdf');
    res.send(buffer);
  });
  // return res.json(data);
});

module.exports = router;
