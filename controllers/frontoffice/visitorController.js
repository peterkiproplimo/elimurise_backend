const express = require('express');
const router = express.Router();
const Visitor = require('../../models/frontoffice/Visitor');
const { v4: uuidv4 } = require('uuid');
const QRCode = require('qrcode');

// POST / - Register a new visitor
router.post('/', async (req, res) => {
  try {
    const {
      fullName,
      idNumber,
      phoneNumber,
      email,
      company,
      purpose,
      hostName,
      expectedDuration = 60, // Default 60 minutes
      notes
    } = req.body;

    // Validate required fields
    if (!fullName || !idNumber || !phoneNumber || !purpose || !hostName) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Generate unique pass ID
    const passId = uuidv4();

    // Generate QR code for visitor pass
    const qrCodeData = await QRCode.toDataURL(passId);

    // Create new visitor record
    const newVisitor = await Visitor.create({
      fullName,
      idNumber,
      phoneNumber,
      email,
      company,
      purpose,
      hostName,
      passId,
      status: "Checked In", // ✅ Default status
      qrCode: qrCodeData,   // optionally store QR code too
      expectedDuration: parseInt(expectedDuration),
      checkInTime: new Date(),
      lastActivityTime: new Date(),
      notes
    });

    res.status(201).json({
      message: 'Visitor registered successfully',
      visitor: {
        ...newVisitor._doc,
        qrCode: qrCodeData
      }
    });
  } catch (error) {
    console.error('Error registering visitor:', error);
    res.status(500).json({ message: 'Error registering visitor', error: error.message });
  }
});

// PATCH /:id/checkin - Check-in visitor
router.patch('/:id/checkin', async (req, res) => {
  try {
    const visitorId = req.params.id;

    const visitor = await Visitor.findById(visitorId);

    if (!visitor) {
      return res.status(404).json({ message: 'Visitor not found' });
    }

    if (visitor.status === 'Checked In') {
      return res.status(400).json({ message: 'Visitor already checked in' });
    }

    visitor.checkInTime = new Date();
    visitor.status = 'Checked In';
    await visitor.save();

    res.json({ message: 'Visitor checked in successfully', visitor });
  } catch (error) {
    console.error('Error checking in visitor:', error);
    res.status(500).json({ message: 'Error checking in visitor', error: error.message });
  }
});

// PUT /:id/checkout - Check-out visitor
router.put('/:id/checkout', async (req, res) => {
  try {
    const visitorId = req.params.id;

    const visitor = await Visitor.findById(visitorId);

    if (!visitor) {
      return res.status(404).json({ message: 'Visitor not found' });
    }

    if (visitor.status !== 'Checked In') {
      return res.status(400).json({ message: 'Visitor is not currently checked in' });
    }

    const checkOutTime = new Date();
    visitor.checkOutTime = checkOutTime;
    visitor.status = 'Checked Out';
    
    // Calculate actual duration
    if (visitor.checkInTime) {
      const durationMs = checkOutTime - visitor.checkInTime;
      visitor.actualDuration = Math.round(durationMs / (1000 * 60)); // Convert to minutes
      
      // Check if visitor overstayed
      if (visitor.actualDuration > visitor.expectedDuration) {
        visitor.isOverstayed = true;
        visitor.overstayMinutes = visitor.actualDuration - visitor.expectedDuration;
      }
    }
    
    await visitor.save();

    res.json({ 
      message: 'Visitor checked out successfully', 
      visitor,
      duration: visitor.actualDuration,
      overstayed: visitor.isOverstayed,
      overstayMinutes: visitor.overstayMinutes
    });
  } catch (error) {
    console.error('Error checking out visitor:', error);
    res.status(500).json({ message: 'Error checking out visitor', error: error.message });
  }
});

