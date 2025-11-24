const ProjectEvidence = require('../../models/frontoffice/ProjectEvidence');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
// Cloudinary removed - only Google Drive URLs will be stored

// Migration function to convert old teacherFeedback format to new array format
const migrateTeacherFeedback = async (req, res) => {
  try {
    console.log('Starting teacherFeedback migration...');
    
    // Find all documents with old teacherFeedback format (object instead of array)
    const documentsToMigrate = await ProjectEvidence.find({
      teacherFeedback: { $exists: true, $not: { $type: "array" } }
    });
    
    console.log(`Found ${documentsToMigrate.length} documents to migrate`);
    
    let migratedCount = 0;
    
    for (const doc of documentsToMigrate) {
      try {
        // Convert single object to array format
        const feedbackArray = doc.teacherFeedback && Object.keys(doc.teacherFeedback).length > 0 
          ? [doc.teacherFeedback] 
          : [];
        
        // Use raw MongoDB collection to bypass Mongoose schema validation
        const collection = ProjectEvidence.collection;
        await collection.updateOne(
          { _id: doc._id },
          { 
            $set: { teacherFeedback: feedbackArray }
          }
        );
        
        migratedCount++;
        console.log(`Migrated document ${doc._id}`);
      } catch (error) {
        console.error(`Error migrating document ${doc._id}:`, error);
      }
    }
    
    console.log(`Migration completed. Migrated ${migratedCount} documents.`);
    
    res.json({
      message: 'Migration completed',
      totalDocuments: documentsToMigrate.length,
      migratedCount: migratedCount
    });
  } catch (error) {
    console.error('Error during migration:', error);
    res.status(500).json({ message: 'Migration failed', error: error.message });
  }
};

// Multer and local uploads removed - backend only accepts Google Drive URLs via JSON

