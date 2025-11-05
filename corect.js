const mongoose = require('mongoose');
const Substrand = require('./models/cms/content/substrand'); // Update the path accordingly

// async function migrateIndicators() {
//   await mongoose.connect('mongodb://localhost:27017/elimurise_backend', {useNewUrlParser: true, useUnifiedTopology: true});

//   const session = await mongoose.startSession();
//   session.startTransaction();

//   try {
//     const substrands = await Substrand.find().session(session);
//     console.log(substrands);

//     await session.commitTransaction();
//     console.log('Migration completed successfully.');
//   } catch (error) {
//     await session.abortTransaction();
//     console.error('Migration failed:', error);
//   } finally {
//     session.endSession();
//     mongoose.connection.close();
//   }
// }

// migrateIndicators();
