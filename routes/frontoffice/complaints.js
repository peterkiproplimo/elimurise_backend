import express from "express";

import {
  createReport,
  getAllReports,
  getReportById,
  updateReport,
  deleteReport,
  addComplaintReply,
  updateReportStatus,
  getComplaintReplies,
  updateReportAssignment
} from "../../controllers/frontoffice/complaintsController.js";

const router = express.Router();

// Routes


router.post('/', createReport);
router.get('/', getAllReports);
router.get('/:id', getReportById);
router.put('/:id', updateReport);
router.delete('/:id', deleteReport);


router.post("/:id/replies", addComplaintReply);
router.get("/:id/replies", getComplaintReplies);
router.put("/:id/status", updateReportStatus);
router.put("/:id/assign", updateReportAssignment);




export default router;
