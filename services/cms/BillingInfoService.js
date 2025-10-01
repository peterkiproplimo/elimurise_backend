const BillingInfo = require('../../models/cms/content/BillingInfo');

class BillingService {
  // Constructor
  constructor() {}

  // Create billing information
  async createBillingInfo(billingInfoData) {
    try {
      const newBillingInfo = new BillingInfo(billingInfoData);
      const savedBillingInfo = await newBillingInfo.save();
      return savedBillingInfo;
    } catch (error) {
      throw error;
    }
  }
  async createBillingInfo(billingInfoData) {
    try {
      const newBillingInfo = new BillingInfo(billingInfoData);
      const savedBillingInfo = await newBillingInfo.save();
      return savedBillingInfo;
    } catch (error) {
      throw error;
    }
  }
  async getActiveSubscriptionByschool(school) {
    try {
      const currentDate = new Date();
      const activeBillingInfo = await BillingInfo.findOne({
        school,
        endDate: {$gt: currentDate},
        status: 'active',
      });
      console.log({
        school,
        endDate: {$gt: currentDate},
        // status: 'inactive',
      });
      return activeBillingInfo;
    } catch (error) {
      throw error;
    }
  }
  async getCurrentSubscriptionByschool(school) {
    try {
      const currentDate = new Date();
      const activeBillingInfo = await BillingInfo.findOne({
        school,
        endDate: {$gt: currentDate},
        // status: 'active',
      });

      return activeBillingInfo;
    } catch (error) {
      throw error;
    }
  }

  // Get billing information by school ID
  async getBillingInfoByschool(school) {
    try {
      const billingInfo = await BillingInfo.findOne({school, payment: {$ne: null}})
        .populate('school')
        .populate('packageId')
        .populate('payment');
      return billingInfo;
    } catch (error) {
      throw error;
    }
  }
  async getBillingInfoByOrderId(order_tracking_id) {
    try {
      const billingInfo = await BillingInfo.findOne({order_tracking_id}).populate('payment').populate('packageId');
      return billingInfo;
    } catch (error) {
      throw error;
    }
  }
  async toggleBillingType(billingInfoId) {
    // Find the document by ID
    console.log('billing', billingInfoId);
    const billingInfo = await BillingInfo.findById(billingInfoId);

    // If the document is not found, return an error
    if (!billingInfo) {
      throw new Error('BillingInfo not found');
    }

    // Toggle the type
    const updatedBillingInfo = await BillingInfo.findByIdAndUpdate(
      billingInfoId,
      {type: billingInfo.type === 'prepaid' ? 'post-paid' : 'prepaid'},
      {new: true},
    );

    return updatedBillingInfo;
  }
  async toggleBillingStatus(billingInfoId) {
    // Find the document by ID
    console.log('billing', billingInfoId);
    const billingInfo = await BillingInfo.findById(billingInfoId);

    // If the document is not found, return an error
    if (!billingInfo) {
      throw new Error('BillingInfo not found');
    }

    // Toggle the status
    const updatedBillingInfo = await BillingInfo.findByIdAndUpdate(
      billingInfoId,
      {
        status:
          billingInfo.status === 'active' ? 'suspended' : billingInfo.status === 'inactive' ? 'active' : 'inactive', // default to 'inactive' if the status is something unexpected
      },
      {new: true},
    );

    return updatedBillingInfo;
  }

  // Update billing information
  async updateBillingInfo(billingInfoId, updates) {
    try {
      const updatedBillingInfo = await BillingInfo.findByIdAndUpdate(billingInfoId, updates, {new: true});
      return updatedBillingInfo;
    } catch (error) {
      throw error;
    }
  }

  // Delete billing information
  async deleteBillingInfo(billingInfoId) {
    try {
      const deletedBillingInfo = await BillingInfo.findByIdAndDelete(billingInfoId);
      return deletedBillingInfo;
    } catch (error) {
      throw error;
    }
  }

  async getBillingInfo(school, billingInfoId) {
    try {
      const billingInfo = await BillingInfo.findOne({_id: billingInfoId, school})
        .populate('school')
        .populate('packageId')
        .populate('payment');
      return billingInfo;
    } catch (error) {
      throw error;
    }
  }

  async getPaginatedSchoolBillingInfo(school, page = 1, limit = 10) {
    try {
      const skip = (page - 1) * limit;
      const totalBillingInfo = await BillingInfo.countDocuments();
      const data = await BillingInfo.find({school})
        .populate('school')
        .populate('packageId')
        .populate('payment')
        .skip(skip)
        .limit(limit)
        .exec();
      const totalPages = Math.ceil(totalBillingInfo / limit);
      return {
        data,
        pagination: {
          current_page: page,
          total: totalBillingInfo,
          total_pages: totalPages,
          per_page: limit,
        },
      };
    } catch (error) {
      throw error;
    }
  }

  async getPaginatedBillingInfo(page = 1, limit = 10) {
    try {
      const skip = (page - 1) * limit;
      const totalBillingInfo = await BillingInfo.countDocuments();
      const data = await BillingInfo.find({payment: {$ne: null}})
        .populate('school')
        .populate('packageId')
        .populate('payment')
        .skip(skip)
        .limit(limit)
        .exec();
      const totalPages = Math.ceil(totalBillingInfo / limit);
      return {
        data,
        pagination: {
          current_page: page,
          total: totalBillingInfo,
          total_pages: totalPages,
          per_page: limit,
        },
      };
    } catch (error) {
      throw error;
    }
  }

  async generateInvoicesForExpiringSubscriptions() {
    try {
      const currentDate = new Date();
      const reminderDate = new Date();
      reminderDate.setDate(reminderDate.getDate() + 30); // 30 days before expiration

      // Find subscriptions expiring soon and without generated invoices
      const expiringSubscriptions = await BillingInfo.find({
        endDate: {$lte: reminderDate, $gt: currentDate},
        nextInvoiceGenerated: false,
        status: 'active',
      });

      for (const subscription of expiringSubscriptions) {
        const dueDate = new Date(subscription.endDate);
        const invoiceNumber = `INV-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

        // Create a new invoice
        const invoice = new Invoice({
          user: subscription.user,
          billingId: subscription._id,
          amount: subscription.totalCost,
          dueDate,
          invoiceNumber,
        });

        await invoice.save();

        // Mark the subscription as having its next invoice generated
        subscription.nextInvoiceGenerated = true;
        await subscription.save();

        console.log(`Generated invoice ${invoiceNumber} for subscription ${subscription._id}`);
      }
    } catch (error) {
      console.error('Error generating invoices:', error);
    }
  }
  async notifyUsersAboutExpiry() {
    const currentDate = new Date();
    const reminderDates = [30, 7, 1];

    for (const days of reminderDates) {
      const reminderDate = new Date();
      reminderDate.setDate(currentDate.getDate() + days);

      const subscriptions = await BillingInfo.find({
        endDate: {$lte: reminderDate, $gt: currentDate},
        status: 'active',
      }).populate('user');

      subscriptions.forEach(subscription => {
        const user = subscription.user;
        const daysLeft = Math.ceil((subscription.endDate - currentDate) / (1000 * 60 * 60 * 24));

        sendReminder(user.email, `Your subscription expires in ${daysLeft} day(s). Please renew.`);
      });
    }
  }
}

module.exports = BillingService;
