import nodemailer from 'nodemailer';
import { generateBody } from './email-template.js';

export const sendEmail = async (name, email, subject, html, headers) => {
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
      debug: true,
      logger: true,
      tls: {
        rejectUnauthorized: false,
      },
    });

    const body = generateBody(name, subject, html);

    await transporter.sendMail({
      from: `Elimurise CBC System <${process.env.MAIL_FROM_ADDRESS}>`,
      to: email,
      subject,
      html: body,
      headers,
    });

    console.log('email sent successfully');
  } catch (error) {
    console.log('email not sent');
    console.error(error);
  }
};
