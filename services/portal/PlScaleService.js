const PlScale = require('../../models/cms/content/plScale'); // Import PlScale model
const LearningArea = require('../../models/cms/content/learning_area'); // Import LearningArea model

// Default grading scale

// Grading Service class
class GradingService {
  async gradeScore(score, learningAreaId, scaleId) {
    try {
      // Fetch the grading scale for the specified learning area and school
      const scale = await PlScale.findOne({
        _id: scaleId,
      }).populate('learningAreas.learning_area');
      if (!scale) {
        throw new Error('No grading scale found for the specified learning area and school.');
      }

      // Loop through the learning areas to find the specified learning area
      for (const learningArea of scale.learningAreas) {
        if (learningArea.learning_area._id.toString() === learningAreaId.toString()) {
          // Sort gradings by mark in descending order (highest mark first)
          const sortedGradings = learningArea.gradings.sort((a, b) => b.score - a.score);
          // Loop through the sorted gradings to find the correct description
          for (const grading of sortedGradings) {
            if (score >= grading.mark) {
              return grading; // Return the description of the matching grading
            } else if (score == 0) {
              return {description: 'Assessment Not Done', mark: '', score: ''}; // Return "Ungraded" if score is 0
            }
          }
        }
      }

      // Return "Ungraded" if the score doesn't match any grading
      return 'Not graded';
    } catch (error) {
      console.error('Error grading the score:', error);
      throw error; // Re-throw the error for higher-level handling
    }
  }

  async fetchScales(school, page = 1, limit = 10) {
    try {
      // Calculate the number of documents to skip based on the page number and limit
      const skip = (page - 1) * limit;

      // Fetch learning areas, limited to the 'name' field only
      const scales = await PlScale.find({
        $or: [
          {school: null}, // Find where school is null
          {school: {$in: school}},
        ],
      })
        .select('name grade school')
        .populate('grade') // Only fetch the name of the learning area
        .skip(skip) // Skip to the required page
        .limit(limit) // Limit the number of results per page
        .exec();

      // Count total learning areas for the grade
      const totalScales = await PlScale.countDocuments({
        $or: [
          {school: null}, // Find where school is null
          {school: {$in: school}},
        ],
      });
      const totalPages = Math.ceil(totalScales / limit);

      // Create a response object that includes data and pagination info
      return {
        data: scales,
        pagination: {
          current_page: page,
          total: totalScales,
          total_pages: totalPages,
          per_page: limit,
        },
      };
    } catch (error) {
      console.error('Error fetching learning areas:', error);
      throw error;
    }
  }

  // Method to assign default grading scale to learning areas of a provided grade
  // async assignDefaultGradingScale(name, gradeId, school, isElimurise, defaultGradings) {
  //   try {
  //     // Fetch all learning areas associated with the provided grade ID
  //     const learningAreas = await LearningArea.find({grade_id: gradeId}).exec();

  //     if (learningAreas.length === 0) {
  //       throw new Error('No learning areas found for the provided grade.');
  //     }

  //     // Create or update the grading scale in PlScale model
  //     const scale = await PlScale.findOneAndUpdate(
  //       {
  //         grade: gradeId,
  //         school: school,
  //       }, // Find scale by grade and school
  //       {
  //         name: name, // Give it a name
  //         grade: gradeId,
  //         school: school,
  //         default: isElimurise,
  //         learningAreas: learningAreas.map(area => ({
  //           learning_area: area._id,
  //           gradings: defaultGradings, // Assign default gradings
  //         })),
  //       },
  //       {upsert: true, new: true}, // Create a new scale if it doesn't exist
  //     )
  //       .populate('learningAreas.learning_area')
  //       .populate('grade');

  //     console.log('Default gradings assigned successfully!');
  //     return scale; // Return the updated scale
  //   } catch (error) {
  //     console.error('Error assigning default gradings:', error);
  //     throw error;
  //   }
  // }
  async assignDefaultGradingScale(name, gradeId, school, isElimurise, defaultGradings) {
    try {
      // Fetch all learning areas associated with the provided grade ID
      const learningAreas = await LearningArea.find({grade_id: gradeId}).exec();

      if (learningAreas.length === 0) {
        throw new Error('No learning areas found for the provided grade.');
      }

      // Modify gradings based on learning area name
      const modifiedLearningAreas = learningAreas.map(area => {
        const isSwahili = /kiswahili/i.test(area.name); // Check if name contains "kiswahili" (case-insensitive)
        return {
          learning_area: area._id,
          gradings: defaultGradings.map(grade => ({
            ...grade.toObject(),
            description: isSwahili ? grade.description_swahili : grade.description,
          })),
        };
      });
      console.log(JSON.stringify(modifiedLearningAreas));

      // Create or update the grading scale in PlScale model
      const scale = await PlScale.create({
        name: name, // Assign name
        grade: gradeId,
        school: school,
        default: isElimurise,
        learningAreas: modifiedLearningAreas, // Use modified learning areas
      });
      console.log('Scale:', scale);

      console.log('Default gradings assigned successfully!');
      return scale; // Return the updated scale
    } catch (error) {
      console.error('Error assigning default gradings:', error);
      throw error;
    }
  }

