const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const wkhtmltopdf = require('wkhtmltopdf');
const LessonPlan = require('../../../models/portal/content/LessonPlan');
const {SchemeLesson} = require('../../../models/portal/content/Scheme');
const PortalUser = require('../../../models/portal/auth/User');
const {checkPermission} = require('../../../middleware/portal-auth');

// POST /api/lesson-plans
router.post('/', async (req, res) => {
  const session = await mongoose.startSession();
  let transactionCommitted = false;

  try {
    session.startTransaction();

    const {scheme_lessons, date, time, type, status} = req.body;
    const teacher_id = req.user._id;
    // Validate required fields
    if (!scheme_lessons || !Array.isArray(scheme_lessons) || !teacher_id) {
      throw new Error('Missing required fields: scheme_lessons, teacher_id, date, time, type');
    }

    if (status && !['draft', 'published'].includes(status)) {
      throw new Error('Invalid status: must be draft or published');
    }

    // Validate teacher_id
    const teacher = await PortalUser.findById(teacher_id).session(session);
    if (!teacher) {
      throw new Error('Invalid teacher_id: teacher not found');
    }

    // Validate scheme_lesson IDs
    const schemeLessonIds = scheme_lessons.map(sl => sl.scheme_lesson);
    const existingLessons = await SchemeLesson.find({
      _id: {$in: schemeLessonIds},
    }).session(session);

    if (existingLessons.length !== schemeLessonIds.length) {
      throw new Error('One or more scheme_lesson IDs are invalid');
    }

    // Create LessonPlan
    const lessonPlan = new LessonPlan({
      scheme_lessons: scheme_lessons.map(sl => ({
        scheme_lesson: sl.scheme_lesson,
        reflection: sl.reflection || '',
      })),
      teacher_id,
      //   date: new Date.now(),
      time,
      type,
      status: status || 'draft',
    });

    await lessonPlan.save({session});

    // Commit transaction
    await session.commitTransaction();
    transactionCommitted = true;

    // Populate for response
    const populatedLessonPlan = await LessonPlan.findById(lessonPlan._id)
      .populate({
        path: 'scheme_lessons.scheme_lesson',
        populate: [
          {path: 'substrand', select: 'name strand', populate: {path: 'strand', select: 'name'}},
          {path: 'master_lesson', select: 'learning_outcome'},
        ],
      })
      .populate('teacher_id', 'name')
      .session(session);

    res.status(201).json({
      message: 'Lesson plan created successfully',
      data: populatedLessonPlan,
    });
  } catch (error) {
    console.error('Error creating lesson plan:', error);
    res.status(error.message.includes('Invalid') ? 400 : 500).json({message: error.message});
  } finally {
    if (!transactionCommitted) {
      await session.abortTransaction().catch(err => console.error('Abort failed:', err));
    }
    session.endSession();
  }
});

// GET /api/lesson-plans/raw/:id
router.get('/raw/:id', async (req, res) => {
  try {
    const lessonPlan = await LessonPlan.findById(req.params.id)
      .populate({
        path: 'scheme_lessons.scheme_lesson',
        populate: [
          {path: 'substrand', select: 'name strand', populate: {path: 'strand', select: 'name'}},
          {path: 'master_lesson', select: 'learning_outcome'},
        ],
      })
      .populate('teacher_id', 'name')
      .lean();

    if (!lessonPlan) {
      return res.status(404).json({message: 'Lesson plan not found'});
    }

    res.json({data: lessonPlan});
  } catch (error) {
    console.error('Error retrieving lesson plan:', error);
    res.status(500).json({message: error.message});
  }
});

