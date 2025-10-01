const AcademicYear = require('../../models/portal/content/AcademicYear');
const mongoosePaginate = require('mongoose-paginate-v2');
const Term = require('../../models/portal/content/Term');

class AcademicYearService {
  async getAcademicYears(page = 1, limit = 10, searchQuery = {}) {
    try {
      const totalAcademicYears = await AcademicYear.countDocuments(searchQuery);
      const skip = (page - 1) * limit;

      const data = await AcademicYear.find(searchQuery).skip(skip).limit(limit).exec();

      const totalPages = Math.ceil(totalAcademicYears / limit);

      return {
        data,
        pagination: {
          current_page: page,
          total: totalAcademicYears,
          total_pages: totalPages,
          per_page: limit,
        },
      };
    } catch (error) {
      console.log(error);
      throw new Error('Failed to fetch academic years');
    }
  }

  async searchAcademicYears(query, page = 1, limit = 10) {
    try {
      const searchRegex = new RegExp(query, 'i');
      const searchQuery = {
        $or: [
          {name: {$regex: searchRegex}},
          // Add more fields to search here
        ],
      };
      return await this.getAcademicYears(page, limit, searchQuery);
    } catch (error) {
      throw new Error('Failed to search academic years');
    }
  }
  async hasAcademicYearOnSamePeriod({school, startDate, endDate}) {
    try {
      const accardemicYear = await AcademicYear.find({
        school,
        $or: [
          {startDate: {$lt: endDate}, endDate: {$gt: startDate}}, // Check for overlaps
          {startDate: {$gte: startDate, $lte: endDate}}, // Check if one period is within another
          {endDate: {$gte: startDate, $lte: endDate}},
        ],
      });

      return accardemicYear;
    } catch (error) {
      throw new Error('Failed to create academic year');
    }
  }

  async createAcademicYear(data) {
    try {
      const academicYear = new AcademicYear(data);
      const savedAcademicYear = await academicYear.save();
      if (savedAcademicYear) {
        await Term.create([
          {
            name: 'Term 1',
            academicYear: savedAcademicYear._id,
          },
          {
            name: 'Term 2',
            academicYear: savedAcademicYear._id,
          },
          {
            name: 'Term 3',
            academicYear: savedAcademicYear._id,
          },
        ]);
      }

      return savedAcademicYear;
    } catch (error) {
      console.log(error);
      throw new Error('Failed to create academic year');
    }
  }

  async updateAcademicYear(id, data) {
    try {
      const academicYear = await AcademicYear.findByIdAndUpdate(id, data, {
        new: true,
      });
      return academicYear;
    } catch (error) {
      throw new Error('Failed to update academic year');
    }
  }
  async getAcademicYear(id) {
    try {
      const academicYear = await AcademicYear.findById(id);
      return academicYear;
    } catch (error) {
      console.log(id);
      throw new Error('Invalid academic year id provided');
    }
  }
  async deleteAcademicYear(id) {
    try {
      const deletedAcademicYear = await AcademicYear.findByIdAndDelete(id);
      return deletedAcademicYear;
    } catch (error) {
      throw new Error('Failed to delete academic year');
    }
  }
}

module.exports = AcademicYearService;
