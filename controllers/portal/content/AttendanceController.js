const express = require('express');
const router = express.Router();
const AttendanceService = require('../../../services/portal/AttendanceService');
const Attendance = require('../../../models/portal/content/Attendance');
const mongoose = require('mongoose');
const AccessLog = require('../../../models/portal/content/AccessLog'); // Our log keeper
const Role = require('../../../models/portal/auth/roles'); // To get role names
const logger = require('../../../utils/logger'); // Simple message writer

// Get attendance status for learners (who was present or absent on a specific day)
router.get('/', async (req, res) => {
  const {stream, adm_no, date} = req.query; // Class, student ID, and date
  const school = req?.user?.school; // The school they’re from
  const session = req?.current_session; // Current school term
  const ipAddress = req.ip || req.connection.remoteAddress; // Where they’re connecting from
  const method = req.method; // What they’re doing (GET)
  const endpoint = `${req.baseUrl}${req.path}`; // Which page ("/")

  try {
    // Fetch the role name (e.g., "Teacher" or "Admin")
    const userRole = await Role.findById(req.user.role?._id).select('name').lean();
    const roleName = userRole ? userRole.name : 'Unknown Role';

    const learnersWithAttendance = await AttendanceService.getLearnersWithAttendanceStatus(
      school,
      stream,
      session,
      date,
      adm_no,
    );

    // Log that it worked
    await AccessLog.create({
      userId: req.user._id, // Who’s checking
      email: req.user.email, // Their email
      schoolId: req.user.school?._id, // Their school
      roleId: req.user.role?._id, // Their role ID
      ipAddress, // Where they are
      method, // What they did (GET)
      endpoint, // Which page
      status: 'success', // It worked!
      description: `${roleName} checked attendance for ${stream || 'all'} on ${date || 'today'}`, // What they saw
    });
    logger.info(`Attendance status sent to ${req.user.email} (${roleName})`);

    res.status(200).json({data: learnersWithAttendance, success: true});
  } catch (error) {
    // Fetch role name even if it fails
    const userRole = await Role.findById(req.user.role?._id).select('name').lean();
    const roleName = userRole ? userRole.name : 'Unknown Role';

    // Log that it failed
    await AccessLog.create({
      userId: req.user?._id,
      email: req.user?.email || 'unknown',
      schoolId: req.user?.school?._id,
      roleId: req.user?.role?._id,
      ipAddress,
      method,
      endpoint,
      status: 'failed',
      description: `${roleName} couldn’t check attendance: ${error.message}`,
    });
    logger.error(`Error fetching attendance for ${req.user?.email || 'unknown'} (${roleName}): ${error.message}`);

    res.status(500).json({error: 'Internal Server Error'});
  }
});

// Get monthly attendance analysis (how attendance looked over a month)
router.get('/monthly-analysis', async (req, res) => {
  const {stream, month, year} = req.query; // Class, month, and year
  const school = req?.user?.school;
  const ipAddress = req.ip || req.connection.remoteAddress;
  const method = req.method;
  const endpoint = `${req.baseUrl}${req.path}`;

  try {
    const userRole = await Role.findById(req.user.role?._id).select('name').lean();
    const roleName = userRole ? userRole.name : 'Unknown Role';

    const analysis = await AttendanceService.getMonthlyAttendanceAnalysis(school, stream, month, year);

    await AccessLog.create({
      userId: req.user._id,
      email: req.user.email,
      schoolId: req.user.school?._id,
      roleId: req.user.role?._id,
      ipAddress,
      method,
      endpoint,
      status: 'success',
      description: `${roleName} viewed attendance analysis for ${stream || 'all'} in ${month}/${year}`,
    });
    logger.info(`Monthly analysis sent to ${req.user.email} (${roleName})`);

    res.status(200).json({data: analysis, success: true});
  } catch (error) {
    const userRole = await Role.findById(req.user.role?._id).select('name').lean();
    const roleName = userRole ? userRole.name : 'Unknown Role';

    await AccessLog.create({
      userId: req.user?._id,
      email: req.user?.email || 'unknown',
      schoolId: req.user?.school?._id,
      roleId: req.user?.role?._id,
      ipAddress,
      method,
      endpoint,
      status: 'failed',
      description: `${roleName} couldn’t get monthly analysis: ${error.message}`,
    });
    logger.error(`Error fetching monthly analysis for ${req.user?.email || 'unknown'} (${roleName}): ${error.message}`);

    res.status(500).json({error: 'Internal Server Error'});
  }
});

