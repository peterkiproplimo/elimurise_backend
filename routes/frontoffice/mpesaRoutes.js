const express = require("express");
const {
  depositMoney,
  withdraw,
  transactionStatus,
  depositCallback,
  mpesaCallback,
  transactionTimeout,
  transactionResult,
  getTransactionStatus
} = require("../../controllers/frontoffice/mpesaController");

const router = express.Router();

/**
 * @route POST /api/mpesa/deposit
 * @desc Initiate M-Pesa STK push for deposit
 * @access Public (for registration)
 */
router.post("/deposit", depositMoney);

/**
 * @route POST /api/mpesa/withdraw
 * @desc Initiate M-Pesa B2C withdrawal
 * @access Private
 */
router.post("/withdraw", withdraw);

/**
 * @route POST /api/mpesa/transaction-status
 * @desc Query M-Pesa transaction status
 * @access Private
 */
router.post("/transaction-status", transactionStatus);

/**
 * @route POST /api/mpesa/callback
 * @desc M-Pesa STK push callback
 * @access Public (called by Safaricom)
 */
router.post("/callback", mpesaCallback);

/**
 * @route POST /api/mpesa/deposit-callback
 * @desc M-Pesa deposit confirmation callback
 * @access Public (called by Safaricom)
 */
router.post("/deposit-callback", depositCallback);

/**
 * @route POST /api/mpesa/transaction-timeout
 * @desc M-Pesa transaction timeout callback
 * @access Public (called by Safaricom)
 */
router.post("/transaction-timeout", transactionTimeout);

/**
 * @route POST /api/mpesa/transaction-result
 * @desc M-Pesa transaction result callback
 * @access Public (called by Safaricom)
 */
router.post("/transaction-result", transactionResult);

/**
 * @route GET /api/mpesa/transaction-status/:checkoutRequestID
 * @desc Get transaction status by CheckoutRequestID
 * @access Public
 */
router.get("/transaction-status/:checkoutRequestID", getTransactionStatus);

module.exports = router;
