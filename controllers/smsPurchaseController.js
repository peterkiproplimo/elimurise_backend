require("dotenv").config();
const axios = require("axios");
const SmsWallet = require('../models/smsWallet');
const SmsPurchase = require('../models/smsPurchase');
const formatDate = require('../utils/frontoffice/formatDate');
const { formatPhoneNumber } = require('../utils/frontoffice/mpesaHelpers');

const SMS_UNIT_PRICE = 1.2; // Schools pay 1.2 KSH per SMS token
const ONFON_PRICE = 1.0; // OnfonMedia charges 1 KSH per SMS

/**
 * @desc Initiate M-Pesa STK push for SMS purchase
 * @route POST /api/sms/purchase
 * @access Public
 */
async function purchaseSMS(req, res) {
  try {
    const { schoolId, phone, tokens } = req.body;

    if (!schoolId || !phone || !tokens || tokens <= 0) {
      return res.status(400).json({ 
        message: 'Missing required fields: schoolId, phone, and tokens (must be > 0)' 
      });
    }

    // Calculate amount (1.2 KSH per token)
    const amount = Math.ceil(tokens * SMS_UNIT_PRICE);

    let phoneNumber;
    try {
      phoneNumber = formatPhoneNumber(phone);
    } catch (error) {
      return res.status(400).json({ message: "Invalid phone number format" });
    }

    // Create purchase record
    const purchase = await SmsPurchase.create({
      schoolId,
      tokens,
      amount,
      unitPrice: SMS_UNIT_PRICE,
      phone: phoneNumber,
      status: 'pending',
    });

    // MPESA credentials
    const consumer_key = process.env.MPESA_CONSUMER_KEY || "GJmk0oWoLPUqFCeJqKiHzGojZK8EdJyeZn6feiGge2yx02pi";
    const consumer_secret = process.env.MPESA_CONSUMER_SECRET || "neJK0ula6Gcw0lH3MDjpsrPNibJEiv5t2XJBNgcoGPuuFOP1YNVGmflMTFAMUA6L";
    const url = process.env.MPESA_AUTH_URL || "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials";

    const authString = `${consumer_key}:${consumer_secret}`;
    const buffer = Buffer.from(authString, "utf-8");
    const auth = buffer.toString("base64");

    const { data } = await axios.get(url, {
      headers: { Authorization: "Basic " + auth },
    });

    if (data.access_token) {
      const timestamp = formatDate();
      const shortcode = process.env.MPESA_SHORTCODE || 174379;
      const passkey = process.env.MPESA_PASSKEY || "bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919";
      const password = Buffer.from(shortcode + passkey + timestamp).toString("base64");

      const stkPushData = {
        BusinessShortCode: shortcode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: "CustomerPayBillOnline",
        Amount: amount,
        PartyA: phoneNumber,
        PartyB: shortcode,
        PhoneNumber: phoneNumber,
        CallBackURL: `${process.env.BASE_URL || 'http://localhost:5001'}/api/sms/purchase-callback`,
        AccountReference: `SMS-${schoolId}-${purchase._id}`,
        TransactionDesc: `Purchase ${tokens} SMS tokens`,
      };

      const stkResponse = await axios.post(
        process.env.MPESA_STK_URL || "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest",
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
        // Update purchase with checkout request ID
        purchase.checkoutRequestID = stkResponse.data.CheckoutRequestID;
        await purchase.save();

        res.status(200).json({
          message: "STK push initiated successfully",
          data: {
            purchaseId: purchase._id,
            tokens,
            amount,
            phone: phoneNumber,
          },
          checkoutRequestID: stkResponse.data.CheckoutRequestID,
        });
      } else {
        purchase.status = 'failed';
        await purchase.save();
        
        res.status(400).json({
          message: "Failed to initiate STK push",
          error: stkResponse.data,
        });
      }
    } else {
      res.status(500).json({ message: "Failed to get MPESA access token" });
    }
  } catch (error) {
    console.error("SMS Purchase error:", error);
    res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
}

/**
 * @desc MPESA callback for SMS purchase
 * @route POST /api/sms/purchase-callback
 * @access Public
 */
async function purchaseCallback(req, res) {
  try {
    const { Body } = req.body;
    
    if (!Body || !Body.stkCallback) {
      return res.status(400).json({ message: "Invalid callback data" });
    }

    const stkCallback = Body.stkCallback;
    const { CheckoutRequestID } = stkCallback;

    // Find purchase record
    const purchase = await SmsPurchase.findOne({ checkoutRequestID: CheckoutRequestID });

    if (!purchase) {
      console.error("Purchase not found:", CheckoutRequestID);
      return res.status(404).json({ message: "Purchase not found" });
    }

    if (stkCallback.ResultCode === 0) {
      // Transaction successful
      const callbackMetadata = stkCallback.CallbackMetadata;
      const items = callbackMetadata?.Item || [];
      
      let mpesaReceiptNumber = null;
      let transactionDate = null;
      let amount = null;

      items.forEach(item => {
        if (item.Name === 'MpesaReceiptNumber') {
          mpesaReceiptNumber = item.Value;
        } else if (item.Name === 'TransactionDate') {
          transactionDate = item.Value?.toString();
        } else if (item.Name === 'Amount') {
          amount = item.Value;
        }
      });

      // Update purchase record
      purchase.status = 'completed';
      purchase.mpesaTransactionId = mpesaReceiptNumber;
      purchase.transactionDate = transactionDate;
      await purchase.save();

      // Update or create wallet
      let wallet = await SmsWallet.findOne({ schoolId: purchase.schoolId });
      if (!wallet) {
        wallet = await SmsWallet.create({ 
          schoolId: purchase.schoolId, 
          balance: purchase.tokens 
        });
      } else {
        wallet.balance = (wallet.balance || 0) + purchase.tokens;
        await wallet.save();
      }

      console.log(`SMS Purchase completed: ${purchase.tokens} tokens added to school ${purchase.schoolId}`);

      res.status(200).json({
        message: "Purchase callback processed successfully",
        purchaseId: purchase._id,
        tokens: purchase.tokens,
        receiptNumber: mpesaReceiptNumber,
      });
    } else {
      // Transaction failed
      purchase.status = 'failed';
      purchase.errorMessage = stkCallback.ResultDesc;
      await purchase.save();

      console.log("SMS Purchase failed:", stkCallback.ResultDesc);
      res.status(200).json({
        message: "Purchase callback received (failed transaction)",
      });
    }
  } catch (error) {
    console.error("Purchase callback error:", error);
    res.status(500).json({
      message: "Purchase callback processing failed",
      error: error.message,
    });
  }
}

/**
 * @desc Get purchase status
 * @route GET /api/sms/purchase/:purchaseId
 * @access Public
 */
async function getPurchaseStatus(req, res) {
  try {
    const { purchaseId } = req.params;

    const purchase = await SmsPurchase.findById(purchaseId);

    if (!purchase) {
      return res.status(404).json({ message: "Purchase not found" });
    }

    res.status(200).json({
      message: "Purchase found",
      data: purchase,
    });
  } catch (error) {
    console.error("Get purchase status error:", error);
    res.status(500).json({
      message: "Failed to get purchase status",
      error: error.message,
    });
  }
}

/**
 * @desc Get purchase history for a school
 * @route GET /api/sms/purchases/:schoolId
 * @access Public
 */
async function getPurchaseHistory(req, res) {
  try {
    const { schoolId } = req.params;

    const purchases = await SmsPurchase.find({ schoolId })
      .sort({ createdAt: -1 })
      .limit(50);

    res.status(200).json({
      message: "Purchase history retrieved",
      data: purchases,
    });
  } catch (error) {
    console.error("Get purchase history error:", error);
    res.status(500).json({
      message: "Failed to get purchase history",
      error: error.message,
    });
  }
}

module.exports = {
  purchaseSMS,
  purchaseCallback,
  getPurchaseStatus,
  getPurchaseHistory,
};

