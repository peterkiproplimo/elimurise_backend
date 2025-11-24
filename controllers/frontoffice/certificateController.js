const Certificate = require("../../models/frontoffice/Certificate");
const fs = require("fs");
const path = require("path");

// Define uploads directory path
const uploadsDir = path.join(__dirname, '../../uploads/certificates');

// Ensure uploads directory exists
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('Created uploads/certificates directory');
}

/**
 * @desc Create new certificate
 * @route POST /api/certificates
 */
const createCertificate = async (req, res) => {
  try {
    // Extract data from FormData (req.body contains the form fields)
    const studentId = req.body.studentId;
    const certificateName = req.body.certificateName;
    const certificateType = req.body.certificateType;
    const description = req.body.description;
    const issueDate = req.body.issueDate;
    const expiryDate = req.body.expiryDate;
    const issuedBy = req.body.issuedBy;
    const issuerTitle = req.body.issuerTitle;
    const academicYear = req.body.academicYear;
    const term = req.body.term;
    const grade = req.body.grade;
    const createdBy = req.body.createdBy;

    // Get student information from FormData
    const studentName = req.body.studentName || "Unknown Student";
    const studentAdmNo = req.body.studentAdmNo || "N/A";

    // Debug: Log the received data
    console.log("Received FormData:", {
      studentId,
      certificateName,
      certificateType,
      issueDate,
      issuedBy,
      studentName,
      studentAdmNo
    });

    // Validate required fields
    if (!studentId || !certificateName || !certificateType || !issueDate || !issuedBy) {
      return res.status(400).json({ 
        message: "Missing required fields: studentId, certificateName, certificateType, issueDate, issuedBy",
        received: {
          studentId: !!studentId,
          certificateName: !!certificateName,
          certificateType: !!certificateType,
          issueDate: !!issueDate,
          issuedBy: !!issuedBy
        }
      });
    }

    // Handle file upload if present
    let certificateFileData = {};
    if (req.file) {
      const file = req.file;
      certificateFileData = {
        filename: file.filename,
        originalName: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        uploadDate: new Date()
      };
    }

    // Create certificate
    const certificate = await Certificate.create({
      studentId,
      studentName,
      studentAdmNo,
      certificateName,
      certificateType,
      description,
      issueDate,
      expiryDate,
      certificateFile: certificateFileData,
      issuedBy,
      issuerTitle,
      academicYear,
      term,
      grade,
      // Only include createdBy if it's a valid ObjectId, otherwise omit it
      ...(createdBy && createdBy !== "system" ? { createdBy } : {})
    });

    res.status(201).json({
      message: "Certificate created successfully",
      certificate
    });

  } catch (error) {
    console.error("Error creating certificate:", error);
    res.status(500).json({
      message: "Error creating certificate",
      error: error.message
    });
  }
};

/**
 * @desc Get all certificates with optional filtering
 * @route GET /api/certificates
 */
const getAllCertificates = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      studentId,
      certificateType,
      type,
      certificateCategories,
      sortBy = 'issueDate',
      sortOrder = 'desc'
    } = req.query;

    console.log("Certificates API called with params:", req.query);

    // Build filter object
    const filter = {};
    if (studentId) filter.studentId = studentId;
    if (certificateType) filter.certificateType = certificateType;
    if (type) filter.type = type;
    if (certificateCategories) filter.certificateCategories = certificateCategories;

    // Add search functionality
    if (search) {
      console.log("Search term:", search);
      filter.$or = [
        { studentName: { $regex: search, $options: "i" } },
        { certificateType: { $regex: search, $options: "i" } },
        { type: { $regex: search, $options: "i" } },
        { certificateCategories: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { studentId: { $regex: search, $options: "i" } }
      ];
      console.log("Search query:", filter);
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    console.log("Final filter:", filter);
    console.log("Sort object:", sort);

    // Fetch certificates with pagination
    const certificates = await Certificate.find(filter)
      .populate('createdBy', 'name email')
      .populate('verifiedBy', 'name email')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count for pagination
    const total = await Certificate.countDocuments(filter);

    console.log("Found certificates:", certificates.length, "Total:", total);

    res.status(200).json({
      data: certificates,
      certificates, // Keep for backward compatibility
      pagination: {
        current_page: parseInt(page),
        total_pages: Math.ceil(total / parseInt(limit)),
        total,
        per_page: parseInt(limit)
      }
    });

  } catch (error) {
    console.error("Error fetching certificates:", error);
    res.status(500).json({
      message: "Error fetching certificates",
      error: error.message
    });
  }
};

/**
 * @desc Get certificate by ID
 * @route GET /api/certificates/:id
 */
const getCertificateById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const certificate = await Certificate.findById(id)
      .populate('createdBy', 'name email')
      .populate('verifiedBy', 'name email');

    if (!certificate) {
      return res.status(404).json({ message: "Certificate not found" });
    }

    // Check if file exists
    if (certificate.certificateFile && certificate.certificateFile.filename) {
      const filePath = path.join(uploadsDir, certificate.certificateFile.filename);
      certificate.fileExists = fs.existsSync(filePath);
    } else {
      certificate.fileExists = false;
    }

    res.status(200).json(certificate);

  } catch (error) {
    console.error("Error fetching certificate:", error);
    res.status(500).json({
      message: "Error fetching certificate",
      error: error.message
    });
  }
};

/**
 * @desc Get certificates by student ID
 * @route GET /api/certificates/student/:studentId
 */
const getCertificatesByStudent = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { certificateType, status } = req.query;

    // Build filter
    const filter = { studentId };
    if (certificateType) filter.certificateType = certificateType;
    if (status) filter.status = status;

    const certificates = await Certificate.find(filter)
      .populate('createdBy', 'name email')
      .populate('verifiedBy', 'name email')
      .sort({ issueDate: -1 });

    res.status(200).json({
      studentId,
      certificates,
      count: certificates.length
    });

  } catch (error) {
    console.error("Error fetching student certificates:", error);
    res.status(500).json({
      message: "Error fetching student certificates",
      error: error.message
    });
  }
};

/**
 * @desc Update certificate
 * @route PUT /api/certificates/:id
 */
const updateCertificate = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Handle file upload if present
    if (req.file) {
      // Get the existing certificate to delete old file
      const existingCertificate = await Certificate.findById(id);
      
      if (existingCertificate && existingCertificate.certificateFile && existingCertificate.certificateFile.filename) {
        const oldFilePath = path.join(uploadsDir, existingCertificate.certificateFile.filename);
        
        try {
          if (fs.existsSync(oldFilePath)) {
            fs.unlinkSync(oldFilePath);
            console.log(`Old file deleted: ${oldFilePath}`);
          }
        } catch (fileError) {
          console.error(`Error deleting old file ${oldFilePath}:`, fileError);
        }
      }

      const file = req.file;
      updateData.certificateFile = {
        filename: file.filename,
        originalName: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        uploadDate: new Date()
      };
    }

    // Add updatedBy field only if we have a valid user ID
    if (req.user?.id) {
      updateData.updatedBy = req.user.id;
    }

    const certificate = await Certificate.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).populate('createdBy', 'name email')
     .populate('verifiedBy', 'name email');

    if (!certificate) {
      return res.status(404).json({ message: "Certificate not found" });
    }

    res.status(200).json({
      message: "Certificate updated successfully",
      certificate
    });

  } catch (error) {
    console.error("Error updating certificate:", error);
    res.status(500).json({
      message: "Error updating certificate",
      error: error.message
    });
  }
};

/**
 * @desc Delete certificate
 * @route DELETE /api/certificates/:id
 */
const deleteCertificate = async (req, res) => {
  try {
    const { id } = req.params;

    // First, get the certificate to access file information
    const certificate = await Certificate.findById(id);

    if (!certificate) {
      return res.status(404).json({ message: "Certificate not found" });
    }

    // Delete the file from filesystem if it exists
    if (certificate.certificateFile && certificate.certificateFile.filename) {
      const filePath = path.join(uploadsDir, certificate.certificateFile.filename);
      
      try {
        // Check if file exists before attempting to delete
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          console.log(`File deleted: ${filePath}`);
        } else {
          console.log(`File not found (already deleted): ${filePath}`);
        }
      } catch (fileError) {
        console.error(`Error deleting file ${filePath}:`, fileError);
        // Continue with database deletion even if file deletion fails
      }
    }

    // Delete the certificate from database
    await Certificate.findByIdAndDelete(id);

    res.status(200).json({
      message: "Certificate deleted successfully"
    });

  } catch (error) {
    console.error("Error deleting certificate:", error);
    res.status(500).json({
      message: "Error deleting certificate",
      error: error.message
    });
  }
};

