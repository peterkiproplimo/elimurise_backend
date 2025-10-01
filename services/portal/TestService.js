const SummativeAssessment = require('../../models/portal/content/SummativeAssessment');
const Test = require('../../models/portal/content/Test'); // Adjust the path as necessary

class TestService {
  async createTest(data) {
    try {
      const test = new Test(data);
      await test.save();
      return test;
    } catch (error) {
      throw error;
    }
  }
  async setTestPublishStatus(testId) {
    try {
      // Validate test ID
      if (!testId) {
        throw new Error('Test ID is required');
      }

      // Verify test exists
      const test = await Test.findById(testId);
      if (!test) {
        throw new Error('Test not found');
      }
      //check if as records SummativeAssessment befor publishing
      const assessments = await SummativeAssessment.find({test: testId});
      if (assessments.length === 0) {
        throw new Error('No assessments found for this test');
      }
      // Get current publish status and toggle it
      const newPublishStatus = !test.isPublished;

      // Update test with new publish status
      await Test.findByIdAndUpdate(testId, {isPublished: newPublishStatus});

      // Update all assessments for this test with the toggled publish status
      // await SummativeAssessment.updateMany({testId: testId}, {isPublished: newPublishStatus});

      return `Successfully ${newPublishStatus ? 'published' : 'unpublished'} test and its assessments`;
    } catch (error) {
      throw error;
    }
  }
  async getTests(filter = {}) {
    try {
      return await Test.find(filter).populate('session').populate('term').populate('grade').populate('grading');
    } catch (error) {
      throw error;
    }
  }

  async getTestById(id) {
    try {
      return await Test.findById(id).populate('session').populate('term').populate('grade');
    } catch (error) {
      throw error;
    }
  }
  async getTestByIdOnly(id) {
    try {
      return await Test.findById(id);
    } catch (error) {
      throw error;
    }
  }
  async updateTest(id, data, school) {
    try {
      // Allow all fields to be updated
      return await Test.findByIdAndUpdate(id, data, {new: true});
    } catch (error) {
      throw error;
    }
  }

  async deleteTest(id, school) {
    try {
      const assessments = await SummativeAssessment.findOne({test: id});
      if (assessments) {
        throw new Error('Cannot delete test linked linked with results');
      }
      return await Test.findOneAndDelete({_id: id, school});
    } catch (error) {
      throw error;
    }
  }
  async deleteTestAdmin(id) {
    try {
      const assessments = await SummativeAssessment.findOne({test: id});

      if (assessments) {
        throw new Error('Cannot delete test linked linked with results');
      }
      return await Test.findOneAndDelete({_id: id});
    } catch (error) {
      throw error;
    }
  }
}

module.exports = new TestService();
