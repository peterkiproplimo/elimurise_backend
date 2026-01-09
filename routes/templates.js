import express from "express";
import TemplatesController from "../controllers/smsTempsController.js";

const router = express.Router();

// Routes
router.get("/sms/templates", TemplatesController.getTemplates);
router.post("/sms/templates", TemplatesController.createTemplate);
router.put("/sms/templates/:id", TemplatesController.updateTemplate);

export default router;
