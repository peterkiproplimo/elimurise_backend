const LessonProgress = require('../../models/portal/content/LessonProgress');
const Learner = require('../../models/portal/content/Learner');
const Assessment = require('../../models/portal/content/Asessment');
const mongoose = require('mongoose');
class LessonProgressService {
  async getProgresses(school, stream, session, indicator) {
    try {
      // Find learners matching the school, stream, and session
      const learners = await Learner.find({school, stream, current_session: session});
      const learnerIds = learners.map(enrollment => enrollment._id.toString());

      // Count the number of learners assessed for the given indicator
      const number_of_learners_assessed = await Assessment.countDocuments({
        indicator,
        learner: {$in: learnerIds},
      });

      // Count the total number of learners
      const number_of_learners = await Learner.countDocuments({school, stream, current_session: session});

      // Aggregate to find the most used assessment method
      const methodAggregation = await Assessment.aggregate([
        {
          $match: {
            indicator: new mongoose.Types.ObjectId(indicator), // Ensure ObjectId type
            learner: {$in: learnerIds.map(id => new mongoose.Types.ObjectId(id))},
            method: {$ne: null}, // Exclude documents where method is null
            // Convert learnerIds to ObjectId
          },
        },
        {
          $group: {
            _id: '$method',
            count: {$sum: 1},
          },
        },
        {
          $sort: {count: -1},
        },
        {
          $limit: 1,
        },
      ]);
      console.log(methodAggregation);

      // Extract the most used method (if any)
      const most_used_method = methodAggregation.length > 0 ? methodAggregation[0]._id : null;

      return {
        number_of_learners_assessed,
        number_of_learners,
        most_used_method,
      };
    } catch (error) {
      console.error(error);
      throw new Error('Failed to fetch lesson progresses');
    }
  }
}

module.exports = new LessonProgressService();
