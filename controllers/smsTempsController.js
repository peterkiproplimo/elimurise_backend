import axios from "axios";

/* =========================
   CONFIG
========================= */
const ONFON_BASE_URL = "https://api.onfonmedia.co.ke/v1/sms";
const API_KEY = "Kb1EhwPAozixY7aRn6p4tMkOXmUyWurS9G23eqs5F8B0IHgZ";
const CLIENT_ID = "ELIMURISE";

/* =========================
   GET TEMPLATES
   GET /api/sms/templates
========================= */
const TemplatesController = {


async getTemplates(req, res){
  try {
    const response = await axios.get(`${ONFON_BASE_URL}/Template`, {
      params: {
        ApiKey: API_KEY,
        ClientId: CLIENT_ID,
      },
    });

    return res.status(200).json(response.data);
  } catch (error) {
    console.error("Get templates error:", error?.response?.data || error);
    return res.status(500).json({
      message: "Failed to fetch templates",
      error: error?.response?.data || error.message,
    });
  }
},

/* =========================
   CREATE TEMPLATE
   POST /api/sms/templates
========================= */
async createTemplate (req, res){
  try {
    const { TemplateName, MessageTemplate } = req.body;

    if (!TemplateName || !MessageTemplate) {
      return res.status(400).json({
        message: "TemplateName and MessageTemplate are required",
      });
    }

    const payload = {
      TemplateName,
      MessageTemplate,
      ApiKey: API_KEY,
      ClientId: CLIENT_ID,
    };

    const response = await axios.post(
      `${ONFON_BASE_URL}/Template`,
      payload
    );

    return res.status(201).json(response.data);
  } catch (error) {
    console.error("Create template error:", error?.response?.data || error);
    return res.status(500).json({
      message: "Failed to create template",
      error: error?.response?.data || error.message,
    });
  }
},

/* =========================
   UPDATE TEMPLATE
   PUT /api/sms/templates/:id
========================= */
async updateTemplate(req, res){
  try {
    const { id } = req.params;
    const { TemplateName, MessageTemplate } = req.body;

    if (!TemplateName || !MessageTemplate) {
      return res.status(400).json({
        message: "TemplateName and MessageTemplate are required",
      });
    }

    const payload = {
      TemplateName,
      MessageTemplate,
      ApiKey: API_KEY,
      ClientId: CLIENT_ID,
    };

    const response = await axios.post(
      `${ONFON_BASE_URL}/${id}/Template`,
      payload
    );

    return res.status(200).json(response.data);
  } catch (error) {
    console.error("Update template error:", error?.response?.data || error);
    return res.status(500).json({
      message: "Failed to update template",
      error: error?.response?.data || error.message,
    });
  }
}

};

export default TemplatesController;