require("dotenv").config();
const axios = require("axios");

const formatDate = require("../../utils/frontoffice/formatDate");

// Importing mongoose models
const Account = require("../../models/frontoffice/Account");
const MpesaTransactions = require("../../models/frontoffice/MpesaTransactions");
const Logs = require("../../models/frontoffice/Logs");
const Player = require("../../models/frontoffice/Player");
const {
  extractTransactionData,
  processSuccessfulDeposit,
  processFailedDeposit,
  validateCallbackData,
  formatPhoneNumber
} = require("../../utils/frontoffice/mpesaHelpers");


/**
 * @desc Initiate M-Pesa STK push for deposit (pre-registration)
 * @route POST /api/mpesa/deposit
 * @access Public
 */
const depositMoney = async (req, res) => {
  try {
    const { phone, amount } = req.body;

    let phoneNumber;
    try {
      phoneNumber = formatPhoneNumber(phone);
    } catch (error) {
      return res.status(400).json({ message: "Invalid phone number format" });
    }

      const consumer_key = "GJmk0oWoLPUqFCeJqKiHzGojZK8EdJyeZn6feiGge2yx02pi";
      const consumer_secret = "neJK0ula6Gcw0lH3MDjpsrPNibJEiv5t2XJBNgcoGPuuFOP1YNVGmflMTFAMUA6L";
      // https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials
    // const url = "https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials";
    
      const url = "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials";
    

      const authString = `${consumer_key}:${consumer_secret}`;
      const buffer = Buffer.from(authString, "utf-8");
      const auth = buffer.toString("base64");

      const { data } = await axios.get(url, {
      headers: { Authorization: "Basic " + auth },
      });

      if (data.access_token) {
        const timestamp = formatDate();
        const shortcode = 174379;
        const passkey = "bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919";
        const password = Buffer.from(shortcode + passkey + timestamp).toString("base64");

      const stkPushData = {
        BusinessShortCode: shortcode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: "CustomerPayBillOnline",
        Amount: parseInt(amount),
        PartyA: phoneNumber,
        PartyB: shortcode,
        PhoneNumber: phoneNumber,
        CallBackURL: `https://frontoffice-t61e.onrender.com/mpesa/deposit-callback`,
        AccountReference: phoneNumber,
        TransactionDesc: "Deposit to School Account",
      };

      // "https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest"
      const stkResponse = await axios.post(
        "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest",
        stkPushData,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${data.access_token}`,
            Host: "sandbox.safaricom.co.ke",
          },
        }
      );

      if (stkResponse.data.ResponseCode === "0") {
        // Save transaction record
        const transaction = new MpesaTransactions({
          type: "1", // Deposit type
          MerchantRequestID: stkResponse.data.MerchantRequestID,
          CheckoutRequestID: stkResponse.data.CheckoutRequestID,
          trans_time: timestamp,
          amount: amount,
          phone: phone,
        });
        await transaction.save();

        res.status(200).json({
          message: "STK push initiated successfully",
          data: {
            registration: true,
            phone: phone,
            amount: amount
          },
          checkoutRequestID: stkResponse.data.CheckoutRequestID,
        });
      } else {
        res.status(400).json({
          message: "Failed to initiate STK push",
          error: stkResponse.data,
        });
      }
    } else {
      res.status(500).json({ message: "Failed to get access token" });
    }
  } catch (error) {
    console.error("Deposit error:", error);
    res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
};

/**
 * @desc Initiate M-Pesa B2C withdrawal
 * @route POST /api/mpesa/withdraw
 * @access Private
 */
const withdraw = async (req, res) => {
  try {
    const { phone, amount, userId } = req.body;
    const currentUser = req.user;

    if (!currentUser) {
      return res.status(401).json({ message: "Unauthorized: Missing token" });
    }

    const account = await Account.findOne({ user: req.user.userId });

    if (parseFloat(amount) > parseFloat(account.balance)) {
      return res.status(400).json({ message: "Insufficient balance in your wallet" });
    }

    const ipAddress = req.socket.remoteAddress;

      const consumer_key = process.env.B2C_KEY;
      const consumer_secret = process.env.B2C_SECRET;
    const url = "https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials";
      const authString = `${consumer_key}:${consumer_secret}`;
      const buffer = Buffer.from(authString, "utf-8");
      const auth = buffer.toString("base64");

      const { data } = await axios.get(url, {
      headers: { Authorization: "Basic " + auth },
      });

      if (data.access_token) {
        const timestamp = formatDate();
        const shortcode = process.env.B2C_SHORTCODE;
        const passkey = process.env.B2C_PASSKEY;

      const b2cData = {
        InitiatorName: "KARIUKI",
        SecurityCredential: passkey,
        CommandID: "BusinessPayment",
        Amount: parseInt(amount),
        PartyA: shortcode,
        PartyB: parseInt(phone),
        Remarks: `Customer Withdrawal`,
        QueueTimeOutURL: `https://frontoffice-t61e.onrender.com/mpesa/transaction-timeout`,
        ResultURL: `https://frontoffice-t61e.onrender.com/mpesa/transaction-result`,
        Occassion: `Customer Withdrawal`,
      };

      const b2cResponse = await axios.post(
        "https://api.safaricom.co.ke/mpesa/b2c/v1/paymentrequest",
        b2cData,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + data.access_token,
            Host: "api.safaricom.co.ke",
          },
        }
      );

      if (b2cResponse.data.ResponseCode === "0") {
        // Update account balance
        const filter = { user: userId || currentUser.userId };
        const update = {
          balance: parseFloat(account?.balance) - parseFloat(amount),
            };
            await Account.findOneAndUpdate(filter, update);

        // Save transaction record
        const transaction = new MpesaTransactions({
          type: "2", // Withdrawal type
          OriginatorConversationID: b2cResponse.data.OriginatorConversationID,
          ConversationID: b2cResponse.data.ConversationID,
              trans_time: timestamp,
          amount: parseInt(amount),
          phone: phone,
          user: userId || currentUser.userId,
          account: account?._id,
        });
        await transaction.save();

        // Save log
            const log = new Logs({
              ip: ipAddress,
          description: `Withdrawn ${amount} - Account Name:${phone}`,
          user: userId || currentUser.userId,
          action: 'withdrawal',
          status: 'success'
            });
            await log.save();

        res.status(200).json({
          message: "Withdrawal initiated successfully",
          data: b2cResponse.data,
        });
      } else {
        res.status(400).json({
          message: "Failed to initiate withdrawal",
          error: b2cResponse.data,
        });
      }
    } else {
      res.status(500).json({ message: "Failed to get access token" });
    }
  } catch (error) {
    console.error("Withdrawal error:", error);
    res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
};

/**
 * @desc Query M-Pesa transaction status
 * @route POST /api/mpesa/transaction-status
 * @access Private
 */
const transactionStatus = async (req, res) => {
  try {
    const { transactionId } = req.body;

      const consumer_key = "FH9hAhMJLPK4bmgfwRA4X5rmDw6bAcFS";
      const consumer_secret = "Acug9RyTeMxgGWQt";
      const url = "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials";
      const auth = Buffer.from(`${consumer_key}:${consumer_secret}`).toString("base64");

      const { data } = await axios.get(url, {
      headers: { Authorization: "Bearer " + auth },
      });

      if (data.access_token) {
        const timestamp = formatDate();
        const shortcode = 600995;
      const passkey = "bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919";
      const password = Buffer.from(shortcode + passkey + timestamp).toString("base64");

      const statusData = {
        Initiator: "SAFARIBUST",
        SecurityCredential: password,
        CommandID: "TransactionStatusQuery",
        TransactionID: transactionId,
        PartyA: shortcode,
        IdentifierType: "4",
        ResultURL: `${process.env.BASE_URL}/api/mpesa/transaction-status-result`,
        QueueTimeOutURL: `${process.env.BASE_URL}/api/mpesa/transaction-status-timeout`,
        Remarks: "Transaction status query",
        Occassion: "Status check",
      };

      const statusResponse = await axios.post(
        "https://sandbox.safaricom.co.ke/mpesa/transactionstatus/v1/query",
        statusData,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + data.access_token,
          },
        }
      );

      res.status(200).json({
        message: "Transaction status query initiated",
        data: statusResponse.data,
      });
    } else {
      res.status(500).json({ message: "Failed to get access token" });
    }
  } catch (error) {
    console.error("Transaction status error:", error);
    res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
};

/**
 * @desc M-Pesa deposit confirmation callback
 * @route POST /api/mpesa/deposit-callback
 * @access Public
 */
const depositCallback = async (req, res) => {
  try {
    // Validate callback data
    const validation = validateCallbackData(req.body);
    if (!validation.valid) {
      console.error("Invalid callback data:", validation.error);
      return res.status(400).json({ 
        message: "Invalid callback data",
        error: validation.error 
      });
    }

    const stkCallback = validation.data;
    console.log("Deposit callback received:", JSON.stringify(stkCallback));

    const { CheckoutRequestID } = stkCallback;
    const ip = req.ip || req.connection.remoteAddress;

    if (stkCallback.ResultCode === 0) {
      // Transaction successful
      const transactionData = extractTransactionData(stkCallback.CallbackMetadata);
      
      // Find and update the transaction with receipt details
      const transaction = await MpesaTransactions.findOneAndUpdate(
        { CheckoutRequestID },
        {
          status: 'completed',
          mpesaReceiptNumber: transactionData.receiptNumber,
          transactionDate: transactionData.transactionDate,
          phoneNumber: transactionData.phoneNumber,
          amount: transactionData.amount
        },
        { new: true }
      );
      
      if (!transaction) {
        console.error("Transaction not found:", CheckoutRequestID);
        return res.status(404).json({ message: "Transaction not found" });
      }

      // Process successful deposit (if helper function exists and user is available)
      try {
        if (transaction.user) {
          const result = await processSuccessfulDeposit({
            checkoutRequestID: CheckoutRequestID,
            transactionData: transactionData,
            userId: transaction.user,
            ip: ip
          });
          console.log("Deposit processed successfully:", result.message);
        } else {
          console.log("Pre-registration deposit completed - no user account to update");
        }
      } catch (error) {
        console.log("ProcessSuccessfulDeposit not available, transaction saved directly");
      }

      // Emit real-time update via WebSocket if available
      try {
        const io = req.app.get('io');
        if (io) {
          io.emit('payment_update', {
            checkoutRequestID: CheckoutRequestID,
            status: 'completed',
            receiptNumber: transactionData.receiptNumber,
            amount: transactionData.amount,
            phone: transaction.phone
          });
        }
      } catch (error) {
        console.log('WebSocket not available:', error.message);
      }

      res.status(200).json({ 
        message: "Deposit callback processed successfully",
        transactionId: CheckoutRequestID,
        receiptNumber: transactionData.receiptNumber,
        amount: transactionData.amount
      });
      
    } else {
      // Transaction failed
      const transaction = await MpesaTransactions.findOne({ CheckoutRequestID });
      
      if (transaction) {
        await processFailedDeposit({
          checkoutRequestID: CheckoutRequestID,
          errorMessage: stkCallback.ResultDesc,
          userId: transaction.user,
          ip: ip
        });
      }

      console.log("Deposit failed:", stkCallback.ResultDesc);
      res.status(200).json({ 
        message: "Deposit callback received (failed transaction)" 
      });
    }

  } catch (error) {
    console.error("Deposit callback error:", error);
    res.status(500).json({ 
      message: "Deposit callback processing failed",
      error: error.message 
    });
  }
};