  // Fetch all learning areas for a given grade
  async fetchLearningAreas(gradeId) {
    try {
      const learningAreas = await PlScale.find({grade: gradeId}).exec();
      if (learningAreas.length === 0) {
        throw new Error('No learning areas found for the provided grade.');
      }
      return learningAreas;
    } catch (error) {
      console.error('Error fetching learning areas:', error);
      throw error;
    }
  }
  async getGradingScaleById(scaleId, school) {
    try {
      // Fetch the grading scale by its ID
      const scale = await PlScale.findOne({
        _id: scaleId,
        $or: [
          {school: null}, // Find where school is null
          {school: {$in: school}},
        ],
      })
        .populate('learningAreas.learning_area')
        .populate('grade')
        .exec();

      if (!scale) {
        throw new Error('Grading scale not found.');
      }

      return scale;
    } catch (error) {
      console.error('Error fetching grading scale by ID:', error);
      throw error;
    }
  }
  async deleteGradingScaleById(scaleId, school) {
    try {
      // Fetch the grading scale by its ID
      const scale = await PlScale.findOneAndDelete({_id: scaleId, school});

      if (!scale) {
        throw new Error('Grading scale not found.');
      }

      return scale;
    } catch (error) {
      console.error('Error fetching grading scale by ID:', error);
      throw error;
    }
  }
  async updateGradingScaleSchool(scaleId, scaleData, school) {
    try {
      const {grade, default: isDefault, learningAreas} = scaleData;

      // Prepare the update object
      const updateData = {
        // grade: grade._id, // Use the grade ID from the nested grade object
        // school: school, // School ID
        // default: isDefault, // Boolean field for default
        learningAreas: learningAreas.map(area => ({
          learning_area: area.learning_area._id, // Learning area ID
          gradings: area.gradings.map(grading => ({
            mark: grading.mark,
            score: grading.score,
            description: grading.description,
            _id: grading._id, // Retain the existing grading ID if updating
          })),
        })),
      };

      // Update the scale
      const updatedScale = await PlScale.findOneAndUpdate(
        {_id: scaleId, school: school}, // Find by both scaleId and school
        updateData,
        {new: true}, // Return the updated document
      )
        .populate('learningAreas.learning_area')
        .populate('grade');

      if (!updatedScale) {
        throw new Error('Grading scale not found.');
      }

      console.log('Grading scale updated successfully!');
      return updatedScale;
    } catch (error) {
      console.error('Error updating grading scale:', error);
      throw error;
    }
  }

  async updateGradingScale(scaleId, scaleData) {
    try {
      const {grade, school, default: isDefault, learningAreas} = scaleData;

      // Prepare the update object
      const updateData = {
        // grade: grade._id, // Use the grade ID from the nested grade object
        // school: school, // School ID
        // default: isDefault, // Boolean field for default
        learningAreas: learningAreas.map(area => ({
          //   learning_area: area.learning_area._id, // Learning area ID
          gradings: area.gradings.map(grading => ({
            mark: grading.mark,
            // score: grading.score,
            // description: grading.description,
            _id: grading._id, // Retain the existing grading ID if updating
          })),
        })),
      };

      // Update the scale
      const updatedScale = await PlScale.findByIdAndUpdate(
        scaleId,
        updateData,
        {new: true}, // Return the updated document
      )
        .populate('learningAreas.learning_area')
        .populate('grade');

      if (!updatedScale) {
        throw new Error('Grading scale not found.');
      }

      console.log('Grading scale updated successfully!');
      return updatedScale;
    } catch (error) {
      console.error('Error updating grading scale:', error);
      throw error;
    }
  }
  async updateGradingScaleName(school, scaleId, name) {
    try {
      // Update the scale
      const updatedScale = await PlScale.findOneAndUpdate(
        {_id: scaleId, school},
        {name},
        {new: true}, // Return the updated document
      )
        .populate('learningAreas.learning_area')
        .populate('grade');

      if (!updatedScale) {
        throw new Error('Grading scale not found.');
      }

      console.log('Grading scale updated successfully!');
      return updatedScale;
    } catch (error) {
      console.error('Error updating grading scale:', error);
      throw error;
    }
  }
}

module.exports = new GradingService();
