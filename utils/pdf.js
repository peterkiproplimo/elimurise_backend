const fs = require('fs');
const pdf = require('html-pdf');
const path = require('path');
const {formatCurrency} = require('./helper');

let imageFilePath = path.resolve('img', 'elimurise.png');

exports.generatePdf = (res, subscription) => {
  let imageDataUrl = '';

  // Ensure the image file path is valid and exists
  if (imageFilePath && fs.existsSync(imageFilePath)) {
    try {
      const imageBuffer = fs.readFileSync(imageFilePath);
      const base64Image = imageBuffer.toString('base64');
      const imageType = 'image/png'; // Adjust based on your image type (e.g., image/jpeg)
      imageDataUrl = `data:${imageType};base64,${base64Image}`;
    } catch (error) {
      console.error('Error reading or encoding image file:', error);
    }
  } else {
    console.warn('Image file path is invalid or file does not exist:', imageFilePath);
  }
  let elimuriselogoDataUrl = '';
  const elimuriselogo = 'logo.png';
  var _basePath = elimuriselogo;

  if (_basePath && fs.existsSync(_basePath)) {
    try {
      const imageBuffer = fs.readFileSync(_basePath);
      const base64Image = imageBuffer.toString('base64');
      const imageType = 'image/png'; // Adjust based on your image type (e.g., image/jpeg)
      elimuriselogoDataUrl = `data:${imageType};base64,${base64Image}`;
    } catch (error) {
      console.error('Error reading or encoding image file:', error);
    }
  } else {
    console.warn('Image file path is invalid or file does not exist:', imageDataUrl);
  }
  const options = {
    format: 'A4',
    border: {
      top: '0.3in',
      right: '0.5in',
      bottom: '0.5in',
      left: '0.5in',
    },
    // footer: {
    //   contents: `  <hr style="border:2px solid black"><div id="pageHeader"><img src="${elimuriselogoDataUrl}"  alt="Learner"
    //    style="width:50px;
    //           border-radius: 5px;
    //          ">Powered By Elimurise. </div>
    // <div style="margin-top:10px;color: #444;text-align:center">{{page}}</span>/<span>{{pages}}</div> `,
    // },

    childProcessOptions: {
      env: {
        OPENSSL_CONF: '/dev/null',
      },
    },
  };

  pdf
    .create(
      `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invoice</title>
  <style>
    body {
      font-family: 'Arial', sans-serif;
      padding: 5px;
      background-color: #f4f4f4;
      font-size: 12px; /* Reduced font size */
    }
    .invoice-container {
      background: #fff;
      padding: 20px;
      border-radius: 8px;
      max-width: 800px;
      margin: auto;
      box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
    }
    h1 {
      font-size: 20px; /* Reduced font size */
      margin-bottom: 10px;
    }
    h2, h3 {
      font-size: 16px; /* Reduced font size */
      margin-bottom: 5px;
    }
    .header {
      text-align: center;
      margin-bottom: 20px;
    }
    .header img {
      max-width: 80px; /* Reduced logo size */
    }
    .company-details, .invoice-details {
      display: flex;
      justify-content: space-between;
      margin-bottom: 20px;
    }
    .details {
      flex: 1;
    }
    .invoice-details {
      text-align: right;
    }
    .items {
      width: 100%;
      border-collapse: collapse;
      margin-top: 20px;
    }
    .items th, .items td {
      border: 1px solid #ddd;
      padding: 8px;
      text-align: center;
    }
    .items th {
      background-color: #f0f0f0;
      font-weight: bold;
    }
    .totals {
      margin-top: 20px;
      text-align: right;
    }
    .totals h3 {
      font-size: 14px; /* Reduced font size */
    }
    .totals .total {
      font-size: 18px; /* Reduced font size */
      font-weight: bold;
    }
    .footer {
      text-align: center;
      margin-top: 40px;
      font-size: 10px; /* Reduced font size */
      color: #777;
    }
  </style>
</head>
<body>
  <div class="invoice-container">
    <!-- Invoice Header -->
    <div class="header">
      <img src="${imageDataUrl}"  alt="Company Logo">
      <h1>Invoice</h1>
    </div>

    <!-- Company and Invoice Details -->
    <div class="company-details">
      <div class="details">
        <h3>elimurise Learning</h3>
        <p>123 2453 Nairobi</p>
        <p> Kenya</p>

     
      </div>
      <div class="invoice-details">
        <h3>Invoice #: 00123</h3>
        <p>Date: October 15, 2024</p>
        <p>Due Date: October 30, 2024</p>
         <p>Status: ${subscription.payment ? 'Paid' : 'Pending'}</p>
         ` +
        (subscription.payment ? `<p>REF: ${subscription.payment.confirmation_code}</p>` : '') +
        `

      </div>
    </div>

    <!-- Client Details -->
    <div class="company-details">
      <div class="details">
        <h3>Bill To:</h3>
        <p>${subscription.school.name}</p>
        <p>${subscription.school.address}</p>
      
      </div>
    </div>

    <!-- Invoice Items Table -->
    <table class="items">
      <thead>
        <tr>
          <th>#</th>
          <th>Description</th>
          <th>Qty</th>
          <th>Unit Price</th>
          <th>Total</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>1</td>
          <td>${subscription.packageId.name}</td>
          <td>${subscription.numberOfLearners}</td>
          <td>${formatCurrency(subscription.packageId.pricePerLearner)}</td>
          <td>${formatCurrency(subscription.totalCost)}</td>
        </tr>
       
      </tbody>
    </table>

    <!-- Totals Section -->
    <div class="totals">
      <h3>Subtotal:Ksh ${formatCurrency(subscription.totalCost)}</h3>

      <h3 class="total">Total:Ksh ${formatCurrency(subscription.totalCost)}</h3>
    </div>

    <!-- Invoice Footer -->
    <div class="footer">
      <p>Thank you for your business!</p>
      <p>If you have any questions, please contact us at info@yourcompany.com</p>
    </div>
  </div>
</body>
</html>`,
      options,
    )
    .toBuffer((err, buffer) => {
      if (err) {
        return res.status(404).send(err.message);
      }

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename=output.pdf');
      res.send(buffer);
    });
};
