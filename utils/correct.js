const mongoose = require('mongoose');
const LearningArea = require('../models/cms/content/learning_area');
const Strand = require('../models/cms/content/strand');
const Substrand = require('../models/cms/content/substrand');
const Grade = require('../models/cms/content/grade');

async function duplicateContent(sourceGradeId, targetGradeIds) {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    // Step 1: Validate source grade
    const sourceGrade = await Grade.findById(sourceGradeId).session(session);
    if (!sourceGrade) {
      throw new Error('Source grade not found');
    }

    // Step 2: Validate target grades
    const targetGrades = await Grade.find({_id: {$in: targetGradeIds}}).session(session);
    if (targetGrades.length !== targetGradeIds.length) {
      throw new Error('One or more target grades not found');
    }

    // Step 3: Get source learning areas
    const sourceLearningAreas = await LearningArea.find({grade_id: sourceGradeId}).session(session);
    if (sourceLearningAreas.length === 0) {
      throw new Error('No learning areas found for source grade');
    }

    // Step 4: Process each source learning area
    for (const sourceLA of sourceLearningAreas) {
      for (const targetGradeId of targetGradeIds) {
        // Find or create matching learning area in target grade
        let targetLA = await LearningArea.findOne({
          grade_id: targetGradeId,
          name: sourceLA.name,
        }).session(session);

        if (targetLA) {
          // Delete the existing LearningArea document
          await LearningArea.deleteOne({
            _id: targetLA._id,
          }).session(session);
          console.log(`Deleted existing learning area '${targetLA.name}' for grade ${targetGradeId}`);
        }

        // Create a new LearningArea document
        targetLA = new LearningArea({
          grade_id: targetGradeId,
          short_name: sourceLA.short_name,
          name: sourceLA.name,
          no_of_lessons_per_week: sourceLA.no_of_lessons_per_week || 5,
          status: sourceLA.status,
        });
        await targetLA.save({session});
        console.log(`Created learning area '${targetLA.name}' for grade ${targetGradeId}`);
        // Step 5: Duplicate strands
        const sourceStrands = await Strand.find({learning_area: sourceLA._id}).session(session);
        for (const strand of sourceStrands) {
          // Check if strand already exists
          const existingStrand = await Strand.findOne({
            learning_area: targetLA._id,
            name: strand.name,
            term: strand.term,
          }).session(session);

          if (existingStrand) {
            console.log(
              `Strand '${strand.name}' (term ${strand.term}) already exists in learning area '${targetLA.name}'`,
            );
            continue;
          }

          // Create new strand
          const newStrand = new Strand({
            name: strand.name,
            learning_area: targetLA._id,
            term: strand.term,
            theme: strand.theme,
            row_number: 0, // Pre-save hook will handle this
          });
          await newStrand.save({session});
          console.log(`Created strand '${newStrand.name}' for learning area '${targetLA.name}'`);

          // Step 6: Duplicate substrands
          const sourceSubstrands = await Substrand.find({strand: strand._id}).session(session);
          const substrandIdMap = new Map();

          for (const substrand of sourceSubstrands) {
            const newSubstrand = new Substrand({
              ...substrand.toObject(),
              _id: new mongoose.Types.ObjectId(),
              strand: newStrand._id,
              row_number: 0, // Pre-save hook will handle this
              parent: undefined, // Will update later
              children: undefined, // Will update later
            });
            await newSubstrand.save({session});
            substrandIdMap.set(substrand._id.toString(), newSubstrand._id);
            console.log(`Created substrand '${newSubstrand.name}' for strand '${newStrand.name}'`);
          }

          // Step 7: Update parent/children references
          for (const substrand of sourceSubstrands) {
            if (substrand.is_child || substrand.parent || substrand.children) {
              const newSubstrandId = substrandIdMap.get(substrand._id.toString());
              const update = {};
              if (substrand.parent && substrandIdMap.has(substrand.parent.toString())) {
                update.parent = substrandIdMap.get(substrand.parent.toString());
              }
              if (substrand.children && substrandIdMap.has(substrand.children.toString())) {
                update.children = substrandIdMap.get(substrand.children.toString());
              }
              if (Object.keys(update).length > 0) {
                await Substrand.findByIdAndUpdate(newSubstrandId, update, {session});
                console.log(`Updated parent/children for substrand '${newSubstrandId}'`);
              }
            }
          }
        }
      }
    }

    await session.commitTransaction();
    console.log('Content duplicated successfully from Playgroup to target grades');
    return {message: 'Content duplicated successfully', targetGradeIds};
  } catch (error) {
    await session.abortTransaction();
    console.error('Error duplicating content:', error.message);
    throw error;
  } finally {
    session.endSession();
  }
}

// Example usage
async function main() {
  try {
    await mongoose.connect('mongodb://10.0.0.136:27017/elimurise_backend');

    const sourceGradeId = '662f65bc91aeabd467119f26'; // Playgroup
    const targetGradeIds = [
      '67e69e4773d0fef75751e37b', // Crèche
      '678c11ec95c1205b5b203659', // Reception
      '678c125c95c1205b5b203691', // Transition
    ];
    const result = await duplicateContent(sourceGradeId, targetGradeIds);
    console.log(result);
  } catch (err) {
    console.error('Failed to duplicate content:', err.message);
  } finally {
    await mongoose.connection.close();
  }
}

main();
