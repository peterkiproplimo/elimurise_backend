const express = require("express");
const {
  createCohort,
  getAllCohorts,
  getCohortById,
  getCohortByToken,
  updateCohort,
  deleteCohort,
  getCohortApplications
} = require("../../controllers/frontoffice/cohortController");

const router = express.Router();

// Cohort routes
router.post('/', createCohort);
router.get('/', getAllCohorts);
router.get('/token/:token', getCohortByToken);
router.get('/:id', getCohortById);
router.put('/:id', updateCohort);
router.delete('/:id', deleteCohort);
router.get('/:id/applications', getCohortApplications);

module.exports = router;
