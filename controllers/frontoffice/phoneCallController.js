// controllers/phoneCallController.js
const PhoneCall = require("../../models/frontoffice/PhoneCall");

/**
 * @desc Create a new phone call record
 * @route POST /api/phone-calls
 * @access Authenticated
 */
const createPhoneCall = async (req, res) => {
  try {
    const {
      callerName,
      callerPhone,
      callerEmail,
      callType,
      callTime,
      duration,
      purpose,
      notes,
      followUpRequired,
      followUpDate,
      followUpNotes,
      relatedTo,
      handledBy,
      priority,
      tags
    } = req.body;

    // Validate required fields
    if (!callerName || !callerPhone || !callType || !purpose || !handledBy) {
      return res.status(400).json({ 
        message: 'Missing required fields: callerName, callerPhone, callType, purpose, and handledBy are required' 
      });
    }

    // Create new phone call record
    const newPhoneCall = await PhoneCall.create({
      callerName,
      callerPhone,
      callerEmail,
      callType,
      callTime,
      duration,
      purpose,
      notes,
      followUpRequired: followUpRequired || false,
      followUpDate,
      followUpNotes,
      relatedTo,
      handledBy,
      priority: priority || 'Medium',
      tags: tags || []
    });

    res.status(201).json({
      message: 'Phone call recorded successfully',
      phoneCall: newPhoneCall
    });
  } catch (error) {
    console.error('Error creating phone call:', error);
    res.status(500).json({ 
      message: 'Error creating phone call', 
      error: error.message 
    });
  }
};

/**
 * @desc Get all phone calls with filtering and pagination
 * @route GET /api/phone-calls
 * @access Authenticated
 */
const getPhoneCalls = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      search = "", 
      callType = "", 
      status = "",
      priority = "",
      followUpRequired = "",
      handledBy = "",
      sortField = "callDate", 
      sortOrder = "desc",
      startDate = "",
      endDate = ""
    } = req.query;

    // Build query object
    let query = {};

    // Add search functionality
    if (search) {
      query.$or = [
        { callerName: { $regex: search, $options: "i" } },
        { callerPhone: { $regex: search, $options: "i" } },
        { callerEmail: { $regex: search, $options: "i" } },
        { purpose: { $regex: search, $options: "i" } },
        { notes: { $regex: search, $options: "i" } },
        { handledBy: { $regex: search, $options: "i" } }
      ];
    }

    // Add filters
    if (callType) {
      query.callType = callType;
    }

    if (status) {
      query.status = status;
    }

    if (priority) {
      query.priority = priority;
    }

    if (followUpRequired !== "") {
      query.followUpRequired = followUpRequired === "true";
    }

    if (handledBy) {
      query.handledBy = { $regex: handledBy, $options: "i" };
    }

    // Add date range filter
    if (startDate && endDate) {
      query.callDate = {
        $gte: new Date(startDate),
        $lte: new Date(endDate + 'T23:59:59.999Z')
      };
    }

    // Build sort object
    const sortObj = {};
    sortObj[sortField] = sortOrder === "asc" ? 1 : -1;

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Execute query with pagination
    const phoneCalls = await PhoneCall.find(query)
      .sort(sortObj)
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count for pagination
    const total = await PhoneCall.countDocuments(query);

    // Calculate pagination info
    const totalPages = Math.ceil(total / parseInt(limit));

    res.json({
      data: phoneCalls,
      pagination: {
        current_page: parseInt(page),
        total: total,
        total_pages: totalPages,
        per_page: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error fetching phone calls:', error);
    res.status(500).json({ 
      message: 'Error fetching phone calls', 
      error: error.message 
    });
  }
};

/**
 * @desc Get a single phone call by ID
 * @route GET /api/phone-calls/:id
 * @access Authenticated
 */
const getPhoneCallById = async (req, res) => {
  try {
    const phoneCall = await PhoneCall.findById(req.params.id);

    if (!phoneCall) {
      return res.status(404).json({ message: 'Phone call not found' });
    }

    res.json(phoneCall);
  } catch (error) {
    console.error('Error fetching phone call:', error);
    res.status(500).json({ 
      message: 'Error fetching phone call', 
      error: error.message 
    });
  }
};

/**
 * @desc Update a phone call record
 * @route PUT /api/phone-calls/:id
 * @access Authenticated
 */
const updatePhoneCall = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const phoneCall = await PhoneCall.findByIdAndUpdate(
      id, 
      updateData, 
      { new: true, runValidators: true }
    );

    if (!phoneCall) {
      return res.status(404).json({ message: 'Phone call not found' });
    }

    res.json({
      message: 'Phone call updated successfully',
      phoneCall
    });
  } catch (error) {
    console.error('Error updating phone call:', error);
    res.status(500).json({ 
      message: 'Error updating phone call', 
      error: error.message 
    });
  }
};

/**
 * @desc Delete a phone call record
 * @route DELETE /api/phone-calls/:id
 * @access Authenticated
 */
