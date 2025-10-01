const Learner = require('../../models/portal/content/Learner');
const Enrollment = require('../../models/portal/content/Enrollment');
const Attendance = require('../../models/portal/content/Attendance');
// this.Learner = require('../../models/portal/content/Learner');
// this.Enrollment = require('../../models/portal/content/Enrollment');
// this.Attendance = require('../../models/portal/content/Attendance');

class AttendanceService {
  constructor() {}

  async getLearnersWithAttendanceStatus(school, stream, session, date, adm_no) {
    try {
      const enrollment = await Enrollment.find({
        school,
        to_stream: stream,
        to_session: session,
        grad: 0,
      });
      const learnerIds = enrollment.map(learner => learner.learner);

      let learnerQuery = {school, _id: {$in: learnerIds}};
      if (adm_no) {
        const regex = new RegExp(adm_no.trim(), 'i');
        learnerQuery.adm_no = regex;
      }

      const learners = await Learner.find(learnerQuery).sort({first_name: 1});

      const attendanceRecords = await Attendance.find({
        school,
        stream,
        date: date,
      });
      // .populate('learner')
      // .populate('stream')
      // .populate('grade');

      const attendanceMap = {};
      attendanceRecords.forEach(attendance => {
        const learnerId = attendance.learner._id.toString();
        if (learnerId) {
          attendanceMap[learnerId] = attendance;
        }
      });

      const result = learners.map(learner => {
        const learnerId = learner._id.toString();
        const attendance = attendanceMap[learnerId];

        return {
          learner,
          date,
          stream,
          attended: !!attendance,
          attendanceDetails: attendance || null,
        };
      });

      return result;
    } catch (error) {
      console.error(`Error retrieving learners with attendance status: ${error.message}`);
      throw new Error(`Failed to retrieve learners with attendance status: ${error.message}`);
    }
  }
  async getMonthlyAttendanceAnalysis(school, stream, month, year) {
    try {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);

      const attendanceRecords = await Attendance.find({
        school,
        stream,
        date: {$gte: startDate, $lte: endDate},
      });

      const analysis = {};

      attendanceRecords.forEach(record => {
        const date = record.date.toISOString().split('T')[0];
        if (!analysis[date]) {
          analysis[date] = {
            presentMorning: 0,
            presentAfternoon: 0,
            absentMorning: 0,
            absentAfternoon: 0,
          };
        }

        if (record.morning) {
          analysis[date].presentMorning++;
        } else {
          analysis[date].absentMorning++;
        }

        if (record.afternoon) {
          analysis[date].presentAfternoon++;
        } else {
          analysis[date].absentAfternoon++;
        }
      });

      return analysis;
    } catch (error) {
      console.error(`Error performing monthly attendance analysis: ${error.message}`);
      throw new Error(`Failed to perform monthly attendance analysis: ${error.message}`);
    }
  }

  /**
   * Get attendance summary for the given school and month.
   * @param {mongoose.Types.ObjectId} schoolId - The school ID.
   * @param {number} year - The year of the report.
   * @param {number} month - The month for the report (1-12).
   * @returns {Promise<Object[]>} - A summary of attendance for each learner for the month.
   */
  async getMonthlyAttendanceSummary(schoolId, year, month, stream) {
    // Calculate the first and last day of the selected month
    const startOfMonth = new Date(year, month - 1, 1); // Month is 0-indexed
    const endOfMonth = new Date(year, month, 0); // Last day of the month

    // Fetch attendance records for the specified school, month, and year
    const attendanceRecords = await Attendance.find({
      school: schoolId,
      stream,
      date: {
        $gte: startOfMonth,
        $lte: endOfMonth,
      },
    })
      .populate('learner') // Assuming learner field is populated
      .sort('date');

    // Process attendance records to generate the summary
    const attendanceSummary = [];
    const dailyAttendance = {};

    // Loop through each attendance record and aggregate data
    attendanceRecords.forEach(record => {
      const learnerId = record.learner._id;
      const dateString = new Date(record.date).getDate().toString();
      const options = {weekday: 'short'}; // 'short' will give you the abbreviated day name (Mon, Tue, etc.)
      const dayOfWeek = new Date(record.date).toLocaleDateString('en-US', options).charAt(0); // Extract the first letter

      // Find or create entry for this learner
      let learnerSummary = attendanceSummary.find(entry => entry.learner._id.toString() === learnerId.toString());
      if (!learnerSummary) {
        learnerSummary = {
          learner: record.learner,
          attendance: {},
        };
        attendanceSummary.push(learnerSummary);
      }

      // Add attendance for the specific day
      learnerSummary.attendance[dateString] = {
        dayOfWeek,
        morning: record.morning,
        afternoon: record.afternoon,
        morning_reason: record.morning_reason,
        afternoon_reason: record.afternoon_reason,
      };

      // Aggregate daily attendance
      if (!dailyAttendance[dateString]) {
        dailyAttendance[dateString] = {
          presentMorning: 0,
          presentAfternoon: 0,
          absentMorning: 0,
          absentAfternoon: 0,
        };
      }

      if (record.morning) {
        dailyAttendance[dateString].presentMorning++;
      } else {
        dailyAttendance[dateString].absentMorning++;
      }

      if (record.afternoon) {
        dailyAttendance[dateString].presentAfternoon++;
      } else {
        dailyAttendance[dateString].absentAfternoon++;
      }
    });

    return {attendanceSummary, dailyAttendance};
  }

  async getMonthlyAttendanceSummaryTermly(schoolId, year, month, stream, daysOpen) {
    const startOfMonth = new Date(year, month - 1, 1); // Month is 0-indexed
    const endOfMonth = new Date(year, month, 0); // Last day of the month

    // Calculate the total number of days in the month
    const totalDaysInMonth = endOfMonth.getDate();

    // Fetch attendance records for the specified school, month, and year
    const attendanceRecords = await Attendance.find({
      school: schoolId,
      stream,
      date: {
        $gte: startOfMonth,
        $lte: endOfMonth,
      },
    })
      .populate('learner') // Assuming learner field is populated
      .sort('date');

    // Aggregate data for boys and girls attendance calculation
    const attendanceSummary = {
      boys: {
        cumulativeMorning: 0,
        cumulativeAfternoon: 0,
        totalStudents: 0,
      },
      girls: {
        cumulativeMorning: 0,
        cumulativeAfternoon: 0,
        totalStudents: 0,
      },
    };

    // Loop through each attendance record to process
    attendanceRecords.forEach(record => {
      const learner = record.learner;
      const gender = learner.gender; // Assuming gender field exists (male, female, etc.)

      // Initialize attendance record for boys or girls
      if (gender === 'Male') {
        // Only count unique students
        if (!attendanceSummary.boys[learner._id]) {
          attendanceSummary.boys[learner._id] = true; // Mark as counted
          attendanceSummary.boys.totalStudents++;
        }
        // Count morning and afternoon sessions
        if (record.morning) attendanceSummary.boys.cumulativeMorning++;
        if (record.afternoon) attendanceSummary.boys.cumulativeAfternoon++;
      } else if (gender === 'Female') {
        // Only count unique students
        if (!attendanceSummary.girls[learner._id]) {
          attendanceSummary.girls[learner._id] = true; // Mark as counted
          attendanceSummary.girls.totalStudents++;
        }
        // Count morning and afternoon sessions
        if (record.morning) attendanceSummary.girls.cumulativeMorning++;
        if (record.afternoon) attendanceSummary.girls.cumulativeAfternoon++;
      }
    });

    // Calculate total sessions for boys and girls
    const totalBoysSessions = attendanceSummary.boys.cumulativeMorning + attendanceSummary.boys.cumulativeAfternoon;
    const totalGirlsSessions = attendanceSummary.girls.cumulativeMorning + attendanceSummary.girls.cumulativeAfternoon;

    // Calculate the total possible sessions for boys and girls (2 sessions per day for each student)
    const totalSessionsBoys = attendanceSummary.boys.totalStudents * 2 * totalDaysInMonth; // 2 sessions per day (morning + afternoon)
    const totalSessionsGirls = attendanceSummary.girls.totalStudents * 2 * totalDaysInMonth;

    // Calculate the total attendance percentage for boys and girls
    const totalAttendedSessions = totalBoysSessions + totalGirlsSessions;
    const totalPossibleSessions = totalSessionsBoys + totalSessionsGirls;

    const classAttendancePercentage =
      totalPossibleSessions === 0 ? 0 : ((totalAttendedSessions / totalPossibleSessions) * 100).toFixed(2);

    // Return the total attendance for boys and girls, along with their average attendance percentages
    return {
      totalBoys: attendanceSummary.boys.totalStudents,
      totalGirls: attendanceSummary.girls.totalStudents,
      totalSessions: totalSessionsBoys + totalSessionsGirls,
      totalCumulativeBoys: totalBoysSessions,
      totalCumulativeGirls: totalGirlsSessions,
      classAttendancePercentage,
    };
  }
  async getLearnerAttendanceById(schoolId, learnerId) {
    try {
      const attendanceRecords = await Attendance.find({
        school: schoolId,
        learner: learnerId,
      }).sort('date');

      const attendanceSummary = attendanceRecords.map(record => ({
        date: record.date,
        morning: record.morning,
        morning_reason: record.morning_reason,
        afternoon_reason: afternoon_reason,
        afternoon: record.afternoon,
      }));

      return attendanceSummary;
    } catch (error) {
      console.error(`Error retrieving attendance for learner ${learnerId}: ${error.message}`);
      throw new Error(`Failed to retrieve attendance for learner ${learnerId}: ${error.message}`);
    }
  }
}
module.exports = new AttendanceService();
