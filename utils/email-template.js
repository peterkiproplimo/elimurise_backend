exports.generateBody = (name, subject, body) => {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body { font-family: Arial, sans-serif; color: #000000; background-color: #333333; }
    p { color: black; }
    .container { width: 100%; max-width: 600px; margin: 0 auto; }
    .header { background-color: #f6c01d; padding: 20px; }
    .content { padding: 20px;min-height:50vh }
    .button { background-color: #f6c01d; color: white; display: inline-block; text-decoration: none; padding: 12px 24px; font-size: 16px; border-radius: 4px; }
    .footer { font-size: 12px; text-align: center; margin-top: 20px; }
  </style>
</head>
<body style="background-color: #f5f5f5">
  <div class="container">
  <div class="header">
    <h2 style="color: white; margin: 0;">${subject}</h2>
  </div>
    <div class="content" style="background-color: #ffffff">
      <p>Dear ${name},
        <p style="margin-top:20px">${body}</p>
    </div>
    <div class="footer">
      <p>Copyright &copy; ${new Date().getFullYear()} Elimurise  Limited. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;
};