// Get all project evidences with filtering and pagination
const getProjectEvidences = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      subject,
      competency,
      student,
      status,
      dateFrom,
      dateTo
    } = req.query;

    const query = {};

    // Search functionality
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { caption: { $regex: search, $options: 'i' } },
        { reflection: { $regex: search, $options: 'i' } }
      ];
    }

    // Filter by subject
    if (subject) {
      query.subject = subject;
    }

    // Filter by competency
    if (competency) {
      query.competency = competency;
    }

    // Filter by student
    if (student) {
      query.student = student;
    }

    // Filter by status
    if (status) {
      query.status = status;
    }

    // Filter by date range
    if (dateFrom || dateTo) {
      query.submittedAt = {};
      if (dateFrom) {
        query.submittedAt.$gte = new Date(dateFrom);
      }
      if (dateTo) {
        query.submittedAt.$lte = new Date(dateTo);
      }
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const projectEvidences = await ProjectEvidence.find(query)
      .populate('subject', 'name code')
      .populate('competency', 'name code')
      .populate('teacherFeedback.feedbackBy', 'name')
      .sort({ submittedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Handle migration from old single object format to new array format
    projectEvidences.forEach(project => {
      if (!Array.isArray(project.teacherFeedback)) {
        if (project.teacherFeedback && Object.keys(project.teacherFeedback).length > 0) {
          // Convert old single object to array format
          project.teacherFeedback = [project.teacherFeedback];
        } else {
          // If no existing feedback, initialize as empty array
          project.teacherFeedback = [];
        }
      }
    });

    const total = await ProjectEvidence.countDocuments(query);
    const totalPages = Math.ceil(total / parseInt(limit));

    res.json({
      projectEvidences,
      total,
      totalPages,
      currentPage: parseInt(page)
    });
  } catch (error) {
    console.error('Error fetching project evidences:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get all feedback for a project evidence
const getProjectEvidenceFeedback = async (req, res) => {
  try {
    const { id } = req.params;

    const projectEvidence = await ProjectEvidence.findById(id)
      .populate('teacherFeedback.feedbackBy', 'name email')
      .select('teacherFeedback');

    if (!projectEvidence) {
      return res.status(404).json({ message: 'Project evidence not found' });
    }

    // Handle migration from old single object format to new array format
    let feedbackArray = [];
    if (Array.isArray(projectEvidence.teacherFeedback)) {
      feedbackArray = projectEvidence.teacherFeedback;
    } else if (projectEvidence.teacherFeedback && Object.keys(projectEvidence.teacherFeedback).length > 0) {
      // Convert old single object to array format
      feedbackArray = [projectEvidence.teacherFeedback];
    }

    // Sort feedback by date (newest first)
    const sortedFeedback = feedbackArray.sort((a, b) => 
      new Date(b.feedbackDate) - new Date(a.feedbackDate)
    );

    res.json({
      projectId: id,
      feedback: sortedFeedback,
      totalFeedback: sortedFeedback.length
    });
  } catch (error) {
    console.error('Error fetching project evidence feedback:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get single project evidence
const getProjectEvidence = async (req, res) => {
  try {
    const { id } = req.params;

    const projectEvidence = await ProjectEvidence.findById(id)
      .populate('subject', 'name code')
      .populate('competency', 'name code')
      .populate('teacherFeedback.feedbackBy', 'name');

    if (!projectEvidence) {
      return res.status(404).json({ message: 'Project evidence not found' });
    }

    // Handle migration from old single object format to new array format
    if (!Array.isArray(projectEvidence.teacherFeedback)) {
      if (projectEvidence.teacherFeedback && Object.keys(projectEvidence.teacherFeedback).length > 0) {
        // Convert old single object to array format
        projectEvidence.teacherFeedback = [projectEvidence.teacherFeedback];
      } else {
        // If no existing feedback, initialize as empty array
        projectEvidence.teacherFeedback = [];
      }
    }

    res.json(projectEvidence);
  } catch (error) {
    console.error('Error fetching project evidence:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Create new project evidence
const createProjectEvidence = async (req, res) => {
  try {
    const {
      title,
      description,
      caption,
      reflection,
      subject,
      learningArea, // Frontend sends learningArea
      learningAreaName, // Frontend sends learningArea name
      learningAreaCode, // Frontend sends learningArea code
      competency,
      competencyName, // Frontend sends competency name
      competencyCode, // Frontend sends competency code
      pci,
      evidenceType,
      student,
      studentName,
      studentId,
      files  // Array of Google Drive files: [{ mediaUrl, googleDriveUrl, googleDriveFileId }, ...]
    } = req.body;

    // Map learningArea to subject for backward compatibility
    const subjectId = subject || learningArea;

    // Check if required fields are present
    if (!files || !Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ message: 'At least one Google Drive file is required in the files array' });
    }

    // Validate files array structure
    for (const file of files) {
      if (!file.mediaUrl || !file.googleDriveUrl || !file.googleDriveFileId || !file.fileType) {
        return res.status(400).json({ 
          message: 'Each file must have mediaUrl, googleDriveUrl, googleDriveFileId, and fileType' 
        });
      }
    }

    if (!student) {
      return res.status(400).json({ message: 'Student selection is required' });
    }

    if (!studentName) {
      return res.status(400).json({ message: 'Student name is required' });
    }

    if (!studentId) {
      return res.status(400).json({ message: 'Student ID is required' });
    }

    // Use frontend subject data instead of database lookup
    let subjectData = null;
    if (subjectId && subjectId.trim() !== '') {
      subjectData = {
        _id: subjectId,
        name: learningAreaName || 'Unknown Subject',
        code: learningAreaCode || 'N/A'
      };
    }

    // Use frontend competency data instead of database lookup
    let competencyData = null;
    if (competency && competency.trim() !== '') {
      competencyData = {
        _id: competency,
        name: competencyName || 'Unknown Competency',
        code: competencyCode || 'N/A'
      };
    }

    // Use frontend student data instead of database lookup
    const studentData = {
      _id: student,
      name: studentName,
      studentId: studentId
    };
    
    console.log('Using frontend student data:', studentData);
    
    // Use first file's URL as mediaUrl for backward compatibility
    const mediaUrl = files[0].mediaUrl;
    // Keep first file's data in old fields for backward compatibility
    const googleDriveUrl = files[0].googleDriveUrl;
    const googleDriveFileId = files[0].googleDriveFileId;

    const projectEvidence = new ProjectEvidence({
      title,
      description,
      caption,
      reflection,
      ...(subjectId && subjectId.trim() !== '' && { subject: subjectId }),
      ...(competency && competency.trim() !== '' && { competency }),
      pci,
      evidenceType,
      mediaUrl,
      googleDriveFiles: files,  // Store all files in array
      googleDriveUrl,  // Keep first file for backward compatibility
      googleDriveFileId,  // Keep first file for backward compatibility
      student: student,
      studentName: studentName,
      studentId: studentId,
      status: 'submitted'
    });

    await projectEvidence.save();

    // Populate the response
    await projectEvidence.populate([
      { path: 'subject', select: 'name code' },
      { path: 'competency', select: 'name code' }
    ]);

    res.status(201).json({
      ...projectEvidence.toObject(),
      message: 'Project evidence created successfully'
    });
  } catch (error) {
    console.error('Error creating project evidence:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Update project evidence
const updateProjectEvidence = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const projectEvidence = await ProjectEvidence.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    )
      .populate('subject', 'name code')
      .populate('competency', 'name code')
      .populate('teacherFeedback.feedbackBy', 'name');

    if (!projectEvidence) {
      return res.status(404).json({ message: 'Project evidence not found' });
    }

    res.json(projectEvidence);
  } catch (error) {
    console.error('Error updating project evidence:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Delete project evidence
const deleteProjectEvidence = async (req, res) => {
  try {
    const { id } = req.params;

    const projectEvidence = await ProjectEvidence.findById(id);
    if (!projectEvidence) {
      return res.status(404).json({ message: 'Project evidence not found' });
    }

    // No local or Cloudinary deletions necessary when only storing Google Drive URLs

    await ProjectEvidence.findByIdAndDelete(id);

    res.json({ message: 'Project evidence deleted successfully' });
  } catch (error) {
    console.error('Error deleting project evidence:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Add teacher feedback
const addTeacherFeedback = async (req, res) => {
  try {
    const { id } = req.params;
    const { comment, rating, authenticityApproved } = req.body;

    const projectEvidence = await ProjectEvidence.findById(id);
    if (!projectEvidence) {
      return res.status(404).json({ message: 'Project evidence not found' });
    }

    // Create new feedback entry
    const newFeedback = {
      comment,
      rating: parseInt(rating),
      authenticityApproved: authenticityApproved === 'true',
      feedbackDate: new Date()
    };
    
    // Only set feedbackBy if we have a valid ObjectId
    if (req.user?.id && mongoose.Types.ObjectId.isValid(req.user.id)) {
      newFeedback.feedbackBy = req.user.id;
    }
    
    // Add teacher name if available
    if (req.user?.name) {
      newFeedback.feedbackBy_name = req.user.name;
    }
    
    // Handle migration and feedback addition
    let feedbackArray = [];
    
    // Check if teacherFeedback exists and is not null/undefined
    if (projectEvidence.teacherFeedback) {
      if (Array.isArray(projectEvidence.teacherFeedback)) {
        // Already an array, use it
        feedbackArray = [...projectEvidence.teacherFeedback];
      } else if (typeof projectEvidence.teacherFeedback === 'object' && Object.keys(projectEvidence.teacherFeedback).length > 0) {
        // Old single object format, convert to array
        feedbackArray = [projectEvidence.teacherFeedback];
      }
    }
    
    // Add new feedback to the array
    feedbackArray.push(newFeedback);
    
    // Use raw MongoDB collection to bypass Mongoose schema validation
    const collection = ProjectEvidence.collection;
    
    await collection.updateOne(
      { _id: new mongoose.Types.ObjectId(id) },
      { 
        $set: { 
          teacherFeedback: feedbackArray,
          status: authenticityApproved === 'true' ? 'approved' : 'reviewed'
        }
      }
    );

    // Fetch the updated document to return
    const updatedProjectEvidence = await ProjectEvidence.findById(id)
      .populate('subject', 'name code')
      .populate('competency', 'name code')
      .populate('teacherFeedback.feedbackBy', 'name');

    res.json(updatedProjectEvidence);
  } catch (error) {
    console.error('Error adding teacher feedback:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Upload existing project evidence to Cloudinary
const uploadToCloudinary = async (req, res) => {
  try {
    const { id } = req.params;

    const projectEvidence = await ProjectEvidence.findById(id)
      .populate('subject', 'name code')
      .populate('competency', 'name code')
;

    if (!projectEvidence) {
      return res.status(404).json({ message: 'Project evidence not found' });
    }

    // Check if already uploaded to Cloudinary
    if (projectEvidence.cloudinaryData && projectEvidence.cloudinaryData.public_id) {
      return res.status(400).json({ 
        message: 'Project evidence already uploaded to Cloudinary',
        cloudinaryData: projectEvidence.cloudinaryData
      });
    }

    // Check if local file exists
    if (!projectEvidence.mediaUrl) {
      return res.status(400).json({ message: 'No media file found for this project evidence' });
    }

    const filePath = path.join(process.cwd(), projectEvidence.mediaUrl);
    if (!fs.existsSync(filePath)) {
      return res.status(400).json({ message: 'Local media file not found' });
    }

    // Upload to Cloudinary
    const uploadResult = await cloudinaryService.uploadProjectEvidence(filePath, {
      title: projectEvidence.title,
      description: projectEvidence.description,
      caption: projectEvidence.caption,
      reflection: projectEvidence.reflection,
      subject: projectEvidence.subject,
      competency: projectEvidence.competency,
      pci: projectEvidence.pci,
      evidenceType: projectEvidence.evidenceType,
      student: projectEvidence.student
    });

    if (uploadResult.success) {
      // Update the project evidence with Cloudinary data
      projectEvidence.cloudinaryData = {
        public_id: uploadResult.public_id,
        secure_url: uploadResult.secure_url,
        url: uploadResult.url,
        format: uploadResult.format,
        width: uploadResult.width,
        height: uploadResult.height,
        bytes: uploadResult.bytes,
        folder: uploadResult.folder,
        folderStructure: uploadResult.folderStructure
      };

      // Update mediaUrl to use Cloudinary URL
      projectEvidence.mediaUrl = uploadResult.secure_url;

      await projectEvidence.save();

      res.json({
        message: 'Project evidence uploaded to Cloudinary successfully',
        cloudinaryData: projectEvidence.cloudinaryData
      });
    } else {
      res.status(500).json({ 
        message: 'Failed to upload to Cloudinary',
        error: uploadResult.error
      });
    }

  } catch (error) {
    console.error('Error uploading to Cloudinary:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get Cloudinary file information
const getCloudinaryInfo = async (req, res) => {
  try {
    const { id } = req.params;

    const projectEvidence = await ProjectEvidence.findById(id);
    if (!projectEvidence) {
      return res.status(404).json({ message: 'Project evidence not found' });
    }

    if (!projectEvidence.cloudinaryData || !projectEvidence.cloudinaryData.public_id) {
      return res.status(404).json({ message: 'No Cloudinary data found for this project evidence' });
    }

    const fileInfo = await cloudinaryService.getFileInfo(projectEvidence.cloudinaryData.public_id);
    
    if (fileInfo.success) {
      res.json({
        cloudinaryData: projectEvidence.cloudinaryData,
        fileInfo: fileInfo.fileInfo
      });
    } else {
      res.status(500).json({ 
        message: 'Failed to get Cloudinary file information',
        error: fileInfo.error
      });
    }
  } catch (error) {
    console.error('Error getting Cloudinary file information:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Generate optimized URL for Cloudinary file
const getOptimizedUrl = async (req, res) => {
  try {
    const { id } = req.params;
    const { width, height, crop, quality } = req.query;

    const projectEvidence = await ProjectEvidence.findById(id);
    if (!projectEvidence) {
      return res.status(404).json({ message: 'Project evidence not found' });
    }

    if (!projectEvidence.cloudinaryData || !projectEvidence.cloudinaryData.public_id) {
      return res.status(404).json({ message: 'No Cloudinary data found for this project evidence' });
    }

    const options = {};
    if (width) options.width = parseInt(width);
    if (height) options.height = parseInt(height);
    if (crop) options.crop = crop;
    if (quality) options.quality = quality;

    const optimizedUrl = cloudinaryService.generateOptimizedUrl(
      projectEvidence.cloudinaryData.public_id, 
      options
    );

    res.json({
      optimizedUrl,
      originalUrl: projectEvidence.cloudinaryData.secure_url,
      publicId: projectEvidence.cloudinaryData.public_id
    });
  } catch (error) {
    console.error('Error generating optimized URL:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Toggle project evidence status
const toggleProjectEvidenceStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const projectEvidence = await ProjectEvidence.findById(id);
    if (!projectEvidence) {
      return res.status(404).json({ message: 'Project evidence not found' });
    }

    // Toggle between approved and rejected
    if (projectEvidence.status === 'approved') {
      projectEvidence.status = 'rejected';
    } else {
      projectEvidence.status = 'approved';
    }

    await projectEvidence.save();

    res.json(projectEvidence);
  } catch (error) {
    console.error('Error toggling project evidence status:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Test Cloudinary connection
const testCloudinary = async (req, res) => {
  try {
    console.log('Testing Cloudinary connection...');
    
    // Test with a simple image URL upload
    const testResult = await cloudinaryService.uploadFile('https://res.cloudinary.com/demo/image/upload/getting-started/shoes.jpg', {
      public_id: 'test-shoes',
      folder: 'test-uploads'
    });
    
    res.json({
      message: 'Cloudinary test completed',
      result: testResult
    });
  } catch (error) {
    console.error('Cloudinary test error:', error);
    res.status(500).json({ 
      message: 'Cloudinary test failed',
      error: error.message 
    });
  }
};

// Test file upload with Cloudinary
const testFileUpload = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    console.log('Testing file upload to Cloudinary...');
    console.log('File:', req.file);

    const filePath = path.join(process.cwd(), 'uploads/project-evidences', req.file.filename);
    console.log('File path:', filePath);
    console.log('File exists:', fs.existsSync(filePath));

    const testResult = await cloudinaryService.uploadFile(filePath, {
      public_id: `test-upload-${Date.now()}`,
      folder: 'test-uploads'
    });

    res.json({
      message: 'File upload test completed',
      result: testResult,
      file: {
        originalname: req.file.originalname,
        filename: req.file.filename,
        mimetype: req.file.mimetype,
        size: req.file.size
      }
    });
  } catch (error) {
    console.error('File upload test error:', error);
    res.status(500).json({ 
      message: 'File upload test failed',
      error: error.message 
    });
  }
};

module.exports = {
  migrateTeacherFeedback,
  getProjectEvidences,
  getProjectEvidenceFeedback,
  getProjectEvidence,
  createProjectEvidence,
  updateProjectEvidence,
  deleteProjectEvidence,
  addTeacherFeedback,
  uploadToCloudinary,
  getCloudinaryInfo,
  getOptimizedUrl,
  toggleProjectEvidenceStatus,
  testCloudinary,
  testFileUpload
};
