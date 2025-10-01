// routes/timetableRoutes.js (or wherever this file resides)
const express = require('express');
const router = express.Router();
const Timetable = require('../../../models/portal/content/Timetable');
const TimeSlot = require('../../../models/portal/content/TimeSlot');
const SpecialProgram = require('../../../models/portal/content/SpecialProgram'); // Adjust path as needed
const GradeTeacherAssignment = require('../../../models/portal/content/grade_teacher_asigment'); // Adjust path as needed

// --- Existing Timetable Endpoints ---
// GET /api/timetable/teacher - Fetch timetable for the logged-in teacher across all streams
router.get('/timetable/teacher', async (req, res) => {
  try {
    const school = req.school._id;
    const current_session = req.current_session;
    const teacher = req.user.teacher; // Logged-in teacher's user ID

    // Optional dayOfWeek filter
    const filter = {
      school,
      session: current_session,
      teacher,
    };
    if (req.query.dayOfWeek) filter.dayOfWeek = req.query.dayOfWeek;

    // Fetch all time slots for the school, sorted by slotNumber or startTime
    const timeSlots = await TimeSlot.find({school}).sort({slotNumber: 1, startTime: 1});

    // Fetch timetable entries for the teacher across all streams
    const timetableEntries = await Timetable.find(filter)
      .populate('learning_area', 'name')
      .populate('timeSlot', 'startTime endTime slotNumber')
      .populate('teacher', 'firstname lastname surname')
      .populate('specialPeriod', 'name')
      .populate({
        path: 'stream',
        select: 'name grade',
        populate: {
          path: 'grade',
          select: 'name',
        },
      });

    // Define days of the week
    const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

    // Group timetable entries by stream
    const timetableByStream = {};

    for (const entry of timetableEntries) {
      const streamId = entry.stream?._id.toString() || 'no-stream'; // Handle cases with no stream
      if (!timetableByStream[streamId]) {
        timetableByStream[streamId] = {
          stream: entry.stream ? {_id: entry.stream._id, name: entry.stream.name} : null,
          timetable: daysOfWeek.reduce((acc, day) => {
            acc[day] = timeSlots.map(timeSlot => ({
              timeSlot: {
                _id: timeSlot._id,
                startTime: timeSlot.startTime,
                endTime: timeSlot.endTime,
                slotNumber: timeSlot.slotNumber,
                isFixed: timeSlot.isFixed,
                name: timeSlot.name,
              },
              period: {type: 'Free'}, // Default: Free period
            }));
            return acc;
          }, {}),
        };
      }

      // Find the time slot index
      const timeSlotIndex = timeSlots.findIndex(ts => ts._id.toString() === entry.timeSlot._id.toString());
      if (timeSlotIndex === -1) continue; // Skip if time slot not found

      // Assign the period to the correct day and time slot
      const periodData = {
        type: entry.periodType,
        _id: entry._id,
        learning_area: entry.learning_area ? {_id: entry.learning_area._id, name: entry.learning_area.name} : null,
        specialPeriod: entry.specialPeriod ? {_id: entry.specialPeriod._id, name: entry.specialPeriod.name} : null,
        stream: entry.stream ? {_id: entry.stream._id, name: entry.stream.name, grade: entry.stream.grade.name} : null,
        teacher: entry.teacher
          ? {
              _id: entry.teacher._id,
              name: `${entry.teacher.firstname} ${entry.teacher.lastname || entry.teacher.surname || ''}`.trim(),
            }
          : null,
      };

      timetableByStream[streamId].timetable[entry.dayOfWeek][timeSlotIndex].period = periodData;
    }

    // Convert timetableByStream to an array
    const result = Object.values(timetableByStream);

    // Return the timetable
    res.json({
      teacher: {
        _id: req.user._id,
        name: req.user.firstname
          ? `${req.user.firstname} ${req.user.lastname || req.user.surname || ''}`.trim()
          : req.user.username || 'Teacher',
      },
      timetables: result,
      timeSlots: timeSlots.map(ts => ({
        _id: ts._id,
        startTime: ts.startTime,
        endTime: ts.endTime,
        slotNumber: ts.slotNumber,
        isFixed: ts.isFixed,
        name: ts.name,
      })),
      days: daysOfWeek,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({message: error.message});
  }
});

// GET /api/timetable - Fetch timetables with filters (school and session from req)
router.get('/timetable', async (req, res) => {
  try {
    let current_session = req?.current_session;
    let school = req.school._id;

    const filter = {
      school: school,
      session: current_session,
    };
    if (req.query.stream) filter.stream = req.query.stream;
    if (req.query.dayOfWeek) filter.dayOfWeek = req.query.dayOfWeek;

    const timetables = await Timetable.find(filter).populate('learning_area timeSlot teacher specialPeriod');
    res.json(timetables);
  } catch (error) {
    res.status(500).json({message: error.message});
  }
});

// POST /api/timetable - Create a new timetable entry with teacher assignment
router.post('/timetable', async (req, res) => {
  try {
    let school = req.school._id;
    let current_session = req?.current_session;
    const {stream, timeSlot, dayOfWeek, learning_area, periodType, specialPeriod} = req.body;

    if (!stream || !timeSlot || !dayOfWeek || !periodType) {
      return res.status(400).json({message: 'stream, timeSlot, dayOfWeek, and periodType are required'});
    }

    if (!['learning_area', 'special'].includes(periodType)) {
      return res.status(400).json({message: 'periodType must be either learning_area or special'});
    }

    let timetableData = {
      school,
      session: current_session,
      stream,
      timeSlot,
      dayOfWeek,
      status: 0,
    };

    let existingEntry;

    if (periodType === 'learning_area') {
      if (!learning_area) {
        return res.status(400).json({message: 'learning_area is required for learning_area periodType'});
      }

      existingEntry = await Timetable.findOne({
        school,
        session: current_session,
        stream,
        timeSlot,
        dayOfWeek,
        periodType: 'learning_area',
        learning_area,
      });

      const teacherAssignment = await GradeTeacherAssignment.findOne({
        school,
        session: current_session,
        stream,
        learning_area,
      }).populate('user');

      if (!teacherAssignment && !specialPeriod) {
        return res.status(400).json({message: 'No teacher assigned to this learning area and stream'});
      }

      // Check for teacher conflict
      if (teacherAssignment && teacherAssignment.user) {
        const conflictingTimetable = await Timetable.findOne({
          school,
          teacher: teacherAssignment.user,
          dayOfWeek,
          timeSlot,
          _id: {$ne: existingEntry?._id}, // Exclude the existing entry if updating
        });
        // console.log(conflictingTimetable.stream._id., stream);
        if (conflictingTimetable?.stream?._id.toString() === stream) {
          await Timetable.deleteOne({_id: conflictingTimetable._id});
        } else if (conflictingTimetable) {
          return res.status(400).json({
            message: `Teacher is already assigned to another class at the same time slot on ${dayOfWeek}`,
          });
        }
      }

      timetableData.learning_area = learning_area;
      timetableData.teacher = teacherAssignment?.user || null;
      timetableData.periodType = 'learning_area';
    } else {
      if (!specialPeriod) {
        return res.status(400).json({message: 'specialPeriod is required for special periodType'});
      }

      const specialProgram = await SpecialProgram.findOne({
        school,
        session: current_session,
        _id: specialPeriod,
      });

      if (!specialProgram) {
        return res.status(400).json({
          message: `Invalid special period: ${specialPeriod}. Must be one of Free, Break, Lunch, PE, PPI for this school and session`,
        });
      }

      if (specialProgram.allowedDays && !specialProgram.allowedDays.includes(dayOfWeek)) {
        return res.status(400).json({message: `Day ${dayOfWeek} is not allowed for special program ${specialPeriod}`});
      }

      if (specialProgram.allowedTimeSlots && specialProgram.allowedTimeSlots.length > 0) {
        const timeSlotDoc = await TimeSlot.findById(timeSlot);
        if (!specialProgram.allowedTimeSlots.includes(timeSlotDoc._id)) {
          return res.status(400).json({message: `Time slot is not allowed for special program ${specialPeriod}`});
        }
      }

      existingEntry = await Timetable.findOne({
        school,
        session: current_session,
        stream,
        timeSlot,
        dayOfWeek,
        periodType: 'special',
        specialPeriod,
      });

      timetableData.periodType = 'special';
      timetableData.specialPeriod = specialPeriod;
      timetableData.teacher = null;
    }

    let timetable;

    if (existingEntry) {
      // Update existing entry
      timetable = await Timetable.findByIdAndUpdate(existingEntry._id, {$set: timetableData}, {new: true});
    } else {
      // Create new entry
      timetable = new Timetable(timetableData);
      await timetable.save();
    }

    await timetable.populate('learning_area timeSlot teacher');
    res.status(201).json(timetable);
  } catch (error) {
    console.error(error);
    if (error.code === 11000) {
      return res.status(400).json({message: 'Duplicate timetable entry detected'});
    }
    res.status(500).json({message: error.message});
  }
});
router.delete('/timetable/:id', async (req, res) => {
  try {
    const school = req.school._id;
    const current_session = req?.current_session;
    const timetableId = req.params.id;

    // Find the timetable entry to ensure it exists and belongs to the school/session
    const timetable = await Timetable.findOne({
      _id: timetableId,
      school,
      session: current_session,
    });

    if (!timetable) {
      return res.status(404).json({message: 'Timetable entry not found'});
    }

    // Delete the timetable entry
    await Timetable.deleteOne({_id: timetableId});

    res.status(200).json({message: 'Timetable entry deleted successfully'});
  } catch (error) {
    console.error(error);
    res.status(500).json({message: error.message});
  }
});
// PUT /api/timetable/:id - Update a specific timetable entry
router.put('/timetable/:id', async (req, res) => {
  try {
    let school = req.school._id;
    const {learning_area, periodType, specialPeriod} = req.body;

    const timetable = await Timetable.findOne({_id: req.params.id, school: school});
    if (!timetable) {
      return res.status(404).json({message: 'Timetable entry not found'});
    }

    let updateFields = {};
    if (periodType) {
      if (!['learning_area', 'special'].includes(periodType)) {
        return res.status(400).json({message: 'periodType must be either learning_area or special'});
      }
      updateFields.periodType = periodType;

      if (periodType === 'learning_area') {
        if (!learning_area) {
          return res.status(400).json({nömessage: 'learning_area is required for learning_area periodType'});
        }
        const teacherAssignment = await GradeTeacherAssignment.findOne({
          school,
          session: req?.current_session,
          stream: timetable.stream,
          learning_area,
        });
        if (!teacherAssignment && !specialPeriod) {
          return res.status(400).json({message: 'No teacher assigned to this learning area and stream'});
        }

        // Check for teacher conflict
        if (teacherAssignment && teacherAssignment.user) {
          const conflictingTimetable = await Timetable.findOne({
            school,
            teacher: teacherAssignment.user,
            dayOfWeek: timetable.dayOfWeek,
            timeSlot: timetable.timeSlot,
            _id: {$ne: timetable._id}, // Exclude the current timetable entry
          });
          console.log('conflictingTimetable', conflictingTimetable);
          if (conflictingTimetable) {
            return res.status(400).json({
              message: `Teacher is already assigned to another class at the same time slot on ${timetable.dayOfWeek}`,
            });
          }
        }

        updateFields.learning_area = learning_area;
        updateFields.teacher = teacherAssignment.user;
        updateFields.specialPeriod = undefined;
      } else {
        if (!specialPeriod) {
          return res.status(400).json({message: 'specialPeriod is required for special periodType'});
        }
        const specialProgram = await SpecialProgram.findOne({
          school,
          session: req?.current_session,
          name: specialPeriod,
        });
        if (!specialProgram) {
          return res.status(400).json({
            message: `Invalid special period: ${specialPeriod}. Must be one of Free, Break, Lunch, PE, PPI for this school and session`,
          });
        }
        if (specialProgram.allowedDays && !specialProgram.allowedDays.includes(timetable.dayOfWeek)) {
          return res
            .status(400)
            .json({message: `Day ${timetable.dayOfWeek} is not allowed for special program ${specialPeriod}`});
        }
        if (specialProgram.allowedTimeSlots && specialProgram.allowedTimeSlots.length > 0) {
          const timeSlotDoc = await TimeSlot.findById(timetable.timeSlot);
          if (!specialProgram.allowedTimeSlots.includes(timeSlotDoc._id)) {
            return res.status(400).json({message: `Time slot is not allowed for special program ${specialPeriod}`});
          }
        }
        updateFields.specialPeriod = specialPeriod;
        updateFields.learning_area = undefined;
        updateFields.teacher = null;
      }
    } else if (learning_area && timetable.periodType === 'learning_area') {
      const teacherAssignment = await GradeTeacherAssignment.findOne({
        school,
        session: req?.current_session,
        stream: timetable.stream,
        learning_area,
      });
      if (!teacherAssignment) {
        return res.status(400).json({message: 'No teacher assigned to this learning area and stream'});
      }
      console.log('conflictingTimetable', conflictingTimetable);

      // Check for teacher conflict
      const conflictingTimetable = await Timetable.findOne({
        school,
        teacher: teacherAssignment.user,
        dayOfWeek: timetable.dayOfWeek,
        timeSlot: timetable.timeSlot,
        // _id: {$ne: timetable._id}, // Exclude the current timetable entry
      });
      console.log('conflictingTimetable', conflictingTimetable);

      if (conflictingTimetable) {
        return res.status(400).json({
          message: `Teacher is already assigned to another class at the same time slot on ${timetable.dayOfWeek}`,
        });
      }

      updateFields.learning_area = learning_area;
      updateFields.teacher = teacherAssignment.user;
    }
    console.log('conflictingTimetable....');

    if (Object.keys(updateFields).length === 0) {
      return res.status(400).json({message: 'No fields to update'});
    }

    Object.assign(timetable, updateFields);
    await timetable.save();
    await timetable.populate('learning_area timeSlot teacher');
    res.json(timetable);
  } catch (error) {
    res.status(500).json({message: error.message});
  }
});

// --- Existing TimeSlot Endpoints ---

// GET /api/timeslot - Fetch time slots with filters (school from req)
router.get('/timeslot', async (req, res) => {
  try {
    let school = req.school._id;

    const filter = {school: school, level: req.query.levelId};
    console.log('filter', filter);
    if (req.query.slotNumber) filter.slotNumber = req.query.slotNumber;

    const timeSlots = await TimeSlot.find(filter);
    res.json(timeSlots);
  } catch (error) {
    res.status(500).json({message: error.message});
  }
});

// POST /api/timeslot - Create a new time slot
router.post('/timeslot', async (req, res) => {
  try {
    let school = req.school._id;
    const {startTime, endTime, slotNumber, name, isFixed, level} = req.body;

    if (!startTime || !endTime || !slotNumber) {
      return res.status(400).json({message: 'startTime, endTime, and slotNumber are required'});
    }

    const timeSlot = new TimeSlot({
      school,
      startTime,
      endTime,
      slotNumber,
      status: 0,
      name,
      isFixed,
      level,
    });

    await timeSlot.save();
    res.status(201).json(timeSlot);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({message: 'A time slot  already exists or overlaps '});
    }
    res.status(500).json({message: error.message});
  }
});

// PUT /api/timeslot/:id - Update a specific time slot
router.put('/timeslot/:id', async (req, res) => {
  try {
    let school = req.school._id;
    const timeSlot = await TimeSlot.findOne({_id: req.params.id, school: school});
    if (!timeSlot) {
      return res.status(404).json({message: 'Time slot not found'});
    }

    if (req.body.startTime) timeSlot.startTime = req.body.startTime;
    if (req.body.endTime) timeSlot.endTime = req.body.endTime;
    if (req.body.slotNumber) timeSlot.slotNumber = req.body.slotNumber;
    if (req.body.status !== undefined) timeSlot.status = req.body.status;
    if (req.body.isFixed) timeSlot.name = req.body.name;
    timeSlot.isFixed = req.body.isFixed;
    if (!timeSlot.isFixed) {
      timeSlot.name = undefined;
    }
    await timeSlot.save();
    res.json(timeSlot);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({message: 'A time slot with this slotNumber already exists for this school'});
    }
    res.status(500).json({message: error.message});
  }
});

