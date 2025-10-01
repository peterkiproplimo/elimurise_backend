const express = require('express');
const router = express.Router();
const {BillingAddress, Payment, PesapalApiService} = require('../../../services/payment/PesapalService');
const easyinvoice = require('easyinvoice');
const fs = require('fs');
const path = require('path');
let imgPath = path.resolve('img', 'hero.png');

const packageService = require('../../../services/cms/PackageService');
const PackageService = new packageService();
const billingService = require('../../../services/cms/BillingInfoService');
const schoolService = require('../../../services/portal/SchoolService');
const SchoolService = new schoolService();
const BillingService = new billingService();

const {body, validationResult} = require('express-validator');
const {generatePdf} = require('../../../utils/pdf');
const {formatCurrency} = require('../../../utils/helper');
const PaymentService = new PesapalApiService();

// Middleware for validating subscription data
const validateSubscriptionData = [
  body('packageId').notEmpty().withMessage('Package is required'),
  body('name').notEmpty().withMessage('School name is required'),
  body('county').notEmpty().withMessage('County  is required'),
  body('subcounty').notEmpty().withMessage('Sub-County  is required'),
  body('academic_year').notEmpty().withMessage('Academic year is required'),
  body('address').notEmpty().withMessage('address is required'),
  body('numberOfLearners')
    .notEmpty()
    .withMessage('Number of learners is required')
    .isNumeric()
    .withMessage('Number of learners must be a number'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(404).json({errors: errors.array()});
    }
    next();
  },
];
router.get('/school_details', async (req, res) => {
  try {
    const school = await SchoolService.getschool(req?.user?.school);
    return res.status(200).json(school);
  } catch (error) {
    return res.status(404).json({message: error.message});
  }
});
// Subscribe to a package
router.post('/', validateSubscriptionData, async (req, res) => {
  try {
    const {packageId, name, numberOfLearners, county, subcounty, academic_year, address} = req.body;
    let school = req?.user?.school;
    let user = req?.user;
    const currentDate = new Date();
    const startYear = currentDate.getFullYear();
    const current_session = `${startYear}`;

    const school_get = await SchoolService.getschool(school);
    console.log(school);
    if (school) {
      return res.status(404).json({message: 'You have alredy filled school details exist in the system'});
    }
    if (!school_get || !school) {
      const new_school = await SchoolService.createSchool({
        name,
        numberOfLearners,
        administrators: [user?._id],
        county,
        subcounty,
        address,
        current_session,
      });
      console.log(new_school);
      // const academic = await sessionService.createsession({
      //   name: academic_year,
      //   school: new_school._id,
      //   startDate: currentDate,
      //   endDate: currentDate,
      // });
      // new_school.current_year = academic_year;
      // new_school.save();
      user.school = new_school?._id;
      school = new_school?._id;
      user.save();
    }

    // Check if the package existsm
    const packageExists = await PackageService.getPackageById(packageId);
    if (!packageExists) {
      return res.status(404).json({message: 'Package not found'});
    }

    // Check if the school already has an active subscription
    const activeSubscription = await BillingService.getActiveSubscriptionByschool(school);
    if (activeSubscription) {
      return res.status(404).json({message: 'School already has an active subscription'});
    }
    const totalCost = Number(packageExists.pricePerLearner) * Number(numberOfLearners);

    // Add  months to the current date
    const endDate = new Date(currentDate);
    endDate.setMonth(currentDate.getMonth() + Number(packageExists?.duration));

    // Subscribe to the package
    const subscriptionData = {school, packageId, endDate, numberOfLearners, totalCost};
    const newSubscription = await BillingService.createBillingInfo(subscriptionData);
    res.status(201).json({data: newSubscription});
  } catch (error) {
    console.log(error);
    res.status(404).json({message: error.message});
  }
});
router.get('/packages', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const paginatedPackages = await PackageService.getPaginatedPackages(page, limit);
    res.status(200).json({...paginatedPackages});
  } catch (error) {
    res.status(404).json({message: error.message});
  }
});

router.get('/trasactions', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    let school = req?.user?.school;
    const Subscriptions = await BillingService.getPaginatedSchoolBillingInfo(school, page, limit);
    res.status(200).json({...Subscriptions});
  } catch (error) {
    res.status(404).json({error: error.message});
  }
});
function base64_encode(img) {
  // read binary data
  let png = fs.readFileSync(img);
  // convert binary data to base64 encoded string
  return new Buffer.from(png).toString('base64');
}

router.get('/trasactions/:id', async (req, res) => {
  try {
    let school = req?.user?.school;
    const id = req.params.id;
    const subscription = await BillingService.getBillingInfo(school, id);
    if (subscription) {
      generatePdf(res, subscription);
    }

    //res.status(200).json(subscription);
  } catch (error) {
    res.status(404).json({error: error.message});
  }
});

router.post('/:id/pay', async (req, res) => {
  const {id} = req.params;
  const user = req.user; // assuming user object is available in the request body
  const currentDate = new Date();
  const billing = await BillingService.getBillingInfo(req?.user?.school, id);
  if (!billing) {
    return res.status(404).json({message: 'Billing info not found'});
  }
  console.log(billing);
  const billingAddress = new BillingAddress(
    user.email,
    user.phone,
    '254',
    user.firstname,
    user.middlename,
    user.lastname,
    user.town,
    user.town,
    user.county,
    user.nationality,
    null,
    null,
  );
  //ds
  const payment = new Payment(
    currentDate.getTime(),
    'KES',
    Number(billing.totalCost),
    // Number(billing?.totalCost),
    '67b34af6-d23d-4cd8-a453-de1e1f1fcbaw',
    'Card Online Payment',
    'https://hero.techsavanna.technology/api/payments/confirm',
    billingAddress,
  );
  try {
    const response = await PaymentService.submitOrderRequest(JSON.parse(JSON.stringify(payment)));
    console.log(response);
    billing.order_tracking_id = response.order_tracking_id;
    billing.save();
    if (response.status == 200) {
      return res.status(response.status).json(response);
    } else {
      return res.status(404).json({error: response.error.message});
    }
  } catch (error) {
    return res.status(404).json({error: 'Failed to initiate payment, Contact support'});
  }
});
router.post('/confirm-payment', async (req, res) => {
  const {id} = req.params;
  const user = req.user; // assuming user object is available in the request body
  const currentDate = new Date();
  const billing = await BillingService.getBillingInfo(id);
  if (!billing) {
    return res.status(404).json({message: 'Billing info not found'});
  }
  const billingAddress = new BillingAddress(
    user.email,
    user.phone,
    '254',
    user.firstname,
    user.middlename,
    user.lastname,
    user.town,
    user.town,
    user.county,
    user.nationality,
    null,
    null,
  );

  const payment = new Payment(
    currentDate.getTime(),
    'KES',
    Number(billing?.totalCost),
    '67b34af6-d23d-4cd8-a453-de1e1f1fcbab',
    'Card Online Payment',
    'https://hero.techsavanna.technology/api/payments',
    billingAddress,
  );
  try {
    const response = await PaymentService.submitOrderRequest(JSON.parse(JSON.stringify(payment)));
    console.log(response);
    return res.send(response);
  } catch (error) {
    console.log(error);
  }
});
module.exports = router;
