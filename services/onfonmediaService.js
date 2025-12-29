const axios = require('axios');

const ONFON_URL = process.env.ONFONMEDIA_SMS_URL || 'https://api.onfonmedia.co.ke/v1/sms/SendBulkSMS';
const API_KEY = process.env.ONFONMEDIA_API_KEY || 'Kb1EhwPAozixY7aRn6p4tMkOXmUyWurS9G23eqs5F8B0IHgZ';
const CLIENT_ID = process.env.ONFONMEDIA_CLIENT_ID || 'ElimuRise';
const ACCESS_KEY = process.env.ONFONMEDIA_ACCESS_KEY || 'Kb1EhwPAozixY7aRn6p4tMkOXmUyWurS9G23eqs5F8B0IHgZ';

async function sendBulkSMS({ sender, messages, isUnicode = false, isFlash = false, scheduleDateTime }) {
  // messages: [{to: '2547...', message: '...'}]
  const payload = {
    SenderId: sender || 'ELIMURISE',
    IsUnicode: Boolean(isUnicode),
    IsFlash: Boolean(isFlash),
    MessageParameters: messages.map((m) => ({
      Number: m.to,
      Text: m.message,
    })),
    ApiKey: API_KEY,
    ClientId: CLIENT_ID,
  };

  // Only include ScheduleDateTime if provided
  if (scheduleDateTime) {
    payload.ScheduleDateTime = scheduleDateTime;
  }

  const headers = {
    'AccessKey': ACCESS_KEY,
    'Content-Type': 'application/json',
  };

  try {
    const res = await axios.post(ONFON_URL, payload, { headers, timeout: 10000 });
    // Return provider response so controller can store provider ids
    return res.data;
  } catch (err) {
    return { error: true, details: err.response ? err.response.data : err.message };
  }
}

async function getBalance() {
  const BALANCE_URL = 'https://api.onfonmedia.co.ke/v1/sms/Balance';
  const headers = {
    'AccessKey': ACCESS_KEY,
  };

  const params = new URLSearchParams({
    ApiKey: API_KEY,
    ClientId: CLIENT_ID,
  });

  try {
    const res = await axios.get(`${BALANCE_URL}?${params.toString()}`, { headers, timeout: 10000 });
    return res.data;
  } catch (err) {
    return { error: true, details: err.response ? err.response.data : err.message };
  }
}

module.exports = {
  sendBulkSMS,
  getBalance,
};
