const Subscription = require('../../models/portal/content/Subscription');
// const Plan = require('../models/Plan');
const PlanHistory = require('../../models/portal/content/PlanHistory');
const Invoice = require('../../models/portal/content/Invoice');
// const SessionManager = require('../services/SessionManager'); // Handles ERPNext session interactions
const axios = require('axios');
const mongoose = require('mongoose');
const Payment = require('../../models/portal/content/Payment');

class SubscriptionService {
  static async checkSubscriptionAndPayment(schoolId) {
    try {
      // Step 1: Fetch active subscription for the school
      const subscription = await Subscription.findOne({
        school: schoolId,
        valid_to: {$gte: new Date()}, // Subscription should be active (valid_to should be in the future)
        date_unsubscribed: null, // Ensure it is not unsubscribed
      });

      if (!subscription) {
        return {status: false, message: 'No active subscription found for this school.'};
      }

      // Step 2: Fetch the invoice that covers the current date
      const currentDate = new Date();

      // Fetch the invoice for the current period that covers today's date
      const invoice = await Invoice.findOne({
        subscription_id: subscription._id,
        invoice_period_start_date: {$lte: currentDate}, // Start date must be before or equal to today
        invoice_period_end_date: {$gte: currentDate}, // End date must be after or equal to today
        outstanding_amount: 0, // Check if the invoice has no outstanding amount (i.e., it's fully paid)
      });

      if (!invoice) {
        return {status: false, message: 'No paid invoice found for the current period.'};
      }

      // Step 3: If the invoice exists and is fully paid, return success
      return {
        status: true,
        message: 'User has an active subscription and has paid the invoice for the current period.',
      };
    } catch (error) {
      console.error('Error checking subscription and payment:', error);
      return {status: false, message: `Error: ${error.message}`};
    }
  }

  /**
   * Create a subscription for a school
   * @param {ObjectId} schoolId - The ID of the school
   * @param {ObjectId} planId - The ID of the plan to subscribe to
   * @param {Object} session - Session object for ERPNext
   * @returns {Object} - Created subscription
   */

  static async createSubscription(school, plan, numberOfLearners, session) {
    try {
      const totalCost = Number(plan.pricePerLearner) * numberOfLearners;
      const currentDate = new Date();

      // Add  months to the current date
      const endDate = new Date(currentDate);
      endDate.setMonth(currentDate.getMonth() + Number(plan?.duration));

      // Subscribe to the package
      //   const subscriptionData = {school, pack, endDate, numberOfLearners, totalCost};

      const subscription = new Subscription({
        school: school,
        current_plan_id: plan,
        date_subscribed: new Date(),
        valid_to: endDate, // Default 1-month subscription
      });

      const savedSubscription = await subscription.save({session});

      // Add initial plan history
      const planHistory = await PlanHistory({
        subscription_id: savedSubscription._id,
        plan_id: plan,
        date_start: new Date(),
        date_end: endDate,
      }).save({session});

      // Create initial invoice locally and in ERPNext
      const invoice = await this.createInvoice(
        savedSubscription._id,
        planHistory,
        totalCost,

        `Initial invoice for ${plan.plan_name}`,
        plan,
        numberOfLearners,
        session,
      );

      return {subscription: savedSubscription, invoice};
    } catch (error) {
      throw new Error(`Error creating subscription: ${error.message}`);
    }
  }

  /**
   * Create an invoice for a subscription
   * @param {ObjectId} subscriptionId - The ID of the subscription
   * @param {Number} amount - The invoice amount
   * @param {String} description - Invoice description
   * @param {Object} session - ERPNext session object
   * @returns {Object} - Created invoice
   */
  static async createInvoice(subscriptionId, planHistory, amount, description, plan, numberOfLearners, session) {
    try {
      const subscription = await Subscription.findById(subscriptionId).populate('school').session(session);
      if (!subscription) throw new Error('Subscription not found');

      // Check for overdue invoices
      const overdueInvoices = await Invoice.find({
        subscription_id: subscriptionId,
        invoice_paid_ts: null,
        invoice_due_ts: {$lt: new Date()},
      }).session(session);
      if (overdueInvoices.length > 0) throw new Error('Cannot create a new invoice until overdue invoices are paid');

      // Create local invoice
      const invoice = new Invoice({
        subscription_id: subscriptionId,
        plan_history_id: planHistory?._id,
        invoice_period_start_date: new Date(),
        invoice_period_end_date: new Date(new Date().setMonth(new Date().getMonth() + 1)),
        invoice_description: description,
        invoice_amount: amount,
        outstanding_amount: amount,
        invoice_created_ts: new Date(),
        invoice_due_ts: new Date(new Date().setDate(new Date().getDate() + 7)), // Default due in 7 days
      });
      const savedInvoice = await invoice.save({session});

      // Create invoice in ERPNext
      await this.createERPNextInvoice(savedInvoice, subscription, plan, numberOfLearners, session);

      return savedInvoice;
    } catch (error) {
      console.log(error);
      throw new Error(`Error creating invoice: ${error.message}`);
    }
  }

