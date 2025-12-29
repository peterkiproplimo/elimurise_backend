const SmsWallet = require('../models/smsWallet');
const SmsMessage = require('../models/smsMessage');
const SmsRecipient = require('../models/smsRecipient');
const SmsTransaction = require('../models/smsTransaction');
const SmsDeliveryLog = require('../models/smsDeliveryLog');
const onfon = require('../services/onfonmediaService');

// POST /api/sms/send
async function sendSMS(req, res) {
  try {
    const { schoolId, senderId, body, recipients, isUnicode, isFlash, scheduleDateTime } = req.body;

    if (!schoolId || !body || !recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Check wallet balance (deduct from database tokens)
    const tokensNeeded = recipients.length;
    let wallet = await SmsWallet.findOne({ schoolId });
    
    if (!wallet) {
      wallet = await SmsWallet.create({ schoolId, balance: 0 });
    }

    if (wallet.balance < tokensNeeded) {
      return res.status(402).json({ 
        message: `Insufficient SMS tokens. You have ${wallet.balance} tokens but need ${tokensNeeded}. Please purchase more tokens.`,
        balance: wallet.balance,
        required: tokensNeeded
      });
    }

    // Create message record
    const message = await SmsMessage.create({ schoolId, senderId, body, status: 'pending' });

    // Create recipient records
    const recipientDocs = await Promise.all(recipients.map((phone) => SmsRecipient.create({ messageId: message._id, phone })));

    // Call provider
    const providerPayload = recipients.map((phone) => ({ to: phone, message: body }));
    const providerResp = await onfon.sendBulkSMS({
      sender: senderId,
      messages: providerPayload,
      isUnicode,
      isFlash,
      scheduleDateTime,
    });

    // Attempt to capture provider message ids if present
    if (!providerResp.error && providerResp.Messages) {
      // providerResp.Messages assumed array matching recipients
      for (let i = 0; i < providerResp.Messages.length; i++) {
        const p = providerResp.Messages[i];
        const recip = recipientDocs[i];
        if (p && recip) {
          recip.providerMessageId = p.MessageId || p.messageId || p.id;
          recip.status = p.Status && p.Status.toLowerCase().includes('deliv') ? 'delivered' : recip.status;
          await recip.save();
          await SmsDeliveryLog.create({ recipientId: recip._id, providerMessageId: recip.providerMessageId, status: recip.status, providerResponse: p });
        }
      }
    }

    // Deduct tokens from wallet
    wallet.balance = wallet.balance - tokensNeeded;
    await wallet.save();

    // Record transaction
    await SmsTransaction.create({ 
      walletId: wallet._id, 
      type: 'debit', 
      amount: tokensNeeded, 
      reference: providerResp.requestId || null 
    });

    message.status = 'sent';
    message.providerMessageId = providerResp.requestId || null;
    await message.save();

    return res.json({ 
      message: 'SMS queued', 
      providerResp,
      remainingTokens: wallet.balance
    });
  } catch (err) {
    console.error('sendSMS error', err);
    return res.status(500).json({ message: 'Internal server error', error: err.message });
  }
}


async function sendSMSOne(req, res) {
  try {
    const { schoolId, senderId, body, recipients, isUnicode, isFlash, scheduleDateTime } = req.body;

    if (!schoolId || !body || !recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Ensure wallet exists
    let wallet = await SmsWallet.findOne({ schoolId });
    if (!wallet) {
      wallet = await SmsWallet.create({ schoolId, balance: 0 });
    }

    // Simple cost: 1 unit per recipient (can be changed)
    const costPerRecipient = 1;
    const totalCost = costPerRecipient * recipients.length;

    if (wallet.balance < totalCost) {
      return res.status(402).json({ message: 'Insufficient SMS balance' });
    }

    // Create message record
    const message = await SmsMessage.create({ schoolId, senderId, body, status: 'pending' });

    // Create recipient records
    const recipientDocs = await Promise.all(recipients.map((phone) => SmsRecipient.create({ messageId: message._id, phone })));

    // Call provider
    const providerPayload = recipients.map((phone) => ({ to: phone, message: body }));
    const providerResp = await onfon.sendBulkSMS({
      sender: senderId,
      messages: providerPayload,
      isUnicode,
      isFlash,
      scheduleDateTime,
    });

    // Attempt to capture provider message ids if present
    if (!providerResp.error && providerResp.Messages) {
      // providerResp.Messages assumed array matching recipients
      for (let i = 0; i < providerResp.Messages.length; i++) {
        const p = providerResp.Messages[i];
        const recip = recipientDocs[i];
        if (p && recip) {
          recip.providerMessageId = p.MessageId || p.messageId || p.id;
          recip.status = p.Status && p.Status.toLowerCase().includes('deliv') ? 'delivered' : recip.status;
          await recip.save();
          await SmsDeliveryLog.create({ recipientId: recip._id, providerMessageId: recip.providerMessageId, status: recip.status, providerResponse: p });
        }
      }
    }

    // Deduct cost and record transaction
    wallet.balance = (wallet.balance || 0) - totalCost;
    await wallet.save();
    await SmsTransaction.create({ walletId: wallet._id, type: 'debit', amount: totalCost, reference: providerResp.requestId || null });

    message.status = 'sent';
    message.providerMessageId = providerResp.requestId || null;
    await message.save();

    return res.json({ message: 'SMS queued', providerResp });
  } catch (err) {
    console.error('sendSMS error', err);
    return res.status(500).json({ message: 'Internal server error', error: err.message });
  }
}
// POST /api/sms/webhook
async function webhook(req, res) {
  // Provider should POST delivery statuses here
  try {
    const data = req.body;
    // Example handling: provider sends array of statuses
    if (Array.isArray(data)) {
      for (const item of data) {
        // item should contain MessageId and Status and Mobile
        const providerMessageId = item.MessageId || item.messageId || item.id;
        const status = item.Status || item.status;
        const mobile = item.Mobile || item.mobile;
        const recip = await SmsRecipient.findOne({ providerMessageId });
        if (recip) {
          recip.status = (status || '').toLowerCase().includes('deliv') ? 'delivered' : ((status || '').toLowerCase().includes('fail') ? 'failed' : 'pending');
          await recip.save();
          await SmsDeliveryLog.create({ recipientId: recip._id, providerMessageId, status, providerResponse: item });
        }
      }
    } else if (data.MessageId) {
      const providerMessageId = data.MessageId;
      const status = data.Status;
      const recip = await SmsRecipient.findOne({ providerMessageId });
      if (recip) {
        recip.status = (status || '').toLowerCase().includes('deliv') ? 'delivered' : ((status || '').toLowerCase().includes('fail') ? 'failed' : 'pending');
        await recip.save();
        await SmsDeliveryLog.create({ recipientId: recip._id, providerMessageId, status, providerResponse: data });
      }
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error('webhook error', err);
    return res.status(500).json({ message: 'error' });
  }
}

// GET /api/sms/wallet/:schoolId
async function getWallet(req, res) {
  try {
    const { schoolId } = req.params;
    
    // Get balance from database (school's purchased tokens)
    let wallet = await SmsWallet.findOne({ schoolId });
    if (!wallet) {
      wallet = await SmsWallet.create({ schoolId, balance: 0 });
    }

    // Return wallet data from database only
    return res.json({
      schoolId,
      balance: wallet.balance || 0,
      currency: wallet.currency || 'KES',
      updatedAt: wallet.updatedAt,
      createdAt: wallet.createdAt,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
}

// POST /api/sms/wallet/topup
async function topUpWallet(req, res) {
  try {
    const { schoolId, amount, reference } = req.body;
    if (!schoolId || !amount) return res.status(400).json({ message: 'Missing schoolId or amount' });
    let wallet = await SmsWallet.findOne({ schoolId });
    if (!wallet) wallet = await SmsWallet.create({ schoolId, balance: 0 });
    wallet.balance = (wallet.balance || 0) + Number(amount);
    await wallet.save();
    await SmsTransaction.create({ walletId: wallet._id, type: 'credit', amount, reference });
    return res.json(wallet);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
}

// GET /api/sms/messages?schoolId=...
async function listMessages(req, res) {
  try {
    const { schoolId } = req.query;
    const query = {};
    if (schoolId) query.schoolId = schoolId;
    const msgs = await SmsMessage.find(query).sort({ createdAt: -1 }).limit(100);
    return res.json(msgs);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
}

module.exports = {
  sendSMS,
  webhook,
  getWallet,
  topUpWallet,
  listMessages,
};