// DELETE /api/timeslot/:id - Delete a specific time slot
router.delete('/timeslot/:id', async (req, res) => {
  try {
    let school = req.school._id;
    const timeSlot = await TimeSlot.findOne({_id: req.params.id, school: school});
    if (!timeSlot) {
      return res.status(404).json({message: 'Time slot not found'});
    }

    const timetableCount = await Timetable.countDocuments({
      school: school,
      timeSlot: req.params.id,
    });
    if (timetableCount > 0) {
      return res.status(400).json({message: 'Cannot delete time slot used in timetable entries'});
    }

    await timeSlot.deleteOne();
    res.json({message: 'Time slot deleted successfully'});
  } catch (error) {
    res.status(500).json({message: error.message});
  }
});

// --- New Special Program Endpoints ---

// GET /api/special-program - Fetch all special programs for the school and session
router.get('/special-program', async (req, res) => {
  try {
    let school = req.school._id;
    let current_session = req?.current_session;

    if (!school || !current_session) {
      return res.status(400).json({message: 'School and session are required'});
    }

    const programs = await SpecialProgram.find({school, session: current_session})
      .populate('allowedTimeSlots', 'startTime endTime')
      .populate('createdBy', 'username')
      .populate('updatedBy', 'username');
    res.json(programs);
  } catch (error) {
    res.status(500).json({message: error.message});
  }
});

