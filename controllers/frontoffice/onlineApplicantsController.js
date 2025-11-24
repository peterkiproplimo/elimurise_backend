const express = require('express');
const router = express.Router();
const multer = require('multer');
const OnlineApplicants = require('../../models/frontoffice/OnlineApplicants');

// Helper function to get reviewer ID
const getReviewerId = (req, reviewedBy) => {
  return reviewedBy || req.user?.id || req.user?.name || 'System';
};

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit per file
  },
  fileFilter: (req, file, cb) => {
    // Allow common document types
    const allowedTypes = /jpeg|jpg|png|pdf|doc|docx/;
    const extname = allowedTypes.test(file.originalname.toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images, PDFs, and documents are allowed.'));
    }
  }
});

// POST / - Register new online applicant (student + parent data)
router.post('/', upload.fields([
  { name: 'birth-certificate', maxCount: 1 },
  { name: 'passport-photo', maxCount: 1 },
  { name: 'academic-report', maxCount: 1 },
  { name: 'transfer-letter', maxCount: 1 },
  { name: 'parent-id', maxCount: 1 },
  { name: 'medical-report', maxCount: 1 }
]), (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'File too large. Maximum size is 10MB per file.' });
    }
  }
  next(error);
}, async (req, res) => {
  try {
    // Debug: Log the entire request body and files
    console.log('=== REQUEST DEBUG ===');
    console.log('req.body:', req.body);
    console.log('req.files:', req.files);
    console.log('Content-Type:', req.headers['content-type']);
    console.log('===================');

    const {
      // ===== Student Details =====
      first_name,
      middle_name,
      last_name,
      gender,
      dateOfBirth,
      nationality,
      countySubCounty,
      birthCertificateNo,

      // ===== Parent/Guardian Details =====
      guardian_relationship,
      guardian_first_name,
      guardian_surname,
      guardian_last_name,
      guardian_email,
      guardian_phone,
      postalAddress,
      idNumber,

      // ===== Academic Information =====
      currentOrLastSchool,
      currentClass,
      classApplyingFor,
      kcpeIndexNumber,
      kcpeMarks,

      // ===== Address/Contact Details =====
      homeAddress,
      nearestLandmark,
      distanceFromSchool,

      // ===== Payment Information =====
      payment: paymentString,

      // ===== Assessment fields =====
      grade,
      term,
      test,
      learning_area,

      // ===== Application Status =====
      applicationStatus,

      // ===== Cohort Information =====
      cohortId,

      // ===== Optional metadata / admin fields =====
      reviewedBy,
      reviewedAt,
      adminNotes,
      smsSentToParent,
      smsSentAt
    } = req.body;

    // ===== Parse payment data if it's a JSON string =====
    let payment = {};
    if (paymentString) {
      try {
        payment = typeof paymentString === 'string' ? JSON.parse(paymentString) : paymentString;
        console.log('Parsed payment data:', payment);
      } catch (error) {
        console.error('Error parsing payment data:', error);
        payment = {};
      }
    }

    // Debug: Log received data
    console.log('Received application data:', {
      first_name,
      last_name,
      guardian_first_name,
      guardian_email,
      payment: payment
    });

    // ===== Construct applicant object =====
    const applicantData = {
      // Student Details
      first_name,
      middle_name,
      last_name,
      gender,
      dateOfBirth,
      nationality,
      countySubCounty,
      birthCertificateNo,

      // Parent/Guardian Details
      guardian_relationship,
      guardian_first_name,
      guardian_surname,
      guardian_last_name,
      guardian_email,
      guardian_phone,
      postalAddress,
      idNumber,

      // Academic Information
      currentOrLastSchool,
      currentClass,
      classApplyingFor,
      kcpeIndexNumber,
      kcpeMarks,

      // Address/Contact Details
      homeAddress,
      nearestLandmark,
      distanceFromSchool,

      // Payment
      payment: {
        method: payment?.method,
        amount: payment?.amount || 1000, // default
        transactionCode: payment?.transactionCode,
        paymentDate: payment?.paymentDate,
        status: payment?.status || "Pending"
      },

      // Application Status
      applicationStatus: applicationStatus || 'Pending',

      // Cohort Information
      cohortId: cohortId || null,

      // Optional fields
      grade,
      term,
      test,
      learning_area,
      reviewedBy,
      reviewedAt,
      adminNotes,
      smsSentToParent,
      smsSentAt
    };

    // ===== Handle document uploads if any =====
    if (req.files) {
      applicantData.documents = {};

      // Map frontend kebab-case field names to backend camelCase field names
      const docFieldMapping = {
        "birth-certificate": "birthCertificate",
        "passport-photo": "passportPhoto", 
        "academic-report": "academicReport",
        "transfer-letter": "transferLetter",
        "parent-id": "parentId",
        "medical-report": "medicalReport"
      };

      Object.keys(docFieldMapping).forEach((frontendField) => {
        const backendField = docFieldMapping[frontendField];
        if (req.files[frontendField] && req.files[frontendField][0]) {
          const file = req.files[frontendField][0];
          applicantData.documents[backendField] = {
            originalName: file.originalname,
            mimetype: file.mimetype,
            size: file.size,
            uploadDate: new Date(),
            buffer: file.buffer // Store file content in memory for now
          };
        }
      });
    }

    // ===== Handle documents from JSON payload (if no files uploaded) =====
    if (!req.files && req.body.documents) {
      applicantData.documents = {};

      // Map frontend kebab-case field names to backend camelCase field names
      const docFieldMapping = {
        "birth-certificate": "birthCertificate",
        "passport-photo": "passportPhoto", 
        "academic-report": "academicReport",
        "transfer-letter": "transferLetter",
        "parent-id": "parentId",
        "medical-report": "medicalReport"
      };

      Object.keys(req.body.documents).forEach((frontendField) => {
        const backendField = docFieldMapping[frontendField];
        if (req.body.documents[frontendField] && Object.keys(req.body.documents[frontendField]).length > 0) {
          applicantData.documents[backendField] = {
            filename: req.body.documents[frontendField].name || 'uploaded',
            originalName: req.body.documents[frontendField].name || 'document',
            mimetype: req.body.documents[frontendField].type || 'application/octet-stream',
            size: req.body.documents[frontendField].size || 0,
            uploadDate: new Date()
          };
        }
      });
    }

    // ===== Initialize empty documents object if no documents provided =====
    if (!applicantData.documents) {
      applicantData.documents = {};
    }

    // ===== Save applicant =====
    const applicant = await OnlineApplicants.create(applicantData);

    // ===== Respond with success =====
    res.status(201).json({
      message: "Online applicant registered successfully",
      applicant
    });

  } catch (error) {
    console.error("Error registering applicant:", error);
    res.status(500).json({
      message: "Error registering applicant",
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// GET / - Get all online applicants
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      grade,
      stream,
      status,
      cohortId,
      sortField = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build query object
    const query = {};

    // Search functionality
    if (search) {
      query.$or = [
        { first_name: { $regex: search, $options: 'i' } },
        { last_name: { $regex: search, $options: 'i' } },
        { guardian_first_name: { $regex: search, $options: 'i' } },
        { guardian_email: { $regex: search, $options: 'i' } },
        { guardian_phone: { $regex: search, $options: 'i' } },
        { kcpeIndexNumber: { $regex: search, $options: 'i' } }
      ];
    }

    // Grade filter
    if (grade) {
      query.classApplyingFor = grade;
    }

    // Stream filter (if applicable)
    if (stream) {
      query.stream = stream;
    }

    // Status filter
    if (status) {
      if (Array.isArray(status)) {
        query.applicationStatus = { $in: status };
      } else {
        query.applicationStatus = status;
      }
    }

    // Cohort filter
    if (cohortId) {
      query.cohortId = cohortId;
    }

    // Build sort object
    const sort = {};
    sort[sortField] = sortOrder === 'asc' ? 1 : -1;

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Execute query with pagination and sorting
    const applicants = await OnlineApplicants.find(query)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count for pagination
    const total = await OnlineApplicants.countDocuments(query);

    // Calculate pagination info
    const totalPages = Math.ceil(total / parseInt(limit));

    res.status(200).json({
      applicants,
      pagination: {
        current_page: parseInt(page),
        total,
        total_pages: totalPages,
        limit: parseInt(limit)
      }
    });

  } catch (error) {
    console.error("Error fetching applicants:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// GET /:id - Get single applicant by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const applicant = await OnlineApplicants.findById(id);

    if (!applicant) {
      return res.status(404).json({ message: "Applicant not found" });
    }

    res.status(200).json(applicant);
  } catch (error) {
    console.error("Error fetching applicant:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// PUT /:id/shortlist - Shortlist an applicant
router.put('/:id/shortlist', async (req, res) => {
  try {
    const { id } = req.params;
    const { adminNotes, reviewedBy } = req.body;

    // Find the applicant
    const applicant = await OnlineApplicants.findById(id);
    if (!applicant) {
      return res.status(404).json({ 
        success: false,
        message: "Applicant not found" 
      });
    }

    // Check if applicant is in pending status
    if (applicant.applicationStatus !== 'Pending') {
      return res.status(400).json({
        success: false,
        message: `Cannot shortlist applicant with status: ${applicant.applicationStatus}. Only pending applicants can be shortlisted.`
      });
    }

    // Update applicant status to shortlisted
    const updatedApplicant = await OnlineApplicants.findByIdAndUpdate(
      id,
      {
        applicationStatus: 'Shortlisted',
        reviewedBy: getReviewerId(req, reviewedBy),
        reviewedAt: new Date(),
        adminNotes: adminNotes || applicant.adminNotes,
        $push: {
          statusHistory: {
            status: 'Shortlisted',
            changedBy: getReviewerId(req, reviewedBy),
            changedAt: new Date(),
            notes: adminNotes || 'Applicant shortlisted for review'
          }
        }
      },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: "Applicant shortlisted successfully",
      applicant: updatedApplicant
    });

  } catch (error) {
    console.error("Error shortlisting applicant:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
});

// PUT /:id/confirm - Confirm an applicant
router.put('/:id/confirm', async (req, res) => {
  try {
    const { id } = req.params;
    const { adminNotes, reviewedBy } = req.body;

    // Find the applicant
    const applicant = await OnlineApplicants.findById(id);
    if (!applicant) {
      return res.status(404).json({ 
        success: false,
        message: "Applicant not found" 
      });
    }

    // Check if applicant is in shortlisted status
    if (applicant.applicationStatus !== 'Shortlisted') {
      return res.status(400).json({
        success: false,
        message: `Cannot confirm applicant with status: ${applicant.applicationStatus}. Only shortlisted applicants can be confirmed.`
      });
    }

    // Update applicant status to confirmed
    const updatedApplicant = await OnlineApplicants.findByIdAndUpdate(
      id,
      {
        applicationStatus: 'Confirmed',
        reviewedBy: getReviewerId(req, reviewedBy),
        reviewedAt: new Date(),
        adminNotes: adminNotes || applicant.adminNotes,
        $push: {
          statusHistory: {
            status: 'Confirmed',
            changedBy: getReviewerId(req, reviewedBy),
            changedAt: new Date(),
            notes: adminNotes || 'Application confirmed and accepted'
          }
        }
      },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: "Applicant confirmed successfully",
      applicant: updatedApplicant
    });

  } catch (error) {
    console.error("Error confirming applicant:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
});

// PUT /:id/reject - Reject an applicant
router.put('/:id/reject', async (req, res) => {
  try {
    const { id } = req.params;
    const { adminNotes, reviewedBy, rejectionReason } = req.body;

    // Find the applicant
    const applicant = await OnlineApplicants.findById(id);
    if (!applicant) {
      return res.status(404).json({ 
        success: false,
        message: "Applicant not found" 
      });
    }

    // Check if applicant is in pending or shortlisted status
    if (!['Pending', 'Shortlisted'].includes(applicant.applicationStatus)) {
      return res.status(400).json({
        success: false,
        message: `Cannot reject applicant with status: ${applicant.applicationStatus}. Only pending or shortlisted applicants can be rejected.`
      });
    }

    // Update applicant status to rejected
    const updatedApplicant = await OnlineApplicants.findByIdAndUpdate(
      id,
      {
        applicationStatus: 'Rejected',
        reviewedBy: getReviewerId(req, reviewedBy),
        reviewedAt: new Date(),
        adminNotes: adminNotes || applicant.adminNotes,
        rejectionReason: rejectionReason || 'Application rejected',
        $push: {
          statusHistory: {
            status: 'Rejected',
            changedBy: getReviewerId(req, reviewedBy),
            changedAt: new Date(),
            notes: adminNotes || rejectionReason || 'Application rejected'
          }
        }
      },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: "Applicant rejected successfully",
      applicant: updatedApplicant
    });

  } catch (error) {
    console.error("Error rejecting applicant:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
});

// DELETE /:id - Delete an applicant
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Find the applicant
    const applicant = await OnlineApplicants.findById(id);
    if (!applicant) {
      return res.status(404).json({ 
        success: false,
        message: "Applicant not found" 
      });
    }

    // Delete the applicant
    await OnlineApplicants.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: "Applicant deleted successfully"
    });

  } catch (error) {
    console.error("Error deleting applicant:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
});

module.exports = router;
