const mongoose = require('mongoose');
const LearningArea = require('../models/cms/content/learning_area');

async function makeAllLearningAreasCompulsory() {
  try {
    console.log('Starting migration: Making ALL learning areas compulsory...');
    
    // First, let's see the current state
    const totalLearningAreas = await LearningArea.countDocuments({});
    const existingCompulsory = await LearningArea.countDocuments({ is_compulsory: true });
    const existingNonCompulsory = await LearningArea.countDocuments({ is_compulsory: false });
    const undefinedCompulsory = await LearningArea.countDocuments({ is_compulsory: { $exists: false } });
    
    console.log('\nCurrent state:');
    console.log(`Total learning areas: ${totalLearningAreas}`);
    console.log(`Already compulsory: ${existingCompulsory}`);
    console.log(`Non-compulsory: ${existingNonCompulsory}`);
    console.log(`Undefined is_compulsory: ${undefinedCompulsory}`);
    

    
    // Update ALL learning areas to be compulsory
    console.log('\n🔄 Updating ALL learning areas to compulsory...');
    
    const result = await LearningArea.updateMany(
      {}, // Update ALL documents
      { 
        $set: { 
          is_compulsory: true
        }
      }
    );
    console.log('\n🔄 Done updating ALL learning areas to compulsory...');

    console.log(`✅ Updated ${result.modifiedCount} learning areas to compulsory.`);
    console.log(`📊 Total documents matched: ${result.matchedCount}`);
    //remove the rest of code below
    // Verify the results
}
catch (error) {
  console.error('Error making all learning areas compulsory:', error);
  process.exit(1);
}
}

module.exports = makeAllLearningAreasCompulsory; 