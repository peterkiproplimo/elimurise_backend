const emailUtils = require('../utils/email');
const sendEmail = emailUtils.sendEmail;
class NotificationService {
  async sendMail(name, email, subject, body) {
    console.log(body);
    sendEmail(name, email, subject, body, []);
  }
  async sendSMS(phone, body) {
    //body
  }
}
module.exports = NotificationService;
