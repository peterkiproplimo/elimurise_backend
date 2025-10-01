const SchoolLearningAreaAssignment = require('../../models/portal/content/school_learning_area_assignment');
const LearningArea = require('../../models/cms/content/learning_area');
const logger = require('../../utils/logger');

class SchoolLearningAreaService {
  /**
   * Get available non-global learning areas for selection
   * @param {string} schoolId - School ID
   * @param {string} gradeId - Optional grade ID filter
   * @returns {Promise<Array>} Array of available learning areas
   */
  async getAvailableLearningAreas(schoolId, gradeId = null) {
    try {
      const query = { is_compulsory: false };
      if (gradeId) {
        query.grade_id = gradeId;
      }

      return await LearningArea.find(query)
        .populate('grade_id', 'name')
        .sort({ name: 1 });
    } catch (error) {
      logger.error(`Error getting available learning areas: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get selected learning areas for a school
   * @param {string} schoolId - School ID
   * @param {string} gradeId - Optional grade ID filter
   * @returns {Promise<Array>} Array of assignments with populated learning areas
   */
  async getSelectedLearningAreas(schoolId, gradeId = null) {
    try {
      return await SchoolLearningAreaAssignment.getSchoolLearningAreas(schoolId, gradeId);
    } catch (error) {
      logger.error(`Error getting selected learning areas: ${error.message}`);
      throw error;
    }
  }

  /**
   * Select learning areas for a school
   * @param {string} schoolId - School ID
   * @param {Array<string>} learningAreaIds - Array of learning area IDs
   * @param {string} gradeId - Grade ID
   * @returns {Promise<Array>} Array of created assignments
   */
  async selectLearningAreas(schoolId, learningAreaIds, gradeId) {
    try {
      // Validate that all learning areas exist and are non-global
      const availableLearningAreas = await LearningArea.find({
        _id: { $in: learningAreaIds },
        is_compulsory: false
      });

      if (availableLearningAreas.length !== learningAreaIds.length) {
        throw new Error('Some learning areas are not available for selection');
      }

      return await SchoolLearningAreaAssignment.assignLearningAreas(schoolId, learningAreaIds, gradeId);
    } catch (error) {
      logger.error(`Error selecting learning areas: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update a learning area selection
   * @param {string} assignmentId - Assignment ID
   * @param {string} schoolId - School ID (for security)
   * @param {Object} updateData - Data to update
   * @returns {Promise<Object>} Updated assignment
   */
  async updateSelection(assignmentId, schoolId, updateData) {
    try {
      const assignment = await SchoolLearningAreaAssignment.findOne({
        _id: assignmentId,
        school: schoolId
      });

      if (!assignment) {
        throw new Error('Selection not found or not accessible');
      }

      const updatedAssignment = await SchoolLearningAreaAssignment.findByIdAndUpdate(
        assignmentId,
        updateData,
        { new: true }
      ).populate('learning_area').populate('grade_id', 'name');

      return updatedAssignment;
    } catch (error) {
      logger.error(`Error updating selection: ${error.message}`);
      throw error;
    }
  }

  /**
   * Remove a learning area selection
   * @param {string} assignmentId - Assignment ID
   * @param {string} schoolId - School ID (for security)
   * @returns {Promise<boolean>} Success status
   */
  async removeSelection(assignmentId, schoolId) {
    try {
      const assignment = await SchoolLearningAreaAssignment.findOne({
        _id: assignmentId,
        school: schoolId
      });

      if (!assignment) {
        throw new Error('Selection not found or not accessible');
      }

      await SchoolLearningAreaAssignment.findByIdAndDelete(assignmentId);
      return true;
    } catch (error) {
      logger.error(`Error removing selection: ${error.message}`);
      throw error;
    }
  }

  /**
   * Bulk remove selections
   * @param {Array<string>} assignmentIds - Array of assignment IDs
   * @param {string} schoolId - School ID (for security)
   * @returns {Promise<number>} Number of removed assignments
   */
  async bulkRemoveSelections(assignmentIds, schoolId) {
    try {
      const assignments = await SchoolLearningAreaAssignment.find({
        _id: { $in: assignmentIds },
        school: schoolId
      });

      if (assignments.length !== assignmentIds.length) {
        throw new Error('Some selections not found or not accessible');
      }

      await SchoolLearningAreaAssignment.deleteMany({
        _id: { $in: assignmentIds },
        school: schoolId
      });

      return assignments.length;
    } catch (error) {
      logger.error(`Error bulk removing selections: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get learning areas with selection status for a school
   * @param {string} schoolId - School ID
   * @param {string} gradeId - Optional grade ID filter
   * @returns {Promise<Object>} Object with available and selected learning areas
   */
  async getLearningAreasWithSelectionStatus(schoolId, gradeId = null) {
    try {
      const availableLearningAreas = await this.getAvailableLearningAreas(schoolId, gradeId);
      const selectedLearningAreas = await this.getSelectedLearningAreas(schoolId, gradeId);

      const selectedIds = selectedLearningAreas.map(assignment => assignment.learning_area._id.toString());
      const unselectedLearningAreas = availableLearningAreas.filter(
        la => !selectedIds.includes(la._id.toString())
      );

      return {
        available: unselectedLearningAreas,
        selected: selectedLearningAreas
      };
    } catch (error) {
      logger.error(`Error getting learning areas with selection status: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get statistics for a school's learning area selections
   * @param {string} schoolId - School ID
   * @returns {Promise<Object>} Statistics object
   */
  async getSchoolLearningAreaStats(schoolId) {
    try {
      const [totalSelected, totalAvailable, totalGlobal, totalNonGlobal] = await Promise.all([
        SchoolLearningAreaAssignment.countDocuments({ school: schoolId }),
        LearningArea.countDocuments({ is_compulsory: false }),
        LearningArea.countDocuments({ is_compulsory: true }),
        LearningArea.countDocuments({ is_compulsory: false })
      ]);

      return {
        totalSelected,
        totalAvailable: totalNonGlobal,
        totalGlobal,
        totalNonGlobal,
        unselected: totalNonGlobal - totalSelected
      };
    } catch (error) {
      logger.error(`Error getting school learning area stats: ${error.message}`);
      throw error;
    }
  }
}

module.exports = SchoolLearningAreaService; 