const AssessmentGrading = require('../../models/portal/content/GradingSystem'); // Update the path as necessary

class AssessmentGradingService {
  // Create a new AssessmentGrading
  async createAssessmentGrading(data) {
    const assessmentGrading = new AssessmentGrading(data);
    await assessmentGrading.save();
    return assessmentGrading;
  }
  async addLearningArea(assessmentGradingId, learningAreaData) {
    try {
      const {learning_area, gradings} = learningAreaData;

      // Find the Assessment Grading by ID
      const assessmentGrading = await AssessmentGrading.findById(assessmentGradingId);
      if (!assessmentGrading) {
        throw new Error('Assessment Grading not found');
      }

      // Check if the learning area already exists
      const existingLearningArea = assessmentGrading.learningAreas.find(
        la => la.learning_area.toString() === learning_area.toString(),
      );
      if (existingLearningArea) {
        throw new Error('Learning area already exists');
      }

      // Add the new learning area
      assessmentGrading.learningAreas.push({learning_area, gradings});

      // Save the updated assessment grading
      await assessmentGrading.save();
      return assessmentGrading;
    } catch (error) {
      throw new Error(`Error adding learning area: ${error.message}`);
    }
  }

  async updateLearningArea(assessmentGradingId, learningAreaId, updatedLearningAreaData) {
    try {
      const {learning_area, gradings} = updatedLearningAreaData;

      // Find the Assessment Grading by ID
      const assessmentGrading = await AssessmentGrading.findById(assessmentGradingId);
      if (!assessmentGrading) {
        throw new Error('Assessment Grading not found');
      }

      // Find the learning area to update
      const learningArea = assessmentGrading.learningAreas.find(
        area => area._id.toString() === learningAreaId.toString(),
      );
      if (!learningArea) {
        throw new Error('Learning area not found');
      }

      // Update the learning area details
      if (learning_area) {
        learningArea.learning_area = learning_area;
      }
      if (gradings) {
        learningArea.gradings = gradings;
      }

      // Save the updated assessment grading
      await assessmentGrading.save();
      return assessmentGrading;
    } catch (error) {
      throw new Error(`Error updating learning area: ${error.message}`);
    }
  }

  // Get all AssessmentGradings
  async getAllAssessmentGradings(query, page = 1, limit) {
    // Convert page to integer
    page = parseInt(page, 10);

    // Calculate the number of documents to skip based on the current page
    const skip = (page - 1) * (limit || 0); // No skip if no limit

    // Get the total number of documents that match the query
    const totalAssessmentGradings = await AssessmentGrading.countDocuments(query);

    // Fetch paginated data (or all documents if no limit is provided)
    let assessmentGradingsQuery = AssessmentGrading.find(query)
      .populate('learningAreas.learning_area grade')
      .skip(skip);

    if (limit) {
      assessmentGradingsQuery = assessmentGradingsQuery.limit(parseInt(limit, 10));
    }

    const assessmentGradings = await assessmentGradingsQuery;

    // Calculate the total number of pages if limit is provided
    const totalPages = limit ? Math.ceil(totalAssessmentGradings / limit) : 1;

    // Return the result with pagination
    return {
      data: assessmentGradings,
      pagination: {
        current_page: page,
        total: totalAssessmentGradings,
        total_pages: totalPages,
        per_page: limit || totalAssessmentGradings, // If no limit, return total count
      },
    };
  }

  // Get an AssessmentGrading by ID
  async getAssessmentGradingById(id) {
    return AssessmentGrading.findById(id).populate('learningAreas.learning_area grade');
  }

  // Update an AssessmentGrading by ID
  async updateAssessmentGrading(id, data) {
    return AssessmentGrading.findByIdAndUpdate(id, {name: data.name}, {new: true}).populate(
      'learningAreas.learning_area',
    );
  }

  // Delete an AssessmentGrading by ID
  async deleteAssessmentGrading(id, school) {
    return AssessmentGrading.findByIdAndDelete(id);
  }

  // Get Grading by Learning Area and Score
  async getGradingByLearningAreaAndScore(gradingId, learningAreaId, score) {
    const assessmentGrading = await AssessmentGrading.findById(gradingId).populate('');
    if (!assessmentGrading) {
      throw new Error('Assessment grading not found.');
    }

    const learningArea = assessmentGrading.learningAreas.find(
      area => area.learning_area.toString() === learningAreaId.toString(),
    );
    if (!learningArea) {
      throw new Error('Learning area not found.');
    }

    const grading = learningArea.gradings.find(grading => grading.minScore <= score && grading.maxScore >= score);
    if (!grading) {
      throw new Error(`Grading with score ${score} not found in learning area.`);
    }

    return grading;
  }

  // Update Grading Description in a Learning Area
  async updateGradingDescription(learningAreaId, minScore, maxScore, newDescription) {
    const assessmentGrading = await AssessmentGrading.findOne({
      'learningAreas.learning_area': learningAreaId,
      'learningAreas.gradings': {
        $elemMatch: {
          minScore: {$lte: minScore},
          maxScore: {$gte: maxScore},
        },
      },
    });

    if (!assessmentGrading) {
      throw new Error('Assessment grading not found.');
    }

    // Find the specific grading within the learning area
    const learningArea = assessmentGrading.learningAreas.find(area => area.learning_area.toString() === learningAreaId);
    if (!learningArea) {
      throw new Error('Learning area not found.');
    }

    const grading = learningArea.gradings.find(grading => grading.minScore <= minScore && grading.maxScore >= maxScore);
    if (!grading) {
      throw new Error(`Grading with score range ${minScore} - ${maxScore} not found in learning area.`);
    }

    grading.description = newDescription;

    await assessmentGrading.save();
    return assessmentGrading;
  }

  // Get Assessment Gradings by Academic Year
  async getAssessmentGradingsBysession(sessionId) {
    return AssessmentGrading.find({session: sessionId}).populate('session learningAreas.learning_area');
  }
}

module.exports = new AssessmentGradingService();