  /**
   * Create an invoice in ERPNext
   * @param {Object} localInvoice - Local invoice document
   * @param {Object} session - ERPNext session object
   */
  static async createERPNextInvoice(savedInvoice, subscription, plan, numberOfLearners, session) {
    try {
      console.log(subscription.school);
      const erpInvoiceData = {
        customer_name: subscription.school.name,
        email: 'example.com',
        phone: '0714241029',
        // Update dynamically if you have customer details linked
        items: [
          {
            item_code: plan.name, // Replace with the actual item code
            qty: numberOfLearners, // Replace with the actual quantity
            rate: plan.pricePerLearner, // Use the amount as the rate if applicable
          },
        ],
      };
      console.log(erpInvoiceData);
      //   console.log(erpInvoiceData);
      // Make the API request to create the sales invoice in ERPNext
      const response = await axios.post(
        `${process.env.ERPURL}api/method/hero.hero.apis.sales_invoice.create_sales_invoice`,
        erpInvoiceData,
        {
          headers: {
            'Content-Type': 'application/json',
            Cookie: `full_name=Guest; sid=Guest; system_user=no; user_id=Guest; user_image=`,
          },
        },
      );
      console.log(response);
      //   console.log(response);
      if (!response.data || response.data.status !== 'success') {
        throw new Error('Failed to create invoice in ERPNext', response);
      }
      savedInvoice.erpnext_invoice_id = response.data.invoice_name;
      await savedInvoice.save({session});

      console.log('ERPNext Invoice Created:', response.data.data);
    } catch (error) {
      console.log(error);
      throw new Error(`Internal server error: ${error.message}`);
    }
  }

  //   static async createERPNextInvoice(localInvoice, session) {
  //     try {
  //       const erpInvoiceData = {
  //         invoice_id: localInvoice._id,
  //         description: localInvoice.invoice_description,
  //         amount: localInvoice.invoice_amount,
  //         period_start_date: localInvoice.invoice_period_start_date,
  //         period_end_date: localInvoice.invoice_period_end_date,
  //         due_date: localInvoice.invoice_due_ts,
  //       };

  //       const response = await axios.post(`${session.erp_url}/api/resource/Sales Invoice`, erpInvoiceData, {
  //         headers: {Authorization: `Bearer ${session.token}`},
  //       });

  //       if (!response.data || response.data.status !== 'success') {
  //         throw new Error('Failed to create invoice in ERPNext');
  //       }

  //       console.log('ERPNext Invoice Created:', response.data.data);
  //     } catch (error) {
  //       throw new Error(`Error creating ERPNext invoice: ${error.message}`);
  //     }
  //   }

  /**
   * Upgrade a subscription to a new plan
   * @param {ObjectId} subscriptionId - The subscription ID
   * @param {ObjectId} newPlanId - The new plan ID
   * @param {Object} session - ERPNext session object
   * @returns {Object} - Updated subscription
   */