// GET / - Get all visitors (with optional filters)
router.get('/', async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      search = "", 
      grade = "", 
      stream = "", 
      sortField = "createdAt", 
      sortOrder = "desc",
      status = [],
      company = "",
      purpose = ""
    } = req.query;

    // Build query object
    let query = {};

    // Add search functionality
    if (search) {
      console.log("Search term:", search);
      query.$or = [
        { fullName: { $regex: search, $options: "i" } },
        { idNumber: { $regex: search, $options: "i" } },
        { phoneNumber: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { company: { $regex: search, $options: "i" } },
        { purpose: { $regex: search, $options: "i" } },
        { hostName: { $regex: search, $options: "i" } }
      ];
      console.log("Search query:", query);
    }

    // Add status filter
    if (status && status.length > 0) {
      query.status = { $in: status };
    }

    // Add company filter
    if (company) {
      query.company = company;
    }

    // Add purpose filter
    if (purpose) {
      query.purpose = purpose;
    }

    // Build sort object
    const sortObj = {};
    sortObj[sortField] = sortOrder === "asc" ? 1 : -1;

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Execute query with pagination
    const visitors = await Visitor.find(query)
      .sort(sortObj)
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count for pagination
    const total = await Visitor.countDocuments(query);

    // Calculate pagination info
    const totalPages = Math.ceil(total / parseInt(limit));

    res.json({
      data: visitors,
      pagination: {
        current_page: parseInt(page),
        total: total,
        total_pages: totalPages,
        per_page: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error fetching visitors:', error);
    res.status(500).json({ message: 'Error fetching visitors', error: error.message });
  }
});

// GET /alerts/overstayed - Check for overstayed visitors and trigger alerts
router.get('/alerts/overstayed', async (req, res) => {
  try {
    const currentTime = new Date();
    
    // Find all checked-in visitors
    const activeVisitors = await Visitor.find({ 
      status: 'Checked In',
      checkInTime: { $exists: true }
    });

    const overstayedVisitors = [];
    const warnings = [];

    for (const visitor of activeVisitors) {
      const durationMs = currentTime - visitor.checkInTime;
      const currentDuration = Math.round(durationMs / (1000 * 60)); // Convert to minutes
      
      // Check if approaching expected duration (80% of expected time)
      const warningThreshold = visitor.expectedDuration * 0.8;
      const isApproachingLimit = currentDuration >= warningThreshold && currentDuration < visitor.expectedDuration;
      
      // Check if overstayed
      const isOverstayed = currentDuration > visitor.expectedDuration;
      
      if (isOverstayed) {
        const overstayMinutes = currentDuration - visitor.expectedDuration;
        
        // Update visitor record
        visitor.isOverstayed = true;
        visitor.overstayMinutes = overstayMinutes;
        visitor.lastActivityTime = currentTime;
        
        // Add alert if not already triggered
        const hasRecentAlert = visitor.alertHistory.some(alert => 
          alert.alertType === 'Overstay Alert' && 
          (currentTime - alert.triggeredAt) < 30 * 60 * 1000 // Within last 30 minutes
        );
        
        if (!hasRecentAlert) {
          visitor.alertHistory.push({
            alertType: 'Overstay Alert',
            message: `Visitor has overstayed by ${overstayMinutes} minutes`,
            triggeredAt: currentTime
          });
          visitor.alertsTriggered = true;
        }
        
        await visitor.save();
        
        overstayedVisitors.push({
          ...visitor.toObject(),
          currentDuration,
          overstayMinutes
        });
      } else if (isApproachingLimit) {
        // Add warning if not already triggered
        const hasRecentWarning = visitor.alertHistory.some(alert => 
          alert.alertType === 'Duration Warning' && 
          (currentTime - alert.triggeredAt) < 15 * 60 * 1000 // Within last 15 minutes
        );
        
        if (!hasRecentWarning) {
          visitor.alertHistory.push({
            alertType: 'Duration Warning',
            message: `Visitor approaching expected duration (${currentDuration}/${visitor.expectedDuration} minutes)`,
            triggeredAt: currentTime
          });
          await visitor.save();
        }
        
        warnings.push({
          ...visitor.toObject(),
          currentDuration,
          remainingMinutes: visitor.expectedDuration - currentDuration
        });
      }
    }

    res.json({
      overstayedVisitors,
      warnings,
      totalActiveVisitors: activeVisitors.length,
      overstayedCount: overstayedVisitors.length,
      warningCount: warnings.length,
      lastChecked: currentTime
    });

  } catch (error) {
    console.error('Error checking overstayed visitors:', error);
    res.status(500).json({ message: 'Error checking overstayed visitors', error: error.message });
  }
});

// GET /analytics/duration - Get visitor duration analytics
router.get('/analytics/duration', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const dateFilter = {};
    if (startDate && endDate) {
      dateFilter.checkInTime = {
        $gte: new Date(startDate),
        $lte: new Date(endDate + 'T23:59:59.999Z')
      };
    }

    // Get duration statistics
    const durationStats = await Visitor.aggregate([
      { $match: { ...dateFilter, actualDuration: { $exists: true } } },
      {
        $group: {
          _id: null,
          avgDuration: { $avg: '$actualDuration' },
          minDuration: { $min: '$actualDuration' },
          maxDuration: { $max: '$actualDuration' },
          totalVisitors: { $sum: 1 },
          overstayedCount: { $sum: { $cond: ['$isOverstayed', 1, 0] } }
        }
      }
    ]);

    // Get duration distribution
    const durationDistribution = await Visitor.aggregate([
      { $match: { ...dateFilter, actualDuration: { $exists: true } } },
      {
        $bucket: {
          groupBy: '$actualDuration',
          boundaries: [0, 30, 60, 120, 240, 480, 1440], // 0-30min, 30-60min, 1-2hr, 2-4hr, 4-8hr, 8-24hr
          default: '1440+',
          output: {
            count: { $sum: 1 },
            avgDuration: { $avg: '$actualDuration' }
          }
        }
      }
    ]);

    // Get overstay analysis by purpose
    const overstayByPurpose = await Visitor.aggregate([
      { $match: { ...dateFilter, isOverstayed: true } },
      {
        $group: {
          _id: '$purpose',
          count: { $sum: 1 },
          avgOverstay: { $avg: '$overstayMinutes' }
        }
      },
      { $sort: { count: -1 } }
    ]);

    res.json({
      statistics: durationStats[0] || {
        avgDuration: 0,
        minDuration: 0,
        maxDuration: 0,
        totalVisitors: 0,
        overstayedCount: 0
      },
      durationDistribution,
      overstayByPurpose,
      overstayRate: durationStats[0] ? 
        ((durationStats[0].overstayedCount / durationStats[0].totalVisitors) * 100).toFixed(1) : 0
    });

  } catch (error) {
    console.error('Error fetching duration analytics:', error);
    res.status(500).json({ message: 'Error fetching duration analytics', error: error.message });
  }
});

