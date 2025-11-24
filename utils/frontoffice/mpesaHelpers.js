/**
 * M-Pesa Helper Utilities
 * Utility functions for M-Pesa API integration
 */

const MpesaTransactions = require("../../models/frontoffice/MpesaTransactions");
const Account = require("../../models/frontoffice/Account");
const Logs = require("../../models/frontoffice/Logs");

/**
 * Extract transaction metadata from Safaricom callback
 * @param {Object} callbackMetadata - Callback metadata from Safaricom
 * @returns {Object} Extracted transaction data
 */
const extractTransactionData = (callbackMetadata) => {
  const items = callbackMetadata?.Item || [];
  const data = {};
  
  items.forEach(item => {
    switch (item.Name) {
      case 'Amount':
        data.amount = item.Value;
        break;
      case 'MpesaReceiptNumber':
        data.mpesaReceiptNumber = item.Value;
        break;
      case 'TransactionDate':
        data.transactionDate = item.Value?.toString();
        break;
      case 'PhoneNumber':
        data.phoneNumber = item.Value?.toString();
        break;
      case 'Balance':
        data.balance = item.Value;
        break;
      default:
        data[item.Name] = item.Value;
    }
  });
  
  return data;
};

/**
 * Update user account balance
 * @param {string} userId - User ID
 * @param {number} amount - Amount to add to balance
 * @returns {Object} Updated account
 */
const updateAccountBalance = async (userId, amount) => {
  try {
    const account = await Account.findOne({ user: userId });
    
    if (!account) {
      throw new Error(`Account not found for user: ${userId}`);
    }
    
    const newBalance = parseFloat(account.balance) + parseFloat(amount);
    
    const updatedAccount = await Account.findOneAndUpdate(
      { user: userId },
      { 
        balance: newBalance, 
        lastTransaction: new Date() 
      },
      { new: true }
    );
    
    return updatedAccount;
  } catch (error) {
    console.error('Error updating account balance:', error);
    throw error;
  }
};

/**
 * Create transaction log
 * @param {Object} params - Log parameters
 * @returns {Object} Created log
 */
const createTransactionLog = async (params) => {
  try {
    const {
      userId,
      action,
      description,
      status = 'success',
      ip,
      metadata = {}
    } = params;
    
    const log = new Logs({
      ip: ip,
      description: description,
      user: userId,
      action: action,
      status: status,
      metadata: metadata
    });
    
    return await log.save();
  } catch (error) {
    console.error('Error creating transaction log:', error);
    throw error;
  }
};

/**
 * Update transaction status
 * @param {string} checkoutRequestID - Checkout request ID
 * @param {Object} updateData - Data to update
 * @returns {Object} Updated transaction
 */
const updateTransactionStatus = async (checkoutRequestID, updateData) => {
  try {
    return await MpesaTransactions.findOneAndUpdate(
      { CheckoutRequestID: checkoutRequestID },
      updateData,
      { new: true }
    );
  } catch (error) {
    console.error('Error updating transaction status:', error);
    throw error;
  }
};

/**
 * Process successful deposit callback
 * @param {Object} params - Callback parameters
 * @returns {Object} Processing result
 */
const processSuccessfulDeposit = async (params) => {
  try {
    const {
      checkoutRequestID,
      transactionData,
      userId,
      ip
    } = params;
    
    // Update transaction status
    const updatedTransaction = await updateTransactionStatus(checkoutRequestID, {
      status: 'completed',
      mpesaReceiptNumber: transactionData.mpesaReceiptNumber,
      transactionDate: transactionData.transactionDate,
      phone: transactionData.phoneNumber,
      amount: transactionData.amount,
      ResultDesc: 'Transaction completed successfully'
    });
    
    if (!updatedTransaction) {
      throw new Error(`Transaction not found: ${checkoutRequestID}`);
    }
    
    // Update account balance
    const updatedAccount = await updateAccountBalance(userId, transactionData.amount);
    
    // Create success log
    await createTransactionLog({
      userId: userId,
      action: 'deposit',
      description: `Deposit successful: ${transactionData.amount} from ${transactionData.phoneNumber}`,
      status: 'success',
      ip: ip,
      metadata: {
        mpesaReceiptNumber: transactionData.mpesaReceiptNumber,
        transactionDate: transactionData.transactionDate,
        checkoutRequestID: checkoutRequestID,
        newBalance: updatedAccount.balance
      }
    });
    
    return {
      success: true,
      transaction: updatedTransaction,
      account: updatedAccount,
      message: 'Deposit processed successfully'
    };
    
  } catch (error) {
    console.error('Error processing successful deposit:', error);
    throw error;
  }
};

/**
 * Process failed deposit callback
 * @param {Object} params - Callback parameters
 * @returns {Object} Processing result
 */
const processFailedDeposit = async (params) => {
  try {
    const {
      checkoutRequestID,
      errorMessage,
      userId,
      ip
    } = params;
    
    // Update transaction status
    const updatedTransaction = await updateTransactionStatus(checkoutRequestID, {
      status: 'failed',
      errorMessage: errorMessage,
      ResultDesc: errorMessage
    });
    
    // Create failure log
    await createTransactionLog({
      userId: userId,
      action: 'deposit',
      description: `Deposit failed: ${errorMessage}`,
      status: 'failed',
      ip: ip,
      metadata: {
        checkoutRequestID: checkoutRequestID,
        errorMessage: errorMessage
      }
    });
    
    return {
      success: false,
      transaction: updatedTransaction,
      message: 'Deposit failed'
    };
    
  } catch (error) {
    console.error('Error processing failed deposit:', error);
    throw error;
  }
};

/**
 * Validate callback data
 * @param {Object} callbackData - Callback data from Safaricom
 * @returns {Object} Validation result
 */
const validateCallbackData = (callbackData) => {
  try {
    if (!callbackData || !callbackData.Body || !callbackData.Body.stkCallback) {
      return {
        valid: false,
        error: 'Invalid callback data structure'
      };
    }
    
    const { stkCallback } = callbackData.Body;
    
    if (typeof stkCallback.ResultCode !== 'number') {
      return {
        valid: false,
        error: 'Invalid ResultCode'
      };
    }
    
    if (!stkCallback.CheckoutRequestID) {
      return {
        valid: false,
        error: 'Missing CheckoutRequestID'
      };
    }
    
    return {
      valid: true,
      data: stkCallback
    };
    
  } catch (error) {
    return {
      valid: false,
      error: error.message
    };
  }
};

/**
 * Format phone number for M-Pesa
 * @param {string} phoneNumber - Phone number to format
 * @returns {string} Formatted phone number
 */
const formatPhoneNumber = (phoneNumber) => {
  // Remove any spaces and non-numeric characters
  const cleaned = phoneNumber.replace(/\D/g, "");
  
  // Check if already in correct format (254XXXXXXXXX)
  if (/^254\d{9}$/.test(cleaned)) {
    return cleaned;
  }
  
  // Convert from 07XXXXXXXX to 254XXXXXXXXX
  if (/^0\d{9}$/.test(cleaned)) {
    return "254" + cleaned.slice(1);
  }
  
  // Handle invalid format
  throw new Error("Invalid phone number format");
};

module.exports = {
  extractTransactionData,
  updateAccountBalance,
  createTransactionLog,
  updateTransactionStatus,
  processSuccessfulDeposit,
  processFailedDeposit,
  validateCallbackData,
  formatPhoneNumber
};
