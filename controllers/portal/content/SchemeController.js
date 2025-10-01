const express = require('express');
const router = express.Router();
const SchemeService = require('../../../services/portal/SchemeService');
const {checkPermission} = require('../../../middleware/portal-auth');
const LearningArea = require('../../../models/cms/content/learning_area');
const Lesson = require('../../../models/cms/content/Lesson');
const {SchemeLesson, Scheme} = require('../../../models/portal/content/Scheme');
const mongoose = require('mongoose');
const wkhtmltopdf = require('wkhtmltopdf');

const schemeService = new SchemeService();

// GET all schemes (with optional filters)
router.get('/', async (req, res) => {
  try {
    const {page, limit, term, year, learning_area} = req.query;
    const filters = {};
    if (term) filters.term = term;
    if (year) filters.year = year;
    if (learning_area) filters.learning_area = learning_area;

    const schemes = await schemeService.getSchemes({page, limit, filters});
    res.json(schemes);
  } catch (error) {
    res.status(500).json({error: error.message});
  }
});

// GET scheme by ID
router.get('/:id', async (req, res) => {
  try {
    const scheme = await schemeService.getSchemeById(req.params.id);
    res.json({data: scheme});
  } catch (error) {
    res.status(404).json({error: error.message});
  }
});

// POST create scheme
router.post('/', async (req, res) => {
  const session = await mongoose.startSession();
  let transactionCommitted = false;

  try {
    session.startTransaction();

    const {
      grade,
      learning_area,
      term,
      year,
      firstWeek,
      lastWeek,
      firstLesson,
      lastLesson,
      doubleLesson,
      lessonsPerWeek,
      strands,
      substrands,
      breaks,
    } = req.body;

    // Validate required fields
    if (
      !grade ||
      !learning_area ||
      !term ||
      !year ||
      !firstWeek ||
      !lastWeek ||
      !firstLesson ||
      !lastLesson ||
      !lessonsPerWeek ||
      !strands ||
      !substrands ||
      !Array.isArray(strands) ||
      !Array.isArray(substrands)
    ) {
      throw new Error('All fields are required and strands/substrands must be arrays');
    }

    // Validate numeric fields
    const parsedFirstWeek = parseInt(firstWeek, 10);
    const parsedLastWeek = parseInt(lastWeek, 10);
    const parsedFirstLesson = parseInt(firstLesson, 10);
    const parsedLastLesson = parseInt(lastLesson, 10);
    const parsedLessonsPerWeek = parseInt(lessonsPerWeek, 10);

    if (
      isNaN(parsedFirstWeek) ||
      isNaN(parsedLastWeek) ||
      isNaN(parsedFirstLesson) ||
      isNaN(parsedLastLesson) ||
      isNaN(parsedLessonsPerWeek) ||
      parsedFirstWeek < 1 ||
      parsedLastWeek < parsedFirstWeek ||
      parsedFirstLesson < 1 ||
      parsedLastLesson < parsedFirstLesson ||
      parsedLessonsPerWeek < 1
    ) {
      throw new Error('Invalid numeric inputs for weeks, lessons, or lessons per week');
    }

    // Validate doubleLesson format (e.g., "1-2")
    let doubleLessonRange = null;
    if (doubleLesson) {
      const [start, end] = doubleLesson.split('-').map(Number);
      if (isNaN(start) || isNaN(end) || start >= end || start < parsedFirstLesson || end > parsedLastLesson) {
        throw new Error('Invalid doubleLesson format or range');
      }
      doubleLessonRange = {start, end};
    }

    // Validate breaks
    const breakPeriods = breaks
      ? breaks
          .filter(b => b.title && b.duration && b.startWeek && b.endWeek)
          .map((b, index) => {
            const startWeekNum = parseInt(b.startWeek, 10);
            const endWeekNum = parseInt(b.endWeek, 10);
            if (
              !b.title ||
              !b.duration ||
              isNaN(startWeekNum) ||
              isNaN(endWeekNum) ||
              startWeekNum < parsedFirstWeek ||
              endWeekNum > parsedLastWeek ||
              startWeekNum > endWeekNum
            ) {
              throw new Error(
                `Invalid break at index ${index}: title, duration, startWeek, and endWeek must be valid numbers, with startWeek <= endWeek within range ${parsedFirstWeek}-${parsedLastWeek}`,
              );
            }
            if (!['predefined', 'custom'].includes(b.duration)) {
              throw new Error(`Invalid duration in break at index ${index}: must be 'predefined' or 'custom'`);
            }
            if (b.duration === 'predefined' && startWeekNum !== endWeekNum) {
              throw new Error(`Invalid break at index ${index}: for predefined duration, startWeek must equal endWeek`);
            }
            return {
              title: b.title,
              duration: b.duration,
              startWeek: startWeekNum,
              startLesson: b.startLesson || '',
              endWeek: endWeekNum,
              endLesson: b.endLesson || '',
            };
          })
      : [];

    // Generate break weeks
    const breakWeeks = new Set();
    breakPeriods.forEach(b => {
      for (let week = b.startWeek; week <= b.endWeek; week++) {
        breakWeeks.add(week);
      }
    });

    // Validate learning_area and grade compatibility
    const learningArea = await LearningArea.findOne({_id: learning_area, grade_id: grade}).session(session);
    if (!learningArea) {
      throw new Error('Invalid learning_area or grade');
    }

    // Fetch lessons for the given substrands
    const lessons = await Lesson.find({
      substrand: {$in: substrands},
    })
      .populate('substrand')
      .session(session);
    if (lessons.length === 0) {
      throw new Error('No lessons found for the given substrands and lesson range');
    }

    // Create SchemeLesson documents
    const schemeLessons = [];
    for (const lesson of lessons) {
      const schemeLesson = new SchemeLesson({
        master_lesson: lesson._id,
        substrand: lesson.substrand._id,
        lesson_number: lesson.lesson_number,
        learning_outcome: lesson.learning_outcome,
        key_inquiry_questions: lesson.key_inquiry_questions || '',
        core_competencies: lesson.core_competencies || '',
        values: lesson.values || '',
        contemporary_issues: lesson.contemporary_issues || '',
        links_to_learning_areas: lesson.links_to_learning_areas || '',
        number_of_lessons: lesson.number_of_lessons || 1,
        suggested_learning_experiences: lesson.suggested_learning_experiences || '',
        suggested_assessment_methods: lesson.suggested_assessment_methods || '',
        suggested_learning_resources: lesson.suggested_learning_resources || '',
        non_formal_activities: lesson.non_formal_activities || '',
        reference: lesson.reference || '',
        lesson_steps: lesson.lesson_steps || [],
        learning_organization: lesson.learning_organization || [],
      });
      await schemeLesson.save({session});
      schemeLessons.push(schemeLesson);
    }

    // Distribute lessons across weeks, respecting breaks
    const weeks = [];
    let currentLessonIndex = 0;

    for (let week = parsedFirstWeek; week <= parsedLastWeek; week++) {
      if (breakWeeks.has(week)) continue;

      const weekLessons = [];
      let lessonsAssigned = 0;

      while (lessonsAssigned < parsedLessonsPerWeek && currentLessonIndex < schemeLessons.length) {
        const currentLesson = schemeLessons[currentLessonIndex];
        const lessonNumber = currentLesson.lesson_number;

        if (doubleLessonRange && lessonNumber >= doubleLessonRange.start && lessonNumber <= doubleLessonRange.end) {
          const doubleLessons = schemeLessons.filter(
            sl => sl.lesson_number >= doubleLessonRange.start && sl.lesson_number <= doubleLessonRange.end,
          );
          if (doubleLessons.length > 0) {
            weekLessons.push(...doubleLessons.map(sl => ({scheme_lesson: sl._id})));
            currentLessonIndex += doubleLessons.length;
            lessonsAssigned += 1;
          } else {
            currentLessonIndex++;
          }
        } else {
          weekLessons.push({scheme_lesson: currentLesson._id});
          currentLessonIndex++;
          lessonsAssigned++;
        }
      }

      if (weekLessons.length > 0) {
        weeks.push({week, lessons: weekLessons});
      }
    }

    if (currentLessonIndex < schemeLessons.length) {
      throw new Error('Not enough weeks to accommodate all lessons with the given lessons per week');
    }

    // Create Scheme document
    const scheme = new Scheme({
      learning_area,
      term,
      year,
      reference_book: '',
      created_by: req.user._id,
      weeks,
      breaks: breakPeriods,
    });

    await scheme.save({session});

    // Commit transaction
    await session.commitTransaction();
    transactionCommitted = true;

    // Populate the scheme for response
    const populatedScheme = await Scheme.findById(scheme._id)
      .populate({
        path: 'weeks.lessons.scheme_lesson',
        populate: {path: 'substrand master_lesson'},
      })
      .populate('learning_area')
      .populate('created_by');

    res.status(201).json({
      message: 'Scheme of Work created successfully',
      data: populatedScheme,
    });
  } catch (error) {
    console.error('Error creating scheme:', error);
    res.status(error.message.includes('Invalid') ? 400 : 500).json({message: error.message});
  } finally {
    if (!transactionCommitted) {
      await session.abortTransaction().catch(err => console.error('Abort failed:', err));
    }
    session.endSession();
  }
});