// PUT /:id/duration - Update visitor expected duration
router.put('/:id/duration', async (req, res) => {
  try {
    const { id } = req.params;
    const { expectedDuration, notes } = req.body;

    const visitor = await Visitor.findById(id);
    if (!visitor) {
      return res.status(404).json({ message: 'Visitor not found' });
    }

    if (visitor.status !== 'Checked In') {
      return res.status(400).json({ message: 'Can only update duration for checked-in visitors' });
    }

    visitor.expectedDuration = expectedDuration;
    if (notes) visitor.notes = notes;
    
    await visitor.save();

    res.json({ 
      message: 'Visitor duration updated successfully', 
      visitor 
    });

  } catch (error) {
    console.error('Error updating visitor duration:', error);
    res.status(500).json({ message: 'Error updating visitor duration', error: error.message });
  }
});

// POST /:id/alerts/:alertId/acknowledge - Acknowledge visitor alert
router.post('/:id/alerts/:alertId/acknowledge', async (req, res) => {
  try {
    const { id, alertId } = req.params;
    const { acknowledgedBy } = req.body;

    const visitor = await Visitor.findById(id);
    if (!visitor) {
      return res.status(404).json({ message: 'Visitor not found' });
    }

    const alert = visitor.alertHistory.id(alertId);
    if (!alert) {
      return res.status(404).json({ message: 'Alert not found' });
    }

    alert.acknowledged = true;
    alert.acknowledgedBy = acknowledgedBy;
    alert.acknowledgedAt = new Date();
    
    await visitor.save();

    res.json({ 
      message: 'Alert acknowledged successfully', 
      alert 
    });

  } catch (error) {
    console.error('Error acknowledging alert:', error);
    res.status(500).json({ message: 'Error acknowledging alert', error: error.message });
  }
});

// GET /:id - Get a single visitor by ID
router.get('/:id', async (req, res) => {
  try {
    const visitor = await Visitor.findById(req.params.id);

    if (!visitor) {
      return res.status(404).json({ message: 'Visitor not found' });
    }

    res.json(visitor);
  } catch (error) {
    console.error('Error fetching visitor:', error);
    res.status(500).json({ message: 'Error fetching visitor', error: error.message });
  }
});

// PUT /:id - Update visitor by ID
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Remove fields that shouldn't be updated directly
    delete updateData.passId;
    delete updateData.checkInTime;
    delete updateData.checkOutTime;
    delete updateData.status;
    delete updateData.actualDuration;
    delete updateData.isOverstayed;
    delete updateData.overstayMinutes;
    delete updateData.alertsTriggered;
    delete updateData.alertHistory;
    delete updateData.lastActivityTime;

    const updatedVisitor = await Visitor.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!updatedVisitor) {
      return res.status(404).json({ message: 'Visitor not found' });
    }

    res.json({
      message: 'Visitor updated successfully',
      visitor: updatedVisitor
    });
  } catch (error) {
    console.error('Error updating visitor:', error);
    res.status(500).json({ message: 'Error updating visitor', error: error.message });
  }
});

// GET /reports/visitors - Generate visitor report
router.get('/reports/visitors', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ message: 'Please provide startDate and endDate' });
    }

    const report = await Visitor.find({
      visitDate: {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      }
    }).sort({ visitDate: -1 });

    res.json({
      count: report.length,
      data: report
    });
  } catch (error) {
    console.error('Error generating report:', error);
    res.status(500).json({ message: 'Error generating report', error: error.message });
  }
});

module.exports = router;