  static async renewExpiredSubscriptions(session) {
    try {
      const currentDate = new Date();

      // Fetch subscriptions that are about to expire within the next 30 days
      const expiredSubscriptions = await Subscription.find({
        valid_to: {$lt: new Date(currentDate.setMonth(currentDate.getMonth() + 1))}, // Expiry within 1 month
      }).session(session);

      if (expiredSubscriptions.length === 0) {
        console.log('No subscriptions found for renewal');
        return;
      }

      for (const subscription of expiredSubscriptions) {
        // Fetch the current plan

        // Calculate the new valid_to date (extend the subscription by the plan's duration)
        const newValidTo = new Date(subscription.valid_to);
        newValidTo.setMonth(newValidTo.getMonth() + Number(plan?.duration));

        // Update the subscription's valid_to date
        subscription.valid_to = newValidTo;
        await subscription.save({session});

        // Add new plan history entry for the renewal
        const planHistory = new PlanHistory({
          subscription_id: subscription._id,
          plan_id: plan._id,
          date_start: new Date(), // Current date as the start of the new period
          date_end: newValidTo, // The new expiration date for the renewed subscription
        }).save({session});

        // Calculate the total cost for the renewal period
        const totalCost = plan.pricePerLearner * subscription.numberOfLearners;

        // Create a new invoice for the renewal
        const renewalInvoice = await this.createInvoice(
          subscription._id,
          planHistory,
          totalCost,
          `Renewal invoice for ${plan.plan_name}`,
          session,
        );

        console.log(`Subscription ${subscription._id} renewed successfully with invoice ${renewalInvoice._id}`);
      }
    } catch (error) {
      console.log(error);
      throw new Error(`Error renewing expired subscriptions: ${error.message}`);
    }
  }

  static async createPayment(payload) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Create a new Payment entry
      const payment = new Payment({
        name: payload.name,
        posting_date: new Date(payload.posting_date),
        party: payload.party,
        party_type: payload.party_type,
        paid_amount: mongoose.Types.Decimal128.fromString(payload.paid_amount.toString()),
        payment_type: payload.payment_type,
        reference_no: payload.reference_no,
        reference_date: new Date(payload.reference_date),
        status: 'Completed', // Default status as 'Pending' until settled
        invoices: [],
      });
      let paid_amount = mongoose.Types.Decimal128.fromString(payload.paid_amount.toString());

      // Process each invoice in the payload
      for (const invoiceData of payload.invoices) {
        // Fetch the invoice to apply the payment
        const invoice = await Invoice.findOne({erpnext_invoice_id: invoiceData.invoice_name}).session(session);
        if (!invoice) {
          throw new Error(`Invoice not found for ${invoiceData.invoice_name}`);
        }

        // Ensure the invoice has outstanding amount
        if (invoice.outstanding_amount <= 0) {
          throw new Error(`Invoice ${invoiceData.invoice_name} has no outstanding balance.`);
        }

        // Calculate the amount applied to the invoice
        const amountApplied = mongoose.Types.Decimal128.fromString(payment.paid_amount.toString());

        // Check if the payment can cover the invoice amount
        if (amountApplied > paid_amount) {
          throw new Error(`Payment amount exceeds the total paid amount.`);
        }

        // Update the invoice outstanding amount
        invoice.outstanding_amount -= amountApplied;
        await invoice.save({session});

        // Add the invoice details to the payment's invoices array
        payment.invoices.push({
          invoice_id: invoice._id,
          amount_applied: amountApplied,
          outstanding_amount: invoice.outstanding_amount,
        });

        // Deduct the applied amount from the total paid amount
        paid_amount -= amountApplied;
      }

      // Save the payment record
      const savedPayment = await payment.save({session});

      // Commit the transaction
      await session.commitTransaction();
      session.endSession();

      return savedPayment;
    } catch (error) {
      // Abort the transaction in case of error
      await session.abortTransaction();
      session.endSession();
      throw new Error(`Error processing payment: ${error.message}`);
    }
  }
  static async getPaginatedInvoicesBySchool(schoolId, page = 1, limit = 10) {
    try {
      // Step 1: Fetch all subscriptions related to the school
      const subscriptions = await Subscription.find({school: schoolId});

      if (!subscriptions || subscriptions.length === 0) {
        return {status: false, message: 'No subscriptions found for this school.'};
      }

      // Step 2: Calculate skip and limit for pagination
      const skip = (page - 1) * limit;
      const totalInvoices = await Invoice.countDocuments({
        subscription_id: {$in: subscriptions.map(sub => sub._id)},
      });

      // Step 3: Fetch the paginated invoices
      const invoices = await Invoice.find({
        subscription_id: {$in: subscriptions.map(sub => sub._id)},
      })
        .skip(skip)
        .limit(limit)
        .populate('subscription_id'); // Optionally populate the subscription details

      return {
        status: true,
        invoices,
        totalInvoices,
        totalPages: Math.ceil(totalInvoices / limit),
        currentPage: page,
      };
    } catch (error) {
      console.error('Error fetching invoices:', error);
      return {status: false, message: `Error: ${error.message}`};
    }
  }
}
module.exports = SubscriptionService;
