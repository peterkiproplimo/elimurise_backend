const BillingInfo = require('../../models/cms/content/BillingInfo');
const {BillingAddress, Payment, PesapalApiService} = require('../../services/payment/PesapalService');
const logger = require('../../utils/logger');
const express = require('express');
const router = express.Router();
const PaymentService = new PesapalApiService();
const Payments = require('../../models/cms/content/Payments');
const billingService = require('../../services/cms/BillingInfoService');
const schoolService = require('../../services/portal/SchoolService');
const TransferRequest = require('../../models/portal/content/Transfer');
const SubscriptionService = require('../../services/portal/Subscription');
const SchoolService = new schoolService();
const BillingService = new billingService();

// router.get('/confirm', async (req, res) => {
//   try {
//     // const controller = new PaymentsController();
//     const order_tracking_id = req.query.OrderTrackingId;
//     if (order_tracking_id) {
//       const response = await PaymentService.getTransactionStatus(order_tracking_id);
//       console.log(response);
//       if (response.payment_status_description !== 'Completed') {
//         return res.status(403).json({error: 'Fobbiden'});
//       }
//       const billing = await BillingService.getBillingInfoByOrderId(order_tracking_id);
//       console.log(billing);
//       if (!billing) {
//         return res.status(403).json({error: 'Fobbiden'});
//       }
//       if (!billing.payment) {
//         const payment = await Payments.create(response);
//         billing.payment = payment;
//         billing.status = 'active';
//         billing.save();
//       }

//       return res.redirect(`${process.env.URL}register?completed=true`);
//     } else {
//       throw Error('Internal Server Error');
//     }
//   } catch (error) {
//     console.log(error);

//     logger.error(error);
//     res.status(404).send({error: 'Internal Server Error'});
//   }
// });

router.get('/confirm', async (req, res) => {
  try {
    // const controller = new PaymentsController();
    const order_tracking_id = req.query.OrderTrackingId;
    if (order_tracking_id) {
      const response = await PaymentService.getTransactionStatus(order_tracking_id);
      if (response.payment_status_description !== 'Completed') {
        return res.status(403).json({error: 'Fobbiden'});
      }
      const billing = await BillingService.getBillingInfoByOrderId(order_tracking_id);
      console.log(billing);
      if (!billing) {
        const transferRequest = await TransferRequest.findOne({order_tracking_id, paymentStatus: 'Pending'});

        // return res.status(403).json({error: 'Fobbiden'});
        if (!transferRequest.payment) {
          const payment = await Payments.create(response);
          transferRequest.payment = payment;
          transferRequest.paymentStatus = 'Paid';
          transferRequest.save();
        }
        return res.redirect(`${process.env.URL}parent/transfers`);
      }
      if (!billing.payment) {
        const payment = await Payments.create(response);
        billing.payment = payment;
        billing.status = 'active';
        billing.save();
      }

      return res.redirect(`${process.env.URL}register?completed=true`);
    } else {
      throw Error('Internal Server Error');
    }
  } catch (error) {
    console.log(error);

    logger.error(error);
    res.status(404).send({error: 'Internal Server Error'});
  }
});
router.post('/sync_payment_from_erp', async (req, res) => {
  try {
    const paymentPayload = req.body; // Assuming the payment details are sent in the request body

    // Call the createPayment function and pass the payment payload
    const payment = await SubscriptionService.createPayment(paymentPayload);

    // Respond with the created payment entry
    return res.status(201).json({
      status: 'success',
      message: 'Payment processed successfully',
      payment,
    });
  } catch (error) {
    // Handle any errors that occur during payment processing
    console.error(error);
    return res.status(400).json({
      message: 'Error processing payment',
      error: error.message,
      status: 'failed',
    });
  }
}),
  (module.exports = router);
