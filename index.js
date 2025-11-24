require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const logger = require('./utils/logger');

const app = express();
const server = require('http').createServer(app);

// Socket.io implementation
const io = require('socket.io')(server, {
  cors: {
    origin: '*',
  },
});

// Make io available to controllers
app.set('socketio', io);

// Import routes
const cms_routes = require('./routes/cms');
const portal_routes = require('./routes/portal');
const learner = require('./routes/learner');
const PaymentsController = require('./controllers/payment/PaymentController');

// Import frontoffice controllers (now with routes inline)
const clientController = require('./controllers/frontoffice/client');
const visitorController = require('./controllers/frontoffice/visitorController');
const generalController = require('./controllers/frontoffice/general');
const managementController = require('./controllers/frontoffice/management');
const salesController = require('./controllers/frontoffice/sales');
const onlineApplicantsController = require('./controllers/frontoffice/onlineApplicantsController');
const complaintsController = require('./controllers/frontoffice/complaintsController');
const frontOfficeController = require('./controllers/frontoffice/frontOfficeController');
// Keep other routes that haven't been refactored yet
const certificateRoutes = require('./routes/frontoffice/certificateRoutes');
const mpesaRoutes = require('./routes/frontoffice/mpesaRoutes');
const cohortRoutes = require('./routes/frontoffice/cohortRoutes');
const subjectRoutes = require('./routes/frontoffice/subjectRoutes');
const competencyRoutes = require('./routes/frontoffice/competencyRoutes');
const projectEvidenceRoutes = require('./routes/frontoffice/projectEvidenceRoutes');
const googleConfigRoutes = require('./routes/frontoffice/googleConfigRoutes');
const phoneCallRoutes = require('./routes/frontoffice/phoneCalls');
const portfolioSummaryRoutes = require('./routes/frontoffice/portfolioSummary');
const authRoutes = require('./routes/frontoffice/auth');

// Body parser middleware
app.use(express.json({limit: '50mb'}));
app.use(express.urlencoded({limit: '50mb', extended: true}));

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Allow localhost for development
    if (origin === 'http://localhost:5173') return callback(null, true);
    
    // Allow the production URL from environment variables
    if (process.env.URL && origin === process.env.URL) return callback(null, true);
    
    // Allow CMS URL if it exists
    if (process.env.CMSURL && origin === process.env.CMSURL) return callback(null, true);
    
    // Allow SCHOOL URL if it exists
    if (process.env.SCHOOLURL && origin === process.env.SCHOOLURL) return callback(null, true);
    
    // For other origins, deny the request
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: '*', // Specify allowed headers
};

// Remove the hardcoded localhost CORS and use the dynamic one
// app.use(cors({origin: 'http://localhost:5173/'})); // This line was removed

app.use(cors(corsOptions));
app.set('view engine', 'ejs');
app.set('views', path.join('views'));

// API routes with /api prefix
app.use('/api/cms', cms_routes);
app.use('/api/portal', portal_routes);
app.use('/api/learner', learner);
app.use('/api/payments', PaymentsController);

// Frontoffice routes with /api prefix
app.use("/api/client", clientController);
app.use("/api/visitors", visitorController);
app.use("/api/general", generalController);
app.use("/api/management", managementController);
app.use("/api/sales", salesController);
app.use("/api/onlineregistration", onlineApplicantsController);
app.use("/api/complaints", complaintsController);
app.use("/api/front-office", frontOfficeController);
app.use("/api/certificates", certificateRoutes);
app.use("/api/mpesa", mpesaRoutes);
app.use("/api/cohorts", cohortRoutes);
app.use("/api/subjects", subjectRoutes);
app.use("/api/competencies", competencyRoutes);
app.use("/api/project-evidences", projectEvidenceRoutes);
app.use("/api/google-config", googleConfigRoutes);
app.use("/api/phone-calls", phoneCallRoutes);
app.use("/api/portfolio-summary", portfolioSummaryRoutes);
app.use("/api/auth", authRoutes);

// Serve uploaded files
app.use('/uploads', express.static('uploads'));

app.use((req, res) => {
  res.status(404).send({
    message: 'Requested URI not found'.replace('{uri}', req.path),
    uri: req.path,
    method: req.method,
  });
});

async function startServer() {
  
const URL1 = "mongodb+srv://Safaribust:8R4NGbiciCMxCQX1@cluster0.yuiecha.mongodb.net/frontoffice?retryWrites=true&w=majority&appName=Cluster0";
// Mongoose Setup
const PORT = process.env.PORT || 9000;
mongoose
  .connect(URL1)
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server Port: ${PORT}`);
      
      // Initialize Cloudinary service after MongoDB connection

    });

  })
  .catch((error) => console.log(`${error} did not connect.`));
}

startServer();