/**
 * @desc M-Pesa STK push callback (general)
 * @route POST /api/mpesa/callback
 * @access Public
 */
const mpesaCallback = async (req, res) => {
  try {
    const { Body } = req.body;
    const { stkCallback } = Body;

    if (stkCallback.ResultCode === 0) {
      // Transaction successful
      const { CheckoutRequestID, MerchantRequestID } = stkCallback;
      
      // Update transaction status
      await MpesaTransactions.findOneAndUpdate(
        { CheckoutRequestID },
        { 
          status: 'completed',
          mpesaReceiptNumber: stkCallback.CallbackMetadata?.Item?.[0]?.Value,
          transactionDate: stkCallback.CallbackMetadata?.Item?.[2]?.Value,
          phoneNumber: stkCallback.CallbackMetadata?.Item?.[3]?.Value,
          amount: stkCallback.CallbackMetadata?.Item?.[0]?.Value
        }
      );

      console.log("STK Push successful:", stkCallback);
    } else {
      // Transaction failed
      const { CheckoutRequestID } = stkCallback;
      
      await MpesaTransactions.findOneAndUpdate(
        { CheckoutRequestID },
        { 
          status: 'failed',
          errorMessage: stkCallback.ResultDesc
        }
      );

      console.log("STK Push failed:", stkCallback);
    }

    res.status(200).json({ message: "Callback received successfully" });
  } catch (error) {
    console.error("Callback error:", error);
    res.status(500).json({ message: "Callback processing failed" });
  }
};

/**
 * @desc M-Pesa transaction timeout callback
 * @route POST /api/mpesa/transaction-timeout
 * @access Public
 */
const transactionTimeout = async (req, res) => {
  try {
    console.log("Transaction timeout:", req.body);
    res.status(200).json({ message: "Timeout callback received" });
  } catch (error) {
    console.error("Timeout callback error:", error);
    res.status(500).json({ message: "Timeout callback processing failed" });
  }
};

/**
 * @desc M-Pesa transaction result callback
 * @route POST /api/mpesa/transaction-result
 * @access Public
 */
const transactionResult = async (req, res) => {
  try {
    console.log("Transaction result:", req.body);
    res.status(200).json({ message: "Result callback received" });
  } catch (error) {
    console.error("Result callback error:", error);
    res.status(500).json({ message: "Result callback processing failed" });
  }
};

/**
 * @desc Check transaction status by CheckoutRequestID
 * @route GET /api/mpesa/transaction-status/:checkoutRequestID
 * @access Public
 */
const getTransactionStatus = async (req, res) => {
  try {
    const { checkoutRequestID } = req.params;

    if (!checkoutRequestID) {
      return res.status(400).json({ message: "CheckoutRequestID is required" });
    }

    // Find the transaction
    const transaction = await MpesaTransactions.findOne({ CheckoutRequestID: checkoutRequestID });

    if (!transaction) {
      return res.status(404).json({ message: "Transaction not found" });
    }

    // Return transaction details including receipt number if completed
    res.status(200).json({
      message: "Transaction found",
      data: {
        checkoutRequestID: transaction.CheckoutRequestID,
        status: transaction.status,
        amount: transaction.amount,
        phone: transaction.phone,
        mpesaReceiptNumber: transaction.mpesaReceiptNumber,
        transactionDate: transaction.transactionDate,
        createdAt: transaction.createdAt,
        updatedAt: transaction.updatedAt
      }
    });

  } catch (error) {
    console.error("Get transaction status error:", error);
    res.status(500).json({
      message: "Failed to get transaction status",
      error: error.message
    });
  }
};

module.exports = {
  depositMoney,
  withdraw,
  transactionStatus,
  depositCallback,
  mpesaCallback,
  transactionTimeout,
  transactionResult,
  getTransactionStatus
};
