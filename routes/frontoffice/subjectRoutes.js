const express = require("express");
const {
  getSubjects,
  getSubject,
  createSubject,
  updateSubject,
  deleteSubject,
  getSubjectsByCategory,
  getSubjectsByLevel,
  toggleSubjectStatus
} = require("../../controllers/frontoffice/subjectController");

const router = express.Router();

// Subject routes
router.get("/", getSubjects);
router.get("/:id", getSubject);
router.post("/", createSubject);
router.put("/:id", updateSubject);
router.delete("/:id", deleteSubject);
router.patch("/:id/toggle-status", toggleSubjectStatus);

// Filtered routes
router.get("/category/:category", getSubjectsByCategory);
router.get("/level/:level", getSubjectsByLevel);

module.exports = router;