// PUT update scheme
router.put('/:id', async (req, res) => {
  const session = await mongoose.startSession();
  let transactionCommitted = false;

  try {
    session.startTransaction();

    const {id} = req.params;
    const {scheme_lesson_id, field, value} = req.body;

    // Validate input
    if (!scheme_lesson_id || !field || value === undefined) {
      throw new Error('Missing scheme_lesson_id, field, or value');
    }

    const allowedFields = [
      'learning_outcome',
      'suggested_learning_experiences',
      'key_inquiry_questions',
      'suggested_learning_resources',
      'suggested_assessment_methods',
      'lesson_steps',
      'learning_organization',
      'reflection',
    ];
    if (!allowedFields.includes(field)) {
      throw new Error(`Invalid field: ${field}. Must be one of ${allowedFields.join(', ')}`);
    }

    // Validate lesson_steps and learning_organization if provided
    if (field === 'lesson_steps') {
      if (!Array.isArray(value)) {
        throw new Error('lesson_steps must be an array');
      }
      value.forEach((step, index) => {
        if (!step.title || !step.duration_minutes || !step.description) {
          throw new Error(
            `Invalid lesson step at index ${index}: title, duration_minutes, and description are required`,
          );
        }
        if (typeof step.is_extended_activity !== 'boolean') {
          step.is_extended_activity = false; // Default if not provided
        }
      });
    }
    if (field === 'learning_organization') {
      if (!Array.isArray(value)) {
        throw new Error('learning_organization must be an array');
      }
      value.forEach((org, index) => {
        if (!org.type) {
          throw new Error(`Invalid learning organization at index ${index}: type is required`);
        }
      });
    }

    // Find existing scheme
    const existingScheme = await Scheme.findById(id).session(session);
    if (!existingScheme) {
      throw new Error('Scheme not found');
    }

    // Validate scheme lesson
    const schemeLesson = await SchemeLesson.findById(scheme_lesson_id).session(session);
    if (!schemeLesson) {
      throw new Error(`SchemeLesson with ID ${scheme_lesson_id} not found`);
    }

    // Verify the lesson belongs to the scheme
    const lessonInScheme = existingScheme.weeks.some(week =>
      week.lessons.some(lesson => lesson.scheme_lesson.toString() === scheme_lesson_id),
    );
    if (!lessonInScheme) {
      throw new Error(`SchemeLesson ${scheme_lesson_id} does not belong to scheme ${id}`);
    }

    // Validate the lesson is not in a break week
    const breakWeeks = new Set();
    existingScheme.breaks.forEach(b => {
      for (let w = b.startWeek; w <= b.endWeek; w++) {
        breakWeeks.add(w);
      }
    });
    const lessonWeek = existingScheme.weeks.find(week =>
      week.lessons.some(lesson => lesson.scheme_lesson.toString() === scheme_lesson_id),
    )?.week;
    if (lessonWeek && breakWeeks.has(lessonWeek)) {
      throw new Error(`Lesson in week ${lessonWeek} is in a break week and cannot be updated`);
    }

    // Update the specified field
    schemeLesson[field] = value;
    await schemeLesson.save({session});

    // Commit transaction
    await session.commitTransaction();
    transactionCommitted = true;

    // Populate the updated scheme for response
    const populatedScheme = await Scheme.findById(id)
      .populate({
        path: 'weeks.lessons.scheme_lesson',
        populate: {path: 'substrand master_lesson'},
      })
      .populate('learning_area')
      .populate('created_by')
      .session(session);

    res.status(200).json({
      message: 'Scheme lesson updated successfully',
      data: populatedScheme,
    });
  } catch (error) {
    console.error('Error updating scheme lesson:', error);
    res
      .status(error.message.includes('Invalid') || error.message.includes('not found') ? 400 : 500)
      .json({message: error.message});
  } finally {
    if (!transactionCommitted) {
      await session.abortTransaction().catch(err => console.error('Abort failed:', err));
    }
    session.endSession();
  }
});

