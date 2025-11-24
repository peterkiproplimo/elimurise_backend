const Cohort = require("../../models/frontoffice/Cohort");
const OnlineApplicants = require("../../models/frontoffice/OnlineApplicants");

/**
 * @desc Create a new cohort
 * @route POST /api/cohorts
 */
const createCohort = async (req, res) => {
  try {
    const {
      name,
      description,
      startDate,
      endDate,
      applicationFee,
      maxApplications,
      isActive,
      settings
    } = req.body;

    // Validate required fields
    if (!name || !startDate || !endDate) {
      return res.status(400).json({ 
        message: "Name, start date, and end date are required" 
      });
    }

    // Generate unique token
    const token = generateToken();

    // Create cohort data
    const cohortData = {
      name,
      description,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      applicationFee: applicationFee || 1000,
      maxApplications: maxApplications || 100,
      isActive: isActive !== undefined ? isActive : true,
      token,
      generatedBy: req.user?.id || req.body.generatedBy,
      settings: {
        allowLateApplications: settings?.allowLateApplications || false,
        requireDocuments: settings?.requireDocuments !== undefined ? settings.requireDocuments : true,
        autoApprove: settings?.autoApprove || false
      }
    };

    // Create the cohort
    const cohort = await Cohort.create(cohortData);

    // Generate application URL
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const applicationUrl = `${baseUrl}/onlineregistration?token=${token}&cohort=${cohort._id}`;
    
    // Update cohort with URL
    cohort.applicationUrl = applicationUrl;
    await cohort.save();

    res.status(201).json({
      message: "Cohort created successfully",
      cohort: {
        ...cohort.toObject(),
        applicationUrl
      }
    });

  } catch (error) {
    console.error("Error creating cohort:", error);
    res.status(500).json({
      message: "Error creating cohort",
      error: error.message
    });
  }
};

/**
 * @desc Get cohort by token
 * @route GET /api/cohorts/token/:token
 */
const getCohortByToken = async (req, res) => {
  try {
    const { token } = req.params;
    
    const cohort = await Cohort.findOne({ token })
      .populate('generatedBy', 'name email');

    if (!cohort) {
      return res.status(404).json({ message: "Cohort not found" });
    }

    // Get application statistics
    const stats = await OnlineApplicants.aggregate([
      { $match: { cohortId: cohort._id.toString() } },
      {
        $group: {
          _id: '$applicationStatus',
          count: { $sum: 1 }
        }
      }
    ]);

    const statusCounts = {
      total: 0,
      pending: 0,
      approved: 0,
      rejected: 0
    };

    stats.forEach(stat => {
      statusCounts.total += stat.count;
      if (stat._id === 'Pending') statusCounts.pending = stat.count;
      if (stat._id === 'Confirmed') statusCounts.approved = stat.count;
      if (stat._id === 'Rejected') statusCounts.rejected = stat.count;
    });

    res.status(200).json({
      cohort: {
        ...cohort.toObject(),
        applicationStats: statusCounts
      }
    });

  } catch (error) {
    console.error("Error fetching cohort by token:", error);
    res.status(500).json({
      message: "Error fetching cohort",
      error: error.message
    });
  }
};

/**
 * @desc Get all cohorts
 * @route GET /api/cohorts
 */
const getAllCohorts = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, search, token } = req.query;
    
    // Build query
    const query = {};
    if (status) {
      query.status = status;
    }
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get cohorts with pagination
    const cohorts = await Cohort.find(query)
      .populate('generatedBy', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count
    const total = await Cohort.countDocuments(query);

    // Get application counts for each cohort
    const cohortsWithStats = await Promise.all(
      cohorts.map(async (cohort) => {
        const stats = await OnlineApplicants.aggregate([
          { $match: { cohortId: cohort._id.toString() } },
          {
            $group: {
              _id: '$applicationStatus',
              count: { $sum: 1 }
            }
          }
        ]);

        const statusCounts = {
          total: 0,
          pending: 0,
          approved: 0,
          rejected: 0
        };

        stats.forEach(stat => {
          statusCounts.total += stat.count;
          if (stat._id === 'Pending') statusCounts.pending = stat.count;
          if (stat._id === 'Confirmed') statusCounts.approved = stat.count;
          if (stat._id === 'Rejected') statusCounts.rejected = stat.count;
        });

        return {
          ...cohort.toObject(),
          applicationStats: statusCounts
        };
      })
    );

    res.status(200).json({
      cohorts: cohortsWithStats,
      pagination: {
        current_page: parseInt(page),
        total_pages: Math.ceil(total / parseInt(limit)),
        total,
        per_page: parseInt(limit)
      }
    });

  } catch (error) {
    console.error("Error fetching cohorts:", error);
    res.status(500).json({
      message: "Error fetching cohorts",
      error: error.message
    });
  }
};

