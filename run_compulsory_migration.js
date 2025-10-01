#!/usr/bin/env node

const migrateInitialLearningAreasToCompulsory = require('./migrations/make_initial_learning_areas_compulsory');

console.log('Running migration: Make core learning areas compulsory...');
console.log('=====================================================');

migrateInitialLearningAreasToCompulsory()
  .then(() => {
    console.log('\n✅ Migration completed successfully!');
    console.log('🎉 Core learning areas are now compulsory!');
    console.log('📚 Non-compulsory learning areas are available for schools to allocate.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }); 