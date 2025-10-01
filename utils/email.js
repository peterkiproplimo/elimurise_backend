const nodemailer = require('nodemailer');
const {generateBody} = require('./email-template');
exports.sendEmail = async (name, email, subject, html, headers) => {
  console.log(name);
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.MAIL_HOST,
      port: process.env.MAIL_PORT,
      secure: false,
      auth: {
        user: process.env.MAIL_USERNAME,
        pass: process.env.MAIL_PASSWORD,
      },
      debug: true, // Enable debug output
      logger: true, // Log information to console

      tls: {
        rejectUnauthorized: false, // Use cautiously, only if necessary
      },
    });
    const body = generateBody(name, subject, html);

    await transporter.sendMail({
      from: 'Elimurise CBC System <' + process.env.MAIL_FROM_ADDRESS + '>',
      to: email,
      subject: subject,
      html: body,
      headers: headers,
    });
    console.log('email sent successfully');
  } catch (error) {
    console.log('email not sent');
    console.log(error);
  }
};