// GET /api/lesson-plans/:id/download
router.get('/:id/download', async (req, res) => {
  try {
    const lessonPlan = await LessonPlan.findById(req.params.id)
      .populate({
        path: 'scheme_lessons.scheme_lesson',
        populate: [
          {path: 'substrand', select: 'name strand', populate: {path: 'strand', select: 'name'}},
          {path: 'master_lesson', select: 'learning_outcome'},
        ],
      })
      .populate('teacher_id', 'name')
      .lean();

    if (!lessonPlan) {
      return res.status(404).json({message: 'Lesson plan not found'});
    }

    // Generate HTML for PDF
    const html = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <title>Lesson Plan - ${lessonPlan.teacher_id?.name || 'N/A'} - ${
      lessonPlan.date ? lessonPlan.date.toISOString().split('T')[0] : 'N/A'
    }</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
            body {
              font-family: 'Arial', sans-serif;
              margin: 0;
              padding: 2rem;
              background-color: #f9fafb;
            }
            .container {
              max-width: 800px;
              margin: 0 auto;
              background: white;
              padding: 2rem;
              border-radius: 8px;
              box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            }
            .header {
              text-align: center;
              margin-bottom: 2rem;
              border-bottom: 2px solid #e5e7eb;
              padding-bottom: 1rem;
            }
            .section {
              margin-bottom: 1.5rem;
            }
            .section h2 {
              font-size: 1.5rem;
              font-weight: bold;
              color: #1f2937;
              margin-bottom: 0.5rem;
            }
            .section p, .section li, .section td {
              color: #4b5563;
              line-height: 1.6;
            }
            .section ul {
              list-style-type: disc;
              padding-left: 1.5rem;
            }
            .section li {
              margin-bottom: 0.5rem;
            }
            .highlight {
              background-color: #f3f4f6;
              padding: 0.5rem;
              border-radius: 4px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 1rem;
            }
            th, td {
              border: 1px solid #e5e7eb;
              padding: 0.75rem;
              text-align: left;
            }
            th {
              background-color: #f3f4f6;
              font-weight: bold;
              color: #1f2937;
            }
            tr:nth-child(even) {
              background-color: #f9fafb;
            }
            @media print {
              body {
                padding: 0;
              }
              .container {
                box-shadow: none;
                border: none;
              }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 class="text-3xl font-bold text-gray-800">Lesson Plan</h1>
              <p class="text-lg"><strong>Learning Area:</strong> ${
                lessonPlan.scheme_lessons[0]?.scheme_lesson.substrand?.strand?.name || 'N/A'
              }</p>
              <p class="text-lg"><strong>Level:</strong> ${lessonPlan.level || 'N/A'}</p>
              <p class="text-lg"><strong>Date:</strong> ${
                lessonPlan.date ? lessonPlan.date.toISOString().split('T')[0] : 'N/A'
              }</p>
              <p class="text-lg"><strong>Time:</strong> ${lessonPlan.time || 'N/A'}</p>
              <p class="text-lg"><strong>Teacher:</strong> ${lessonPlan.teacher_id?.name || 'N/A'}</p>
            </div>
  
            ${lessonPlan.scheme_lessons
              .map(
                (sl, index) => `
              <div class="section">
                <h2>Lesson ${index + 1}</h2>
                <p><strong>Strand:</strong> ${sl.scheme_lesson.substrand?.strand?.name || 'N/A'}</p>
                <p><strong>Substrand:</strong> ${sl.scheme_lesson.substrand?.name || 'N/A'}</p>
                <p><strong>Learning Outcomes:</strong></p>
                <ul>
                  ${
                    sl.scheme_lesson.learning_outcome
                      ?.split('\n')
                      .map(outcome => `<li>${outcome}</li>`)
                      .join('') || '<li>N/A</li>'
                  }
                </ul>
                <p><strong>Key Inquiry Questions:</strong> ${sl.scheme_lesson.key_inquiry_questions || 'N/A'}</p>
                <p><strong>Learning Resources:</strong> <span class="highlight">${
                  sl.scheme_lesson.suggested_learning_resources || 'N/A'
                }</span></p>
                <p><strong>Organization of Learning:</strong></p>
                <div class="learning-org">
                  <ul>
                    ${
                      sl.scheme_lesson.learning_organization?.length
                        ? sl.scheme_lesson.learning_organization
                            .map(org => `<li>${org.type}${org.notes ? ': ' + org.notes : ''}</li>`)
                            .join('')
                        : '<li>N/A</li>'
                    }
                  </ul>
                </div>
                <p><strong>Lesson Steps:</strong></p>
                <div class="lesson-steps">
                  <table>
                    <thead>
                      <tr>
                        <th>Step</th>
                        <th>Duration</th>
                        <th>Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${
                        sl.scheme_lesson.lesson_steps?.length
                          ? sl.scheme_lesson.lesson_steps
                              .map(
                                step => `
                              <tr>
                                <td>${step.title || 'N/A'}</td>
                                <td>${step.duration_minutes ? step.duration_minutes + ' minutes' : 'N/A'}</td>
                                <td>${step.description || 'N/A'}${
                                  step.is_extended_activity ? ' (Extended Activity)' : ''
                                }</td>
                              </tr>
                            `,
                              )
                              .join('')
                          : `<tr><td colspan="3">No lesson steps provided</td></tr>`
                      }
                    </tbody>
                  </table>
                </div>
                <p><strong>Extended Activities:</strong> ${
                  sl.scheme_lesson.lesson_steps
                    ?.filter(step => step.is_extended_activity)
                    .map(step => step.description)
                    .join('; ') || 'N/A'
                }</p>
                <p><strong>Reflection:</strong> ${sl.reflection || 'N/A'}</p>
              </div>
            `,
              )
              .join('')}
          </div>
        </body>
        </html>
      `;

    // Generate PDF and stream to client
    wkhtmltopdf(html, {
      pageSize: 'A4',
      orientation: 'Portrait',
    }).pipe(res);

    res.setHeader('Content-Disposition', `attachment; filename="lesson_plan_${req.params.id}.pdf"`);
    res.setHeader('Content-Type', 'application/pdf');
  } catch (error) {
    console.error('Error generating PDF:', error);
    res.status(500).json({message: 'Failed to generate PDF'});
  }
});

module.exports = router;
