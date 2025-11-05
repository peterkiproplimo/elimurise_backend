const mongoose = require('mongoose');
const LearningArea = require('../models/cms/content/learning_area');

async function migrateInitialLearningAreasToCompulsory() {
  try {
    console.log('Starting migration: Making initial/core learning areas compulsory...');
    
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
    
    // Define core/initial learning areas that should be compulsory
    const coreLearningAreas = [
      'Mathematics', 'Math', 'MATHEMATICS', 'Maths',
      'English', 'ENG', 'ENGLISH', 'Eng',
      'Science', 'SCI', 'SCIENCE', 'Sci',
      'Social Studies', 'SOCIAL STUDIES', 'Social', 'SOCIAL',
      'Kiswahili', 'KISWAHILI', 'Swahili', 'KISWAHILI',
      'CRE', 'CRE.', 'Christian Religious Education', 'Christian Religious Ed',
      'IRE', 'Islamic Religious Education', 'Islamic Religious Ed',
      'Physical Education', 'PE', 'P.E', 'Physical Ed',
      'Art and Craft', 'ART', 'Art', 'Arts',
      'Music', 'MUSIC',
      'Computer Studies', 'ICT', 'Information Technology', 'Computer',
      'Agriculture', 'AGRICULTURE', 'Agric',
      'Business Studies', 'BUSINESS', 'Business',
      'Home Science', 'HOME SCIENCE', 'Home Sci',
      'French', 'FRENCH',
      'German', 'GERMAN',
      'Arabic', 'ARABIC',
      'History', 'HISTORY',
      'Geography', 'GEOGRAPHY', 'Geo',
      'Chemistry', 'CHEMISTRY', 'Chem',
      'Physics', 'PHYSICS', 'Physics',
      'Biology', 'BIOLOGY', 'Bio'
    ];
    
    console.log('\n🔄 Making core learning areas compulsory...');
    
    // Update core learning areas to be compulsory
    const result1 = await LearningArea.updateMany(
      { 
        $or: [
          { name: { $in: coreLearningAreas } },
          { short_name: { $in: coreLearningAreas } }
        ],
        is_compulsory: { $ne: true }
      },
      { 
        $set: { 
          is_compulsory: true
        }
      }
    );
    
    console.log(`✅ Updated ${result1.modifiedCount} core learning areas to compulsory.`);
    
    // Update learning areas that don't have is_compulsory field set (set them to non-compulsory by default)
    const result2 = await LearningArea.updateMany(
      { 
        is_compulsory: { $exists: false }
      },
      { 
        $set: { 
          is_compulsory: false
        }
      }
    );
    
    console.log(`✅ Updated ${result2.modifiedCount} learning areas with undefined is_compulsory to non-compulsory.`);
    
    // Final statistics
    const finalCompulsoryCount = await LearningArea.countDocuments({ is_compulsory: true });
    const finalNonCompulsoryCount = await LearningArea.countDocuments({ is_compulsory: false });
    const stillUndefined = await LearningArea.countDocuments({ is_compulsory: { $exists: false } });
    
    console.log('\nFinal state:');
    console.log(`✅ Total compulsory learning areas: ${finalCompulsoryCount}`);
    console.log(`📚 Total non-compulsory learning areas: ${finalNonCompulsoryCount}`);
    console.log(`⚠️  Still undefined is_compulsory: ${stillUndefined}`);
    
    // Show all compulsory learning areas
    const allCompulsoryLearningAreas = await LearningArea.find({ is_compulsory: true })
      .populate('grade_id', 'name')
      .select('name grade_id is_compulsory short_name')
      .sort({ name: 1 });
    
    console.log('\n📋 ALL compulsory learning areas:');
    allCompulsoryLearningAreas.forEach((la, index) => {
      console.log(`${index + 1}. ${la.name} (${la.short_name}) - Grade: ${la.grade_id?.name || 'No Grade'}`);
    });
    
    // Show sample of non-compulsory learning areas (for schools to allocate)
    const nonCompulsoryLearningAreas = await LearningArea.find({ is_compulsory: false })
      .populate('grade_id', 'name')
      .limit(20)
      .select('name grade_id is_compulsory short_name')
      .sort({ name: 1 });
    
    console.log(`\n📚 Sample non-compulsory learning areas (${finalNonCompulsoryCount} total, showing first 20):`);
    nonCompulsoryLearningAreas.forEach((la, index) => {
      console.log(`${index + 1}. ${la.name} (${la.short_name}) - Grade: ${la.grade_id?.name || 'No Grade'}`);
    });
    
    if (finalNonCompulsoryCount > 20) {
      console.log(`... and ${finalNonCompulsoryCount - 20} more non-compulsory learning areas available for schools to allocate.`);
    }
    
    // Show statistics by grade
    const compulsoryByGrade = await LearningArea.aggregate([
      { $match: { is_compulsory: true } },
      { $lookup: { from: 'grades', localField: 'grade_id', foreignField: '_id', as: 'grade' } },
      { $group: { _id: '$grade_id', count: { $sum: 1 }, gradeName: { $first: '$grade.name' } } },
      { $sort: { gradeName: 1 } }
    ]);
    
    console.log('\n📊 Compulsory learning areas by grade:');
    compulsoryByGrade.forEach(item => {
      console.log(`- ${item.gradeName?.[0]?.name || 'Unknown Grade'}: ${item.count} learning areas`);
    });
    
    console.log('\nMigration completed successfully!');
    console.log('📝 Schools can now allocate the non-compulsory learning areas to themselves.');
    console.log(`💡 With ${finalNonCompulsoryCount} non-compulsory learning areas available, schools have plenty of options to choose from.`);
    
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}

// Run migration if this file is executed directly
if (require.main === module) {
  // Connect to MongoDB
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/elimurise_backend';
  
  mongoose.connect(mongoUri)
    .then(() => {
      console.log('Connected to MongoDB');
      return migrateInitialLearningAreasToCompulsory();
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

module.exports = migrateInitialLearningAreasToCompulsory; 