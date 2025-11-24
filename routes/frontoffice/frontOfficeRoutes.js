import express from "express";
import {
  getFrontOfficeStats,
  getEnquiryConversionFunnel,
  getVisitorReports,
  getComplaintSLAReports,
  getApplicationPipelineReports,
  exportFrontOfficeReport
} from "../../controllers/frontoffice/frontOfficeController.js";

const router = express.Router();

// Dashboard stats routes
router.get("/dashboard/stats", getFrontOfficeStats);
router.get("/dashboard/enquiry-conversion", getEnquiryConversionFunnel);
router.get("/dashboard/visitor-reports", getVisitorReports);
router.get("/dashboard/complaint-sla", getComplaintSLAReports);
router.get("/dashboard/application-pipeline", getApplicationPipelineReports);

// Alternative routes for frontend compatibility
router.get("/enquiries/conversion-funnel", getEnquiryConversionFunnel);
router.get("/visitors/reports", getVisitorReports);
router.get("/complaints/sla-reports", getComplaintSLAReports);
router.get("/applications/pipeline-reports", getApplicationPipelineReports);

// Export routes
router.get("/export/:reportType", exportFrontOfficeReport);

export default router;
