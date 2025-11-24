const express = require('express');
const {
  getProjectEvidences,
  getProjectEvidence,
  createProjectEvidence,
  updateProjectEvidence,
  deleteProjectEvidence,
  addTeacherFeedback,
  getProjectEvidenceFeedback,
  migrateTeacherFeedback,
  toggleProjectEvidenceStatus
} = require('../../controllers/frontoffice/projectEvidenceController');

const router = express.Router();

// GET /api/project-evidences - Get all project evidences with filtering and pagination
router.get('/', getProjectEvidences);

// GET /api/project-evidences/:id - Get single project evidence
router.get('/:id', getProjectEvidence);

// POST /api/project-evidences - Create new project evidence (accepts JSON with Google Drive URL)
router.post('/', createProjectEvidence);

// PUT /api/project-evidences/:id - Update project evidence
router.put('/:id', updateProjectEvidence);

// DELETE /api/project-evidences/:id - Delete project evidence
router.delete('/:id', deleteProjectEvidence);

// GET /api/project-evidences/:id/feedback - Get all feedback for a project evidence
router.get('/:id/feedback', getProjectEvidenceFeedback);

// POST /api/project-evidences/:id/feedback - Add teacher feedback
router.post('/:id/feedback', addTeacherFeedback);

// PATCH /api/project-evidences/:id/toggle-status - Toggle project evidence status
router.patch('/:id/toggle-status', toggleProjectEvidenceStatus);

// POST /api/project-evidences/migrate-feedback - Migrate old teacherFeedback format to new array format
router.post('/migrate-feedback', migrateTeacherFeedback);

// Cloudinary-related routes removed

module.exports = router;
