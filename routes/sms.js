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
router.get('/purchases/:schoolId', smsPurchaseController.getPurchaseHistory);

// List messages
router.get('/messages', smsController.listMessages);

module.exports = router;
