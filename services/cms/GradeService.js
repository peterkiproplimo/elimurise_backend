const Grade = require('../../models/cms/content/grade');

class GradeService {
  // Method to create a new grade
  static async createGrade(level_id, name, status = 0, level = 0) {
    try {
      const newGrade = new Grade({
        level_id,
        name,
        status,
        level,
      });
      const savedGrade = await newGrade.save();
      return savedGrade;
    } catch (error) {
      throw new Error(`Error creating grade: ${error.message}`);
    }
  }

  // Method to retrieve all grades
  static async getAllGrades() {
    try {
      const grades = await Grade.find();
      return grades;
    } catch (error) {
      throw new Error(`Error fetching grades: ${error.message}`);
    }
  }

  // Method to retrieve a grade by its ID
  static async getGradeById(gradeId) {
    try {
      const grade = await Grade.findById(gradeId);
      return grade;
    } catch (error) {
      throw new Error(`Error fetching grade: ${error.message}`);
    }
  }

  // Method to update a grade by its ID
  static async updateGrade(gradeId, updateData) {
    try {
      const updatedGrade = await Grade.findByIdAndUpdate(gradeId, updateData, {new: true});
      return updatedGrade;
    } catch (error) {
      throw new Error(`Error updating grade: ${error.message}`);
    }
  }

  // Method to delete a grade by its ID
  static async deleteGrade(gradeId) {
    try {
      await Grade.findByIdAndDelete(gradeId);
      return {message: 'Grade deleted successfully'};
    } catch (error) {
      throw new Error(`Error deleting grade: ${error.message}`);
    }
  }
}

module.exports = GradeService;
