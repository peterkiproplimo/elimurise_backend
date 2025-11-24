const express = require('express');
const router = express.Router();
const Complaint = require('../../models/frontoffice/Complaint');

// POST / - Create a new report
router.post('/', async (req, res) => {
  try {
    const {
      subject,
      description,
      category,
      priority,
      reporterName,
      reporterContact,
      reporterType,
      reporterId,
      status
    } = req.body;

    // ===== Validate required fields =====
    if (!subject || !description || !reporterName || !reporterType) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // ===== Create new report =====
    const newReport = await Complaint.create({
      subject,
      description,
      category,
      priority,
      reporterName,
      reporterContact,
      reporterType,
      reporterId,
      status: 'Open', // Default status
    });

    res.status(201).json({
      message: "Report created successfully",
      report: newReport,
    });
  } catch (error) {
    console.error("Error creating report:", error);
    res.status(500).json({
      message: "Error creating report",
      error: error.message,
    });
  }
});

// PUT /:id/status - Update report status
router.put('/:id/status', async (req, res) => {
  try {
    const { id } = req.params; // Report/complaint ID
    const { status } = req.body; // New status value

    console.log("Updating status for report ID:", id, "to status:", status);
    // ===== Validate input =====
    if (!status) {
      return res.status(400).json({ message: "Status is required" });
    }

    // ===== Check if complaint exists =====
    const report = await Complaint.findById(id);
    if (!report) {
      return res.status(404).json({ message: "Report not found" });
    }

    // ===== Update status =====
    report.status = status;
    await report.save();

    res.status(200).json({
      message: "Complaint status updated successfully",
      report,
    });
  } catch (error) {
    console.error("Error updating report status:", error);
    res.status(500).json({
      message: "Error updating report status",
      error: error.message,
    });
  }
});

// PUT /:id/assign - Update report assignment
router.put('/:id/assign', async (req, res) => {
  try {
    const { id } = req.params; // Complaint/Report ID
    const { assignedTo } = req.body; // New assigned user/staff ID

    console.log("Assigning report ID:", id, "to user/staff ID:", assignedTo);

    // ===== Validate input =====
    if (!assignedTo) {
      return res.status(400).json({ message: "AssignedTo (User/Staff ID) is required" });
    }

    // ===== Check if complaint exists =====
    const report = await Complaint.findById(id);
    if (!report) {
      return res.status(404).json({ message: "Report not found" });
    }

    // ===== Update assigned user/staff =====
    report.assignedTo = assignedTo;
    await report.save();

    res.status(200).json({
      message: "Complaint assigned successfully",
      report,
    });
  } catch (error) {
    console.error("Error updating complaint assignment:", error);
    res.status(500).json({
      message: "Error updating complaint assignment",
      error: error.message,
    });
  }
});

// GET /:id/replies - Get complaint replies
router.get('/:id/replies', async (req, res) => {
  try {
    const { id } = req.params;

    const complaint = await Complaint.findById(id).select("replies");
    if (!complaint) {
      return res.status(404).json({ message: "Complaint not found" });
    }

    res.status(200).json({
      message: "Replies fetched successfully",
      replies: complaint.replies,
    });
  } catch (error) {
    console.error("Error fetching replies:", error);
    res.status(500).json({
      message: "Error fetching replies",
      error: error.message,
    });
  }
});

// POST /:id/replies - Add complaint reply
router.post('/:id/replies', async (req, res) => {
  try {
    const { id } = req.params;
    const { message, sender } = req.body;

    if (!message || !sender) {
      return res.status(400).json({ message: "Message and sender are required" });
    }

    const complaint = await Complaint.findById(id);
    if (!complaint) {
      return res.status(404).json({ message: "Complaint not found" });
    }

    complaint.replies.push({ message, sender });
    await complaint.save();

    res.status(201).json({ message: "Reply added successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error adding reply", error: error.message });
  }
});

// GET / - Get all reports
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
      priority = "",
      category = ""
    } = req.query;

    console.log("Complaints API called with params:", req.query);

    // Build query object
    let query = {};

    // Add search functionality
    if (search) {
      console.log("Search term:", search);
      query.$or = [
        { subject: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { reporterName: { $regex: search, $options: "i" } },
        { reporterContact: { $regex: search, $options: "i" } },
        { assignedTo: { $regex: search, $options: "i" } }
      ];
      console.log("Search query:", query);
    }

    // Add status filter
    if (status && status.length > 0) {
      query.status = { $in: status };
    }

    // Add priority filter
    if (priority) {
      query.priority = priority;
    }

    // Add category filter
    if (category) {
      query.category = category;
    }

    // Build sort object
    const sortObj = {};
    sortObj[sortField] = sortOrder === "asc" ? 1 : -1;

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    console.log("Final query:", query);
    console.log("Sort object:", sortObj);

    // Execute query with pagination
    const reports = await Complaint.find(query)
      .sort(sortObj)
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count for pagination
    const total = await Complaint.countDocuments(query);

    console.log("Found reports:", reports.length, "Total:", total);

    // Calculate pagination info
    const totalPages = Math.ceil(total / parseInt(limit));

    res.json({
      data: reports,
      pagination: {
        current_page: parseInt(page),
        total: total,
        total_pages: totalPages,
        per_page: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error fetching reports:', error);
    res.status(500).json({ message: "Error fetching reports", error: error.message });
  }
});

// GET /:id - Get single report
router.get('/:id', async (req, res) => {
  try {
    const report = await Complaint.findById(req.params.id);
    if (!report) return res.status(404).json({ message: "Report not found" });
    res.status(200).json(report);
  } catch (error) {
    res.status(500).json({ message: "Error fetching report", error: error.message });
  }
});

// PUT /:id - Update a report
router.put('/:id', async (req, res) => {
  try {
    const updatedReport = await Complaint.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!updatedReport) return res.status(404).json({ message: "Report not found" });
    res.status(200).json({ message: "Report updated successfully", report: updatedReport });
  } catch (error) {
    res.status(500).json({ message: "Error updating report", error: error.message });
  }
});

// DELETE /:id - Delete a report
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await Complaint.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Report not found" });
    res.status(200).json({ message: "Report deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting report", error: error.message });
  }
});

module.exports = router;
