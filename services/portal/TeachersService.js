const Teacher = require('../../models/portal/content/Teacher');
const GradeUserAssignment = require('../../models/portal/content/grade_teacher_asigment');
const PortalUser = require('../../models/portal/auth/User');
class TeacherService {
  async getTeachers(page = 1, limit = 10, searchQuery = {}, sortField, sortDirection) {
    try {
      const skip = (page - 1) * limit;

      console.log(sortDirection);
      // Apply sorting only if sortField is provided
      const sort = sortField ? {[sortField]: sortDirection === 'desc' ? -1 : 1} : {};
      console.log(sort);
      // Fetch teachers with pagination (apply sorting only if needed)
      const teachers = await Teacher.find(searchQuery)
        .sort(sort) // Sorting is optional now
        .skip(skip)
        .limit(limit)
        .exec();

      // Count total teachers matching the query
      const totalTeachers = await Teacher.countDocuments(searchQuery);

      // Calculate total pages
      const totalPages = Math.ceil(totalTeachers / limit);

      // Return paginated result
      return {
        data: teachers,
        pagination: {
          current_page: page,
          total: totalTeachers,
          total_pages: totalPages,
          per_page: limit,
        },
      };
    } catch (error) {
      console.error(error);
      throw new Error('Failed to fetch teachers');
    }
  }

  async searchTeachers(query, page = 1, limit = 10) {
    try {
      const searchRegex = new RegExp(query, 'i');
      const searchQuery = {
        $or: [
          {first_name: {$regex: searchRegex}},
          {last_name: {$regex: searchRegex}},
          {surname: {$regex: searchRegex}},
          // Add more fields to search here
        ],
      };
      return await this.getTeachers(page, limit, searchQuery);
    } catch (error) {
      throw new Error('Failed to search teachers');
    }
  }

  async createTeacher(data, session) {
    try {
      const teacher = new Teacher(data);
      const savedTeacher = await teacher.save({session});
      return savedTeacher;
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      console.log(error);
      throw new Error('Failed to create teacher');
    }
  }
  async getTeacher(id, school) {
    try {
      console.log('teacher', {_id: id, school});
      const teacher = await Teacher.findOne({_id: id, school});
      return teacher;
    } catch (error) {
      consle.log(error);
      throw new Error('Failed to retrive teacher');
    }
  }
  async getAllTeachers(school) {
    try {
      console.log('teacher', {school});
      const teacher = await Teacher.find({school});
      return teacher;
    } catch (error) {
      consle.log(error);
      throw new Error('Failed to retrive teacher');
    }
  }

  async updateTeacher(id, data, school) {
    try {
      const teacher = await Teacher.findByIdAndUpdate({_id: id, school}, data, {new: true});
      return teacher;
    } catch (error) {
      throw new Error('Failed to update teacher');
    }
  }

  async deleteTeacher(id, school) {
    const session = await Teacher.startSession();
    try {
      session.startTransaction();

      // Delete teacher
      const deletedTeacher = await Teacher.findOneAndDelete({_id: id, school}, {session});
      if (!deletedTeacher) {
        throw new Error('Teacher not found');
      }

      // Delete grade assignments for the teacher
      const deletedAssignments = await GradeUserAssignment.deleteMany({user: id}, {session});

      // Delete portal user associated with the teacher
      const deletedPortalUser = await PortalUser.deleteOne({email: deletedTeacher.email}, {session});

      // Commit the transaction
      await session.commitTransaction();
      return deletedTeacher;
    } catch (error) {
      // Abort the transaction in case of an error
      await session.abortTransaction();
      throw new Error('Failed to delete teacher' + error.message);
    } finally {
      session.endSession();
    }
  }
}

module.exports = TeacherService;
