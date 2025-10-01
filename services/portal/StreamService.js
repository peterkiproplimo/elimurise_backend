const Enrollment = require('../../models/portal/content/Enrollment');
const Stream = require('../../models/portal/content/Stream');

class StreamService {
  async getStreams(page = 1, limit = 10, searchQuery = {}) {
    try {
      const skip = (page - 1) * limit;

      // Fetch streams with pagination
      const streams = await Stream.find(searchQuery)
        .populate('class_manager section_head')
        .skip(skip)
        .limit(limit)
        .exec();
      console.log(searchQuery);
      // Count total streams matching the query
      const totalStreams = await Stream.countDocuments(searchQuery);

      // Calculate total pages
      const totalPages = Math.ceil(totalStreams / limit);

      // Return paginated result
      return {
        data: streams,
        pagination: {
          current_page: page,
          total: totalStreams,
          total_pages: totalPages,
          per_page: limit,
        },
      };
    } catch (error) {
      console.log(error);
      throw new Error('Failed to fetch streams');
    }
  }

  async searchStreams(query, page = 1, limit = 10) {
    try {
      const searchRegex = new RegExp(query, 'i');
      const searchQuery = {
        name: {$regex: searchRegex},
        // Add more fields to search here if needed
      };
      return await this.getStreams(page, limit, searchQuery);
    } catch (error) {
      throw new Error('Failed to search streams');
    }
  }
  async isStreamNameUnique(name, school) {
    try {
      const existingStream = await Stream.findOne({name, school: school});
      return !existingStream; // Return true if stream name is unique, false if not
    } catch (error) {
      throw new Error('Error checking stream name uniqueness');
    }
  }
  async isStreamNameUniqueGrade(name, grade, school) {
    try {
      const existingStream = await Stream.findOne({name, grade, school: school});
      return !existingStream; // Return true if stream name is unique, false if not
    } catch (error) {
      throw new Error('Error checking stream name uniqueness');
    }
  }
  async getStream(id, school) {
    try {
      const existingStream = await Stream.findOne({_id: id, school: school});
      return !existingStream; // Return true if stream name is unique, false if not
    } catch (error) {
      throw new Error('Error checking stream name uniqueness');
    }
  }
  async getStreamByGrade(data) {
    try {
      const existingStream = await Stream.find(data);
      return existingStream; // Return true if stream name is unique, false if not
    } catch (error) {
      throw new Error('Error checking stream name uniqueness');
    }
  }
  async createStream(data) {
    try {
      const stream = new Stream(data);
      const savedStream = await stream.save();
      return savedStream;
    } catch (error) {
      console.log(error);
      throw new Error('Failed to create stream');
    }
  }
  //wwd
  async updateStream(id, data) {
    try {
      const stream = await Stream.findByIdAndUpdate(id, data, {new: true});
      return stream;
    } catch (error) {
      throw new Error('Failed to update stream');
    }
  }
  async getStream(id) {
    try {
      const deletedStream = await Stream.findById(id);
      return deletedStream;
    } catch (error) {
      throw new Error('Failed to find stream');
    }
  }
  async deleteStream(id) {
    try {
      const enrollment = await Enrollment.findOne({
        $or: [{to_stream: id}, {from_stream: id}],
      });
      if (enrollment) {
        throw new Error('Failed to delete stream linked with learners history');
      }
      const deletedStream = await Stream.findByIdAndDelete(id);

      return deletedStream;
    } catch (error) {
      throw error;
    }
  }
}

module.exports = StreamService;
