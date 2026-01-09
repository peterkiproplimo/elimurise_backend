const express = require('express');
const router = express.Router();
const smsController = require('../controllers/smsController');
const smsPurchaseController = require('../controllers/smsPurchaseController');

// Public: Send SMS (school clients) - should be protected in production
router.post('/send', smsController.sendSMS);

// Provider webhook to update delivery reports
router.post('/webhook', smsController.webhook);

// Wallet endpoints
router.get('/wallet/:schoolId', smsController.getWallet);
router.post('/wallet/topup', smsController.topUpWallet);

// SMS Purchase endpoints
router.post('/purchase', smsPurchaseController.purchaseSMS);
router.post('/purchase-callback', smsPurchaseController.purchaseCallback);
router.get('/purchase/:purchaseId', smsPurchaseController.getPurchaseStatus);
router.get('/purchase-by-checkout/:checkoutRequestID', smsPurchaseController.getPurchaseByCheckout);
router.get('/purchases/:schoolId', smsPurchaseController.getPurchaseHistory);

// List messages
router.get('/messages', smsController.listMessages);

// Get recipient groups (parents, students, staff) with phone numbers
router.get('/recipient-groups/:schoolId', smsController.getRecipientGroups);

module.exports = router;