// Add or update attendance records (mark who was present or absent)
router.post('/', async (req, res) => {
  const session = await mongoose.startSession(); // Start a safe way to save changes
  const ipAddress = req.ip || req.connection.remoteAddress;
  const method = req.method;
  const endpoint = `${req.baseUrl}${req.path}`;

  try {
    const userRole = await Role.findById(req.user.role?._id).select('name').lean();
    const roleName = userRole ? userRole.name : 'Unknown Role';

    await session.withTransaction(async () => {
      const school = req?.user?.school;
      const attendanceData = req.body; // List of attendance details

      // Update all attendance records at once
      const attendancePromises = attendanceData.map(async learnerAttendance => {
        const {learner, date, attendanceDetails} = learnerAttendance;
        const {morning, afternoon, morning_reason, afternoon_reason, stream} = attendanceDetails;

        const attendance = await Attendance.findOneAndUpdate(
          {school, learner, date, stream: learner.stream}, // Find the record
          {$set: {morning, afternoon, morning_reason, afternoon_reason}}, // Update it
          {new: true, upsert: true, session, setDefaultsOnInsert: true}, // Create if it doesn’t exist
        );

        return attendance;
      });

      const updatedAttendances = await Promise.all(attendancePromises);

      // Log that it worked
      await AccessLog.create({
        userId: req.user._id,
        email: req.user.email,
        schoolId: req.user.school?._id,
        roleId: req.user.role?._id,
        ipAddress,
        method,
        endpoint,
        status: 'success',
        description: `${roleName} updated attendance for ${updatedAttendances.length} students`,
      });
      logger.info(`Attendance updated by ${req.user.email} (${roleName})`);

      return res.status(200).json({
        message: 'Attendance records created/updated successfully',
        attendances: updatedAttendances,
      });
    });
  } catch (error) {
    const userRole = await Role.findById(req.user.role?._id).select('name').lean();
    const roleName = userRole ? userRole.name : 'Unknown Role';

    await AccessLog.create({
      userId: req.user?._id,
      email: req.user?.email || 'unknown',
      schoolId: req.user?.school?._id,
      roleId: req.user?.role?._id,
      ipAddress,
      method,
      endpoint,
      status: 'failed',
      description: `${roleName} couldn’t update attendance: ${error.message}`,
    });
    logger.error(`Error updating attendance for ${req.user?.email || 'unknown'} (${roleName}): ${error.message}`);

    return res.status(400).json({error: error.message});
  } finally {
    session.endSession(); // Clean up the session
  }
});

// Get a summary of attendance for a month
router.get('/monthly-summary', async (req, res) => {
  const {year, month, stream} = req.query;
  const school = req?.user?.school;
  const ipAddress = req.ip || req.connection.remoteAddress;
  const method = req.method;
  const endpoint = `${req.baseUrl}${req.path}`;

  try {
    const userRole = await Role.findById(req.user.role?._id).select('name').lean();
    const roleName = userRole ? userRole.name : 'Unknown Role';

    const summary = await AttendanceService.getMonthlyAttendanceSummary(school, year, month, stream);

    await AccessLog.create({
      userId: req.user._id,
      email: req.user.email,
      schoolId: req.user.school?._id,
      roleId: req.user.role?._id,
      ipAddress,
      method,
      endpoint,
      status: 'success',
      description: `${roleName} viewed monthly attendance summary for ${stream || 'all'} in ${month}/${year}`,
    });
    logger.info(`Monthly summary sent to ${req.user.email} (${roleName})`);

    res.status(200).json({data: summary, success: true});
  } catch (error) {
    const userRole = await Role.findById(req.user.role?._id).select('name').lean();
    const roleName = userRole ? userRole.name : 'Unknown Role';

    await AccessLog.create({
      userId: req.user?._id,
      email: req.user?.email || 'unknown',
      schoolId: req.user?.school?._id,
      roleId: req.user?.role?._id,
      ipAddress,
      method,
      endpoint,
      status: 'failed',
      description: `${roleName} couldn’t get monthly summary: ${error.message}`,
    });
    logger.error(`Error fetching monthly summary for ${req.user?.email || 'unknown'} (${roleName}): ${error.message}`);

    res.status(500).json({error: 'Internal Server Error'});
  }
});

// Get a termly monthly attendance summary (with days open)
router.get('/getMonthlyAttendanceSummary', async (req, res) => {
  const {year, month, stream, daysOpen} = req.query;
  const schoolId = req?.user?.school;
  const ipAddress = req.ip || req.connection.remoteAddress;
  const method = req.method;
  const endpoint = `${req.baseUrl}${req.path}`;

  try {
    const userRole = await Role.findById(req.user.role?._id).select('name').lean();
    const roleName = userRole ? userRole.name : 'Unknown Role';

    const summary = await AttendanceService.getMonthlyAttendanceSummaryTermly(schoolId, year, month, stream, daysOpen);

    await AccessLog.create({
      userId: req.user._id,
      email: req.user.email,
      schoolId: req.user.school?._id,
      roleId: req.user.role?._id,
      ipAddress,
      method,
      endpoint,
      status: 'success',
      description: `${roleName} viewed termly attendance summary for ${stream || 'all'} in ${month}/${year}`,
    });
    logger.info(`Termly summary sent to ${req.user.email} (${roleName})`);

    res.status(200).json({success: true, summary});
  } catch (error) {
    const userRole = await Role.findById(req.user.role?._id).select('name').lean();
    const roleName = userRole ? userRole.name : 'Unknown Role';

    await AccessLog.create({
      userId: req.user?._id,
      email: req.user?.email || 'unknown',
      schoolId: req.user?.school?._id,
      roleId: req.user?.role?._id,
      ipAddress,
      method,
      endpoint,
      status: 'failed',
      description: `${roleName} couldn’t get termly summary: ${error.message}`,
    });
    logger.error(`Error fetching termly summary for ${req.user?.email || 'unknown'} (${roleName}): ${error.message}`);

    res.status(500).json({success: false, message: error.message});
  }
});

module.exports = router;
