const School = require('../../models/portal/content/School');
const mongoose = require('mongoose');

class SchoolService {
  async getSchools1(page = 1, limit = 10, searchQuery = {}) {
    try {
      const skip = (page - 1) * limit;
      console.log(searchQuery);
      // Fetch schools with pagination
      const schools = await School.find(searchQuery)
        .populate('pricing_package')
        // .populate('administrators')
        .skip(skip)
        .limit(limit)
        .exec();

      // Count total schools matching the query
      const totalSchools = await School.countDocuments(searchQuery);

      // Calculate total pages
      const totalPages = Math.ceil(totalSchools / limit);

      // Return paginated result
      return {
        data: schools,
        pagination: {
          current_page: page,
          total: totalSchools,
          total_pages: totalPages,
          per_page: limit,
        },
      };
    } catch (error) {
      console.error(error);
      throw new Error('Failed to fetch schools');
    }
  }

  async getSchools(page = 1, limit = 10, searchQuery = {}) {
    try {
      page = parseInt(page, 10);
      limit = parseInt(limit, 10);

      const skip = (page - 1) * limit;

      // Perform aggregation with optional search query
      const results = await School.aggregate([
        // Match with the search query if provided
        {
          $match: searchQuery,
        },
        // Join with Learner collection
        {
          $lookup: {
            from: 'learners', // MongoDB collection name for Learner model
            localField: '_id',
            foreignField: 'school', // Adjust to match your schema
            as: 'learners',
          },
        },
        // Filter learners with status "C"
        {
          $addFields: {
            totalLearners: {
              $filter: {
                input: '$learners',
                as: 'learner',
                cond: {$eq: ['$$learner.status', 'P']},
              },
            },
          },
        },
        // Project only the necessary fields
        {
          $project: {
            _id: 1, // Explicitly include the fields you want (or use `school.*` for all fields)
            name: 1,
            county: 1,
            subcounty: 1,
            zone: 1,
            schoolCode: 1,
            logo: 1,
            address: 1,
            numberOfLearners: 1,
            current_term: 1,
            current_session: 1,
            pricing_package: 1,
            administrators: 1,
            teachers: 1,
            students: 1,
            createdAt: 1,
            updatedAt: 1,
            active: 1,
            totalLearners: {$size: '$totalLearners'}, // Adds the calculated total learners count
          },
        },
        // Pagination with $facet
        {$sort: {createdAt: -1}},

        {
          $facet: {
            metadata: [{$count: 'total'}],
            data: [{$skip: skip}, {$limit: limit}],
          },
        },
      ]);

      // Extract metadata and calculate pagination info
      const metadata = results[0].metadata[0] || {total: 0};
      const totalPages = Math.ceil(metadata.total / limit);

      return {
        data: results[0].data,
        pagination: {
          current_page: page,
          total: metadata.total,
          total_pages: totalPages,
          per_page: limit,
        },
      };
    } catch (error) {
      console.error('Error in getSchools:', error);
      throw error;
    }
  }

  async getSchoolsCountByCounty() {
    try {
      const result = await School.aggregate([
        {
          $group: {
            _id: '$county', // Group by county
            count: {$sum: 1}, // Count each school in the group
          },
        },
        {
          $project: {
            _id: 0,
            county: '$_id', // Rename _id to county
            count: 1,
          },
        },
        {
          $sort: {count: -1}, // Sort by count in descending order
        },
      ]);

      return result;
    } catch (error) {
      console.error('Error generating dashboard analysis:', error);
      throw error;
    }
  }

  async searchSchools(query, page = 1, limit = 10) {
    try {
      const searchRegex = new RegExp(query, 'i');
      const searchQuery = {
        name: {$regex: searchRegex},
        // Add more fields to search here if needed
      };
      return await this.getSchools(page, limit, searchQuery);
    } catch (error) {
      throw new Error('Failed to search schools');
    }
  }

  async createSchool(data, session) {
    try {
      const school = new School(data);
      const savedSchool = await school.save({session});
      return savedSchool;
    } catch (error) {
      throw new Error('Failed to create school');
    }
  }

  async updateSchool(id, data) {
    try {
      const existingSchool = await School.findById(id);
      if (!existingSchool) {
        throw new Error('School not found');
      }

      // Clean and validate the data before updating
      const cleanedData = {};
      Object.keys(data).forEach(key => {
        if (data[key] !== undefined && data[key] !== null) {
          // Handle ObjectId arrays specifically
          if (['administrators', 'teachers', 'students'].includes(key)) {
            if (Array.isArray(data[key])) {
              // Filter out empty strings and invalid values, keep only valid ObjectIds
              const validIds = data[key].filter(item => 
                item && 
                item !== '' && 
                item !== '""' && 
                item !== '[]' && 
                mongoose.Types.ObjectId.isValid(item)
              );
              cleanedData[key] = validIds;
            } else if (typeof data[key] === 'string') {
              // If it's a string, try to parse it as JSON array
              try {
                const parsed = JSON.parse(data[key]);
                if (Array.isArray(parsed)) {
                  const validIds = parsed.filter(item => 
                    item && 
                    item !== '' && 
                    item !== '""' && 
                    item !== '[]' && 
                    mongoose.Types.ObjectId.isValid(item)
                  );
                  cleanedData[key] = validIds;
                }
              } catch (e) {
                // If parsing fails, set to empty array
                cleanedData[key] = [];
              }
            } else {
              // If it's not an array or string, set to empty array
              cleanedData[key] = [];
            }
          } else {
            // For non-ObjectId array fields, assign as is
            cleanedData[key] = data[key];
          }
        }
      });

      // Update only the provided fields while keeping the rest unchanged
      Object.keys(cleanedData).forEach(key => {
        existingSchool[key] = cleanedData[key];
      });

      await existingSchool.save();
      return existingSchool;
    } catch (error) {
      console.log(error.message);
      throw new Error('Failed to update school');
    }
  }
  async getschool(id) {
    try {
      const school = await School.findById(id);
      return school;
    } catch (error) {
      throw new Error('Failed to update school');
    }
  }
  async deleteSchool(id) {
    try {
      const deletedSchool = await School.findByIdAndDelete(id);
      return deletedSchool;
    } catch (error) {
      throw new Error('Failed to delete school');
    }
  }
}

module.exports = SchoolService;
