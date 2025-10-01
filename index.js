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

app.use('/cms', cms_routes);
app.use('/portal', portal_routes);
app.use('/learner', learner);
app.use('/payments', PaymentsController);

app.use((req, res) => {
  res.status(404).send({
    message: 'Requested URI not found'.replace('{uri}', req.path),
    uri: req.path,
    method: req.method,
  });
});

async function startServer() {
  try {
    // Wait for the Mongoose connection to establish before proceeding
    await mongoose.connect(process.env.MONGO_URL, {
      bufferCommands: false, // Disable buffering
    });
    // logger.info('Db connection successful');
    const seeder = require('./seeders/modules');
    // sendEmail('Samson', 'samsaf674@gmail.com', 'test', 'test', []);
    // Proceed with any operations that need to be done after connection
    // E.g., seeding data or other DB-related operations

    server.listen(process.env.SERVER_PORT, () => {
      logger.info(`Server running on port ${process.env.SERVER_PORT}`);
    });
  } catch (err) {
    console.log(err);
    logger.error(`Connection error: ${err.message}`);
  }
}

startServer();

// await mongoose
//   .connect(process.env.MONGO_URL, {
//     bufferCommands: false, // Disable buffering
//   })
//   logger.info(`Db connection successiful`);

//   // .then(() => {
//   //   // sendEmail('Samson', 'samsaf674@gmail.com', 'test', 'test', []);

//   // })
//   // .catch(err => {
//   //   logger.error(`Connection error: ${err.message}`);
//   // });
//   app.listen(process.env.SERVER_PORT, () => {
//     logger.info(`running in port  ${process.env.SERVER_PORT}`);
//   });