const deletePhoneCall = async (req, res) => {
  try {
    const { id } = req.params;

    const phoneCall = await PhoneCall.findByIdAndDelete(id);

    if (!phoneCall) {
      return res.status(404).json({ message: 'Phone call not found' });
    }

    res.json({ message: 'Phone call deleted successfully' });
  } catch (error) {
    console.error('Error deleting phone call:', error);
    res.status(500).json({ 
      message: 'Error deleting phone call', 
      error: error.message 
    });
  }
};

/**
 * @desc Mark follow-up as completed
 * @route PATCH /api/phone-calls/:id/follow-up
 * @access Authenticated
 */
const completeFollowUp = async (req, res) => {
  try {
    const { id } = req.params;
    const { followUpNotes } = req.body;

    const phoneCall = await PhoneCall.findById(id);

    if (!phoneCall) {
      return res.status(404).json({ message: 'Phone call not found' });
    }

    phoneCall.followUpCompleted = true;
    phoneCall.status = 'Resolved';
    if (followUpNotes) {
      phoneCall.followUpNotes = followUpNotes;
    }

    await phoneCall.save();

    res.json({
      message: 'Follow-up marked as completed',
      phoneCall
    });
  } catch (error) {
    console.error('Error completing follow-up:', error);
    res.status(500).json({ 
      message: 'Error completing follow-up', 
      error: error.message 
    });
  }
};

/**
 * @desc Get phone call statistics
 * @route GET /api/phone-calls/stats/overview
 * @access Authenticated
 */
const getPhoneCallStats = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const dateFilter = {};
    if (startDate && endDate) {
      dateFilter.callDate = {
        $gte: new Date(startDate),
        $lte: new Date(endDate + 'T23:59:59.999Z')
      };
    }

    // Get basic statistics
    const stats = await PhoneCall.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: null,
          totalCalls: { $sum: 1 },
          incomingCalls: { $sum: { $cond: [{ $eq: ['$callType', 'Incoming'] }, 1, 0] } },
          outgoingCalls: { $sum: { $cond: [{ $eq: ['$callType', 'Outgoing'] }, 1, 0] } },
          missedCalls: { $sum: { $cond: [{ $eq: ['$callType', 'Missed'] }, 1, 0] } },
          followUpRequired: { $sum: { $cond: ['$followUpRequired', 1, 0] } },
          followUpCompleted: { $sum: { $cond: ['$followUpCompleted', 1, 0] } },
          avgDuration: { $avg: '$duration' }
        }
      }
    ]);

    // Get calls by priority
    const priorityStats = await PhoneCall.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: '$priority',
          count: { $sum: 1 }
        }
      }
    ]);

    // Get calls by status
    const statusStats = await PhoneCall.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    // Get calls by day of week
    const dailyStats = await PhoneCall.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: { $dayOfWeek: '$callDate' },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json({
      overview: stats[0] || {
        totalCalls: 0,
        incomingCalls: 0,
        outgoingCalls: 0,
        missedCalls: 0,
        followUpRequired: 0,
        followUpCompleted: 0,
        avgDuration: 0
      },
      priorityStats,
      statusStats,
      dailyStats
    });
  } catch (error) {
    console.error('Error fetching phone call stats:', error);
    res.status(500).json({ 
      message: 'Error fetching phone call stats', 
      error: error.message 
    });
  }
};

/**
 * @desc Get pending follow-ups
 * @route GET /api/phone-calls/follow-ups/pending
 * @access Authenticated
 */
const getPendingFollowUps = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const pendingFollowUps = await PhoneCall.find({
      followUpRequired: true,
      followUpCompleted: false
    })
      .sort({ followUpDate: 1, callDate: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await PhoneCall.countDocuments({
      followUpRequired: true,
      followUpCompleted: false
    });

    const totalPages = Math.ceil(total / parseInt(limit));

    res.json({
      data: pendingFollowUps,
      pagination: {
        current_page: parseInt(page),
        total: total,
        total_pages: totalPages,
        per_page: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error fetching pending follow-ups:', error);
    res.status(500).json({ 
      message: 'Error fetching pending follow-ups', 
      error: error.message 
    });
  }
};

/**
 * @desc Generate phone call report
 * @route GET /api/phone-calls/reports
 * @access Authenticated
 */
const getPhoneCallReport = async (req, res) => {
  try {
    const { startDate, endDate, callType, status } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ message: 'Please provide startDate and endDate' });
    }

    let query = {
      callDate: {
        $gte: new Date(startDate),
        $lte: new Date(endDate + 'T23:59:59.999Z')
      }
    };

    if (callType) {
      query.callType = callType;
    }

    if (status) {
      query.status = status;
    }

    const report = await PhoneCall.find(query).sort({ callDate: -1 });

    res.json({
      count: report.length,
      data: report,
      period: { startDate, endDate }
    });
  } catch (error) {
    console.error('Error generating phone call report:', error);
    res.status(500).json({ 
      message: 'Error generating phone call report', 
      error: error.message 
    });
  }
};

module.exports = {
  createPhoneCall,
  getPhoneCalls,
  getPhoneCallById,
  updatePhoneCall,
  deletePhoneCall,
  completeFollowUp,
  getPhoneCallStats,
  getPendingFollowUps,
  getPhoneCallReport
};