/**
 * @desc Get cohort by ID
 * @route GET /api/cohorts/:id
 */
const getCohortById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const cohort = await Cohort.findById(id)
      .populate('generatedBy', 'name email');

    if (!cohort) {
      return res.status(404).json({ message: "Cohort not found" });
    }

    // Get application statistics
    const stats = await OnlineApplicants.aggregate([
      { $match: { cohortId: id } },
      {
        $group: {
          _id: '$applicationStatus',
          count: { $sum: 1 }
        }
      }
    ]);

    const statusCounts = {
      total: 0,
      pending: 0,
      approved: 0,
      rejected: 0
    };

    stats.forEach(stat => {
      statusCounts.total += stat.count;
      if (stat._id === 'Pending') statusCounts.pending = stat.count;
      if (stat._id === 'Confirmed') statusCounts.approved = stat.count;
      if (stat._id === 'Rejected') statusCounts.rejected = stat.count;
    });

    res.status(200).json({
      cohort: {
        ...cohort.toObject(),
        applicationStats: statusCounts
      }
    });

  } catch (error) {
    console.error("Error fetching cohort:", error);
    res.status(500).json({
      message: "Error fetching cohort",
      error: error.message
    });
  }
};

/**
 * @desc Update cohort
 * @route PUT /api/cohorts/:id
 */
const updateCohort = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const cohort = await Cohort.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).populate('generatedBy', 'name email');

    if (!cohort) {
      return res.status(404).json({ message: "Cohort not found" });
    }

    res.status(200).json({
      message: "Cohort updated successfully",
      cohort
    });

  } catch (error) {
    console.error("Error updating cohort:", error);
    res.status(500).json({
      message: "Error updating cohort",
      error: error.message
    });
  }
};

/**
 * @desc Delete cohort
 * @route DELETE /api/cohorts/:id
 */
const deleteCohort = async (req, res) => {
  try {
    const { id } = req.params;

    const cohort = await Cohort.findById(id);
    if (!cohort) {
      return res.status(404).json({ message: "Cohort not found" });
    }

    // Check if cohort has applications
    const applicationCount = await OnlineApplicants.countDocuments({ cohortId: id });
    if (applicationCount > 0) {
      return res.status(400).json({
        message: "Cannot delete cohort with existing applications",
        applicationCount
      });
    }

    await Cohort.findByIdAndDelete(id);

    res.status(200).json({
      message: "Cohort deleted successfully"
    });

  } catch (error) {
    console.error("Error deleting cohort:", error);
    res.status(500).json({
      message: "Error deleting cohort",
      error: error.message
    });
  }
};

/**
 * @desc Get applications by cohort
 * @route GET /api/cohorts/:id/applications
 */
const getCohortApplications = async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 10, status, search } = req.query;

    // Build query
    const query = { cohortId: id };
    if (status) {
      query.applicationStatus = status;
    }
    if (search) {
      query.$or = [
        { first_name: { $regex: search, $options: 'i' } },
        { last_name: { $regex: search, $options: 'i' } },
        { guardian_email: { $regex: search, $options: 'i' } }
      ];
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get applications
    const applications = await OnlineApplicants.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count
    const total = await OnlineApplicants.countDocuments(query);

    res.status(200).json({
      applications,
      pagination: {
        current_page: parseInt(page),
        total_pages: Math.ceil(total / parseInt(limit)),
        total,
        per_page: parseInt(limit)
      }
    });

  } catch (error) {
    console.error("Error fetching cohort applications:", error);
    res.status(500).json({
      message: "Error fetching cohort applications",
      error: error.message
    });
  }
};

// Helper function to generate unique token
const generateToken = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

module.exports = {
  createCohort,
  getCohortByToken,
  getAllCohorts,
  getCohortById,
  updateCohort,
  deleteCohort,
  getCohortApplications
};
