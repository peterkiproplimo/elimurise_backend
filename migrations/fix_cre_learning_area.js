const mongoose = require('mongoose');
const LearningArea = require('../models/cms/content/learning_area');

async function fixSpecificLearningAreas() {
  try {
    console.log('Starting migration: Fixing specific learning areas...');
    
    // Find the specific CRE learning area
    const creLearningArea = await LearningArea.findById('665d80352ee2cb77da37b618');
    
    if (creLearningArea) {
      console.log('Found CRE learning area:', {
        name: creLearningArea.name,
        short_name: creLearningArea.short_name,
        is_global: creLearningArea.is_global,
        is_compulsory: creLearningArea.is_compulsory,
        has_is_compulsory: 'is_compulsory' in creLearningArea
      });
      
      // Update it to be compulsory
      const result = await LearningArea.findByIdAndUpdate(
        '665d80352ee2cb77da37b618',
        { 
          $set: { 
            is_compulsory: true
          }
        },
        { new: true }
      );
      
      console.log('Updated CRE learning area to compulsory:', {
        name: result.name,
        is_compulsory: result.is_compulsory
      });
    } else {
      console.log('CRE learning area not found');
    }
    
    // Also fix any other learning areas with is_global but no is_compulsory
    const globalLearningAreas = await LearningArea.find({
      is_global: { $exists: true },
      is_compulsory: { $exists: false }
    });
    
    console.log(`\nFound ${globalLearningAreas.length} learning areas with is_global but no is_compulsory:`);
    globalLearningAreas.forEach(la => {
      console.log(`- ${la.name} (${la.short_name}) - ID: ${la._id}`);
    });
    
    if (globalLearningAreas.length > 0) {
      const result = await LearningArea.updateMany(
        {
          is_global: { $exists: true },
          is_compulsory: { $exists: false }
        },
        {
          $set: { is_compulsory: true }
        }
      );
      
      console.log(`\nUpdated ${result.modifiedCount} learning areas with is_global to compulsory.`);
    }
    
    // Final check
    const finalCreLearningArea = await LearningArea.findById('665d80352ee2cb77da37b618');
    if (finalCreLearningArea) {
      console.log('\nFinal state of CRE learning area:', {
        name: finalCreLearningArea.name,
        short_name: finalCreLearningArea.short_name,
        is_global: finalCreLearningArea.is_global,
        is_compulsory: finalCreLearningArea.is_compulsory
      });
    }
    
    console.log('\nMigration completed successfully!');
    
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}

// Run migration if this file is executed directly
if (require.main === module) {
  // Connect to MongoDB
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/hero_backend';
  
  mongoose.connect(mongoUri)
    .then(() => {
      console.log('Connected to MongoDB');
      return fixSpecificLearningAreas();
    })
    .then(() => {
      console.log('Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    })
    .finally(() => {
      mongoose.disconnect();
    });
}

module.exports = fixSpecificLearningAreas; 