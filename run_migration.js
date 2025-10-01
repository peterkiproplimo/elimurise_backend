#!/usr/bin/env node

const migrateLearningAreasToCompulsory = require('./migrations/make_initial_learning_areas_compulsory');

console.log('Running migration: Make initial learning areas compulsory...');
console.log('==================================================');

migrateLearningAreasToCompulsory()
  .then(() => {
    console.log('\n✅ Migration completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }); 