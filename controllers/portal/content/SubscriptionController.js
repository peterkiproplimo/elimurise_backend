const express = require('express');
const router = express.Router();
const SubscriptionService = require('../../../services/portal/Subscription');

router.get('/invoices', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1; // Default to page 1
    const limit = parseInt(req.query.limit) || 10; // Default to 10 records per page

    const schoolId = req.school; // Get the schoolId from URL parameters
    // Fetch paginated invoices using the service function
    const paginatedInvoices = await SubscriptionService.getPaginatedInvoicesBySchool(schoolId, page, limit);

    res.status(200).json({...paginatedInvoices});
  } catch (error) {
    res.status(404).json({message: error.message});
  }
});
module.exports = router;