// GET /api/special-program/:id - Fetch a single special program by ID
router.get('/special-program/:id', async (req, res) => {
  try {
    let school = req.school._id;
    let current_session = req?.current_session;

    if (!school || !current_session) {
      return res.status(400).json({message: 'School and session are required'});
    }

    const program = await SpecialProgram.findOne({
      _id: req.params.id,
      school,
      session: current_session,
    })
      .populate('allowedTimeSlots', 'startTime endTime')
      .populate('createdBy', 'username')
      .populate('updatedBy', 'username');

    if (!program) {
      return res.status(404).json({message: 'Special program not found'});
    }
    res.json(program);
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({message: 'Invalid special program ID'});
    }
    res.status(500).json({message: error.message});
  }
});

// POST /api/special-program - Create a new special program
router.post('/special-program', async (req, res) => {
  try {
    let school = req.school._id;
    let current_session = req?.current_session;
    const {name, description, allowedTimeSlots, allowedDays, durationMinutes, isMandatory, maxPerDay} = req.body;

    if (!school || !current_session) {
      return res.status(400).json({message: 'School and session are required'});
    }

    // Validate required fields
    if (!name || !durationMinutes) {
      return res.status(400).json({message: 'name and durationMinutes are required'});
    }

    // Validate name against enum
    // const validNames = ['Free', 'Break', 'Lunch', 'PE', 'PPI'];
    // if (!validNames.includes(name)) {
    //   return res.status(400).json({message: `Name must be one of: ${validNames.join(', ')}`});
    // }

    // Validate durationMinutes
    if (durationMinutes < 1) {
      return res.status(400).json({message: 'durationMinutes must be a positive number'});
    }

    // Validate allowedDays (if provided)
    if (allowedDays && Array.isArray(allowedDays)) {
      const validDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
      const invalidDays = allowedDays.filter(day => !validDays.includes(day));
      if (invalidDays.length > 0) {
        return res.status(400).json({message: `Allowed days must be one of: ${validDays.join(', ')}`});
      }
    }

    // Validate maxPerDay (if provided)
    if (maxPerDay !== undefined && maxPerDay < 0) {
      return res.status(400).json({message: 'maxPerDay must be non-negative'});
    }

    // Validate allowedTimeSlots (if provided)
    if (allowedTimeSlots && Array.isArray(allowedTimeSlots)) {
      const validTimeSlots = await TimeSlot.find({
        _id: {$in: allowedTimeSlots},
        school,
      });
      if (validTimeSlots.length !== allowedTimeSlots.length) {
        return res
          .status(400)
          .json({message: 'One or more allowedTimeSlots are invalid or belong to a different school'});
      }
    }

    const specialProgram = new SpecialProgram({
      name,
      description: description || '',
      allowedTimeSlots: allowedTimeSlots || [],
      allowedDays: allowedDays || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      durationMinutes,
      isMandatory: isMandatory || false,
      maxPerDay: maxPerDay !== undefined ? maxPerDay : 1,
      school,
      session: current_session,
      createdBy: req.user._id,
      updatedBy: req.user._id,
    });

    await specialProgram.save();
    await specialProgram.populate('allowedTimeSlots', 'startTime endTime');
    await specialProgram.populate('createdBy', 'username');
    await specialProgram.populate('updatedBy', 'username');
    res.status(201).json(specialProgram);
  } catch (error) {
    if (error.code === 11000) {
      return res
        .status(400)
        .json({message: 'A special program with this name already exists for this school and session'});
    }
    res.status(500).json({message: error.message});
  }
});

// PUT /api/special-program/:id - Update a specific special program
router.put('/special-program/:id', async (req, res) => {
  try {
    let school = req.school._id;
    let current_session = req?.current_session;
    const {name, description, allowedTimeSlots, allowedDays, durationMinutes, isMandatory, maxPerDay} = req.body;

    if (!school || !current_session) {
      return res.status(400).json({message: 'School and session are required'});
    }

    const program = await SpecialProgram.findOne({_id: req.params.id, school, session: current_session});
    if (!program) {
      return res.status(404).json({message: 'Special program not found'});
    }

    // Validate name (if provided)
    if (name) {
      const validNames = ['Free', 'Break', 'Lunch', 'PE', 'PPI'];
      if (!validNames.includes(name)) {
        return res.status(400).json({message: `Name must be one of: ${validNames.join(', ')}`});
      }
      program.name = name;
    }

    // Update optional fields if provided
    if (description !== undefined) program.description = description;
    if (allowedTimeSlots && Array.isArray(allowedTimeSlots)) {
      const validTimeSlots = await TimeSlot.find({
        _id: {$in: allowedTimeSlots},
        school,
      });
      if (validTimeSlots.length !== allowedTimeSlots.length) {
        return res
          .status(400)
          .json({message: 'One or more allowedTimeSlots are invalid or belong to a different school'});
      }
      program.allowedTimeSlots = allowedTimeSlots;
    }
    if (allowedDays && Array.isArray(allowedDays)) {
      const validDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
      const invalidDays = allowedDays.filter(day => !validDays.includes(day));
      if (invalidDays.length > 0) {
        return res.status(400).json({message: `Allowed days must be one of: ${validDays.join(', ')}`});
      }
      program.allowedDays = allowedDays;
    }
    if (durationMinutes !== undefined) {
      if (durationMinutes < 1) {
        return res.status(400).json({message: 'durationMinutes must be a positive number'});
      }
      program.durationMinutes = durationMinutes;
    }
    if (isMandatory !== undefined) program.isMandatory = isMandatory;
    if (maxPerDay !== undefined) {
      if (maxPerDay < 0) {
        return res.status(400).json({message: 'maxPerDay must be non-negative'});
      }
      program.maxPerDay = maxPerDay;
    }

    program.updatedBy = req.user._id;
    await program.save();
    await program.populate('allowedTimeSlots', 'startTime endTime');
    await program.populate('createdBy', 'username');
    await program.populate('updatedBy', 'username');
    res.json(program);
  } catch (error) {
    if (error.code === 11000) {
      return res
        .status(400)
        .json({message: 'A special program with this name already exists for this school and session'});
    }
    if (error.name === 'CastError') {
      return res.status(400).json({message: 'Invalid special program ID'});
    }
    res.status(500).json({message: error.message});
  }
});

// DELETE /api/special-program/:id - Delete a specific special program
router.delete('/special-program/:id', async (req, res) => {
  try {
    let school = req.school._id;
    let current_session = req?.current_session;

    if (!school || !current_session) {
      return res.status(400).json({message: 'School and session are required'});
    }

    const program = await SpecialProgram.findOne({_id: req.params.id, school, session: current_session});
    if (!program) {
      return res.status(404).json({message: 'Special program not found'});
    }

    // Check if the special program is used in any timetable entries
    const timetableCount = await Timetable.countDocuments({
      school,
      session: current_session,
      specialProgram: req.params.id,
    });
    if (timetableCount > 0) {
      return res.status(400).json({message: 'Cannot delete special program used in timetable entries'});
    }

    await program.deleteOne();
    res.json({message: 'Special program deleted successfully'});
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({message: 'Invalid special program ID'});
    }
    res.status(500).json({message: error.message});
  }
});

module.exports = router;
