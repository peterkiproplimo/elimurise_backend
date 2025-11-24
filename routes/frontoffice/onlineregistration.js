import express from "express";
import multer from "multer";

import {

  registerOnlineApplicant,
  getAllOnlineApplicants,
  getOnlineApplicantById,
  shortlistApplicant,
  confirmApplicant,
  rejectApplicant,
  deleteOnlineApplicant

} from "../../controllers/frontoffice/onlineApplicantsController.js";

const router = express.Router();

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

// Routes

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
}, registerOnlineApplicant);

router.get("/", getAllOnlineApplicants);
// Get one applicant by ID
router.get("/:id", getOnlineApplicantById);

// Application status management routes
router.put("/:id/shortlist", shortlistApplicant);
router.put("/:id/confirm", confirmApplicant);
router.put("/:id/reject", rejectApplicant);

// Delete applicant route
router.delete("/:id", deleteOnlineApplicant);

export default router;
