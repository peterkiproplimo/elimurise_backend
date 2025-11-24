const express = require("express");
const {
  getCompetencies,
  getCompetency,
  createCompetency,
  updateCompetency,
  deleteCompetency,
  getCompetenciesByCategory,
  getCompetenciesByLevel,
  getCompetenciesBySubject,
  toggleCompetencyStatus,
  getCompetencyStats
} = require("../../controllers/frontoffice/competencyController");

const router = express.Router();

// Competency routes
router.get("/", getCompetencies);
router.get("/stats", getCompetencyStats);
router.get("/:id", getCompetency);
router.post("/", createCompetency);
router.put("/:id", updateCompetency);
router.delete("/:id", deleteCompetency);
router.patch("/:id/toggle-status", toggleCompetencyStatus);

// Filtered routes
router.get("/category/:category", getCompetenciesByCategory);
router.get("/level/:level", getCompetenciesByLevel);
router.get("/subject/:subjectId", getCompetenciesBySubject);

module.exports = router;