/**
 * @desc Verify certificate
 * @route PATCH /api/certificates/:id/verify
 */
const verifyCertificate = async (req, res) => {
  try {
    const { id } = req.params;
    const { isVerified, verifiedBy } = req.body;

    // Prepare update data
    const updateData = {
      isVerified: isVerified || true,
      verifiedAt: new Date()
    };

    // Only add verifiedBy if we have a valid user ID
    if (verifiedBy || req.user?.id) {
      updateData.verifiedBy = verifiedBy || req.user.id;
    }

    const certificate = await Certificate.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).populate('createdBy', 'name email')
     .populate('verifiedBy', 'name email');

    if (!certificate) {
      return res.status(404).json({ message: "Certificate not found" });
    }

    res.status(200).json({
      message: `Certificate ${isVerified ? 'verified' : 'unverified'} successfully`,
      certificate
    });

  } catch (error) {
    console.error("Error verifying certificate:", error);
    res.status(500).json({
      message: "Error verifying certificate",
      error: error.message
    });
  }
};

/**
 * @desc Clean up orphaned certificate records (certificates with missing files)
 * @route POST /api/certificates/cleanup
 */
const cleanupOrphanedCertificates = async (req, res) => {
  try {
    const certificates = await Certificate.find({});
    let cleanedCount = 0;
    const orphanedCertificates = [];

    for (const certificate of certificates) {
      if (certificate.certificateFile && certificate.certificateFile.filename) {
        const filePath = path.join(uploadsDir, certificate.certificateFile.filename);
        
        if (!fs.existsSync(filePath)) {
          orphanedCertificates.push({
            id: certificate._id,
            filename: certificate.certificateFile.filename,
            certificateName: certificate.certificateName
          });
          
          // Delete the orphaned record
          await Certificate.findByIdAndDelete(certificate._id);
          cleanedCount++;
        }
      }
    }

    res.status(200).json({
      message: `Cleanup completed. Removed ${cleanedCount} orphaned certificate records.`,
      cleanedCount,
      orphanedCertificates
    });

  } catch (error) {
    console.error("Error cleaning up orphaned certificates:", error);
    res.status(500).json({
      message: "Error cleaning up orphaned certificates",
      error: error.message
    });
  }
};

/**
 * @desc Get certificate statistics
 * @route GET /api/certificates/stats
 */
const getCertificateStats = async (req, res) => {
  try {
    const stats = await Certificate.aggregate([
      {
        $group: {
          _id: null,
          totalCertificates: { $sum: 1 },
          activeCertificates: {
            $sum: { $cond: [{ $eq: ["$status", "Active"] }, 1, 0] }
          },
          expiredCertificates: {
            $sum: { $cond: [{ $eq: ["$status", "Expired"] }, 1, 0] }
          },
          verifiedCertificates: {
            $sum: { $cond: ["$isVerified", 1, 0] }
          }
        }
      }
    ]);

    // Get certificate type distribution
    const typeStats = await Certificate.aggregate([
      {
        $group: {
          _id: "$certificateType",
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    res.status(200).json({
      overall: stats[0] || {
        totalCertificates: 0,
        activeCertificates: 0,
        expiredCertificates: 0,
        verifiedCertificates: 0
      },
      byType: typeStats
    });

  } catch (error) {
    console.error("Error fetching certificate stats:", error);
    res.status(500).json({
      message: "Error fetching certificate statistics",
      error: error.message
    });
  }
};

module.exports = {
  createCertificate,
  getAllCertificates,
  getCertificateById,
  getCertificatesByStudent,
  updateCertificate,
  deleteCertificate,
  verifyCertificate,
  cleanupOrphanedCertificates,
  getCertificateStats
};
