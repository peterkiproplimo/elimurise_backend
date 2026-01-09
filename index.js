import dotenv from 'dotenv';
dotenv.config();

import express from 'express';

import mongoose from 'mongoose';
import cors from 'cors';
import path from 'path';
// import logger from './utils/logger.js';

const app = express();
import http from 'http';

const server = http.createServer(app);
// Socket.io implementation

import { Server } from 'socket.io';

const io = new Server(server, {
  cors: {
    origin: '*', // allow all origins
    methods: ['GET', 'POST'], // optional
  },
});

// Make io available to controllers
app.set('socketio', io);

// Import routes
// Routes
import cms_routes from './routes/cms.js';
import portal_routes from './routes/portal.js';
import learner from './routes/learner.js';
import smsRoutes from './routes/sms.js';

// Controllers
import PaymentsController from './controllers/payment/PaymentController.js';

// Frontoffice controllers
import clientController from './controllers/frontoffice/client.js';
import visitorController from './controllers/frontoffice/visitorController.js';
import generalController from './controllers/frontoffice/general.js';
import managementController from './controllers/frontoffice/management.js';
import salesController from './controllers/frontoffice/sales.js';
import onlineApplicantsController from './controllers/frontoffice/onlineApplicantsController.js';
import complaintsController from './controllers/frontoffice/complaintsController.js';
import frontOfficeController from './controllers/frontoffice/frontOfficeController.js';

// Other routes
import certificateRoutes from './routes/frontoffice/certificateRoutes.js';
import mpesaRoutes from './routes/frontoffice/mpesaRoutes.js';
import cohortRoutes from './routes/frontoffice/cohortRoutes.js';
import subjectRoutes from './routes/frontoffice/subjectRoutes.js';
import competencyRoutes from './routes/frontoffice/competencyRoutes.js';
import projectEvidenceRoutes from './routes/frontoffice/projectEvidenceRoutes.js';
import googleConfigRoutes from './routes/frontoffice/googleConfigRoutes.js';
import phoneCallRoutes from './routes/frontoffice/phoneCalls.js';
import portfolioSummaryRoutes from './routes/frontoffice/portfolioSummary.js';
import authRoutes from './routes/frontoffice/auth.js';
// import smsRoutes from './routes/sms.js';
import templatesRoutes from './routes/templates.js'; // ✅ import default export


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
    if (process.env.URL_LOCAL && origin === process.env.URL_LOCAL) return callback(null, true);
    
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
// SMS module routes
app.use('/api/sms', smsRoutes);

// Templates module routes
app.use('/api/smstemplates', templatesRoutes);

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