// GET scheme PDF by ID
router.get('/:id/download', async (req, res) => {
  try {
    const schemeId = req.params.id;

    // Fetch scheme with populated fields
    const scheme = await Scheme.findById(schemeId)
      .populate('learning_area', 'name')
      .populate({
        path: 'weeks.lessons.scheme_lesson',
        populate: [
          {
            path: 'master_lesson',
            select: 'learning_outcome substrand',
          },
          {
            path: 'substrand',
            select: 'name strand',
            populate: {
              path: 'strand',
              select: 'name',
            },
          },
        ],
      })
      .lean();

    if (!scheme) {
      return res.status(404).json({error: 'Scheme not found'});
    }

    // Destructure breaks and combine with weeks into a single sorted list
    const {breaks} = scheme;
    const weeksWithBreaks = [...scheme.weeks];

    breaks.forEach(breakItem => {
      for (let week = breakItem.startWeek; week <= breakItem.endWeek; week++) {
        weeksWithBreaks.push({week, isBreak: true, breakTitle: breakItem.title});
      }
    });

    // Sort by week number
    const sortedItems = weeksWithBreaks.sort((a, b) => a.week - b.week);

    // Generate HTML content based on the provided sample table structure
    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Scheme of Work - ${scheme.learning_area.name} - Term ${scheme.term} ${scheme.year}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 0; padding: 20mm; }
    .header { text-align: center; margin-bottom: 20mm; }
    .header h1 { margin: 0; font-size: 24px; }
    .header p { margin: 5px 0; }
    #myTable { width: 100%; table-layout: fixed; border-collapse: collapse; font-size: 15px; }
    #myTable th, #myTable td { border: 1px solid #000; padding: 8px; text-align: left; vertical-align: top; }
    #myTable th { font-weight: bold; background-color: #f2f2f2; }
    #myTable .week_column { text-align: center; }
    #myTable .text-center { text-align: center; }
    #myTable .contenteditable { min-height: 1.5em; }
    .breaks-row { font-weight: bold; text-align: center; background-color: #f0f0f0; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Scheme of Work</h1>
    <p><strong>Learning Area:</strong> ${scheme.learning_area.name}</p>
    <p><strong>Term:</strong> ${scheme.term}</p>
    <p><strong>Year:</strong> ${scheme.year}</p>
    <p><strong>Reference Book:</strong> ${scheme.reference_book || 'N/A'}</p>
  </div>

  <table id="myTable" class="table-bordered table-responsive myTable">
    <thead>
      <tr style="font-size: 15px; font-weight: bold;background-color: #f2f2f2;">
        <th width="3%">WK</th>
        <th width="3%">LSN</th>
        <th>STRAND</th>
        <th>SUB-STRAND</th>
        <th width="20%">LESSON LEARNING OUTCOMES</th>
        <th width="20%">LEARNING EXPERIENCES</th>
        <th>KEY INQUIRY QUESTIONS</th>
        <th>LEARNING RESOURCES</th>
        <th>ASSESSMENT METHODS</th>
        <th>REFLECTION</th>
      </tr>
    </thead>
    <tbody>
      ${sortedItems
        .map((item, index) => {
          const isFirstOfWeek = index === 0 || sortedItems[index - 1].week !== item.week;
          const lessons = item.lessons || [];
          const rowspan = lessons.length || 1;
          const isBreak =
            item.isBreak ||
            (!lessons.length && scheme.breaks.some(b => b.startWeek <= item.week && b.endWeek >= item.week));
          const breakTitle =
            item.breakTitle ||
            scheme.breaks.find(b => b.startWeek <= item.week && b.endWeek >= item.week)?.title ||
            'No Lessons Scheduled';

          return `
            <tr>
              ${isFirstOfWeek ? `<td class="week_column" rowspan="${rowspan}">${item.week}</td>` : ''}
              ${
                isBreak
                  ? `
                    <td colspan="9" class="text-center breaks-row">
                      <h4>${breakTitle}</h4>
                    </td>
                  </tr>
                `
                  : lessons
                      .map(
                        (lesson, lessonIndex) => `
                      ${lessonIndex === 0 ? '' : '<tr>'}
                        <td>${lessonIndex + 1}</td>
                        <td>
                          <div class="contenteditable" data-column="strand">
                             ${lesson.scheme_lesson.substrand.strand.name || 'N/A'}
                          </div>
                        </td>
                        <td>
                          <div class="contenteditable" data-column="substrand">
                            ${lesson.scheme_lesson.substrand.name || 'N/A'}
                          </div>
                        </td>
                        <td>
                          <div class="contenteditable" data-column="learning_outcomes">
                            ${lesson.scheme_lesson.learning_outcome || 'N/A'}
                          </div>
                        </td>
                        <td>
                          <div class="contenteditable" data-column="learning_experiences">
                            ${lesson.scheme_lesson.suggested_learning_experiences || 'N/A'}
                          </div>
                        </td>
                        <td>
                          <div class="contenteditable" data-column="key_inquiry_questions">
                            ${lesson.scheme_lesson.key_inquiry_questions || 'N/A'}
                          </div>
                        </td>
                        <td>
                          <div class="contenteditable" data-column="learning_resources">
                            ${lesson.scheme_lesson.suggested_learning_resources || 'N/A'}
                          </div>
                        </td>
                        <td>
                          <div class="contenteditable" data-column="assessment_methods">
                            ${lesson.scheme_lesson.suggested_assessment_methods || 'N/A'}
                          </div>
                        </td>
                        <td></td>
                      ${lessonIndex === lessons.length - 1 ? '</tr>' : ''}
                    `,
                      )
                      .join('')
              }
          `;
        })
        .join('')}
    </tbody>
  </table>
</body>
</html>
    `;

    // Generate PDF and stream to client
    wkhtmltopdf(htmlContent, {
      pageSize: 'A4',
      orientation: 'Landscape',
    }).pipe(res);

    res.setHeader('Content-Disposition', `attachment; filename="scheme_${schemeId}_${scheme.term}_${scheme.year}.pdf"`);
    res.setHeader('Content-Type', 'application/pdf');
  } catch (error) {
    console.error('Error generating PDF:', error);
    res.status(500).json({error: 'Failed to generate PDF'});
  }
});

module.exports = router;
