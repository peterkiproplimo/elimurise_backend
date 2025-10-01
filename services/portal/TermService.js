const Term = require('../../models/portal/content/Term');

class TermService {
  async getTerms(page = 1, limit = 10, searchQuery = {}) {
    try {
      const skip = (page - 1) * limit;
      const terms = await Term.find(searchQuery).populate('session').skip(skip).limit(limit).exec();
      const totalTerms = await Term.countDocuments(searchQuery);

      // Calculate total pages
      const totalPages = Math.ceil(totalTerms / limit);

      // Return data with pagination metadata
      return {
        data: terms,
        pagination: {
          current_page: page,
          total: totalTerms,
          total_pages: totalPages,
          per_page: limit,
        },
      };
    } catch (error) {
      console.log(error);
      throw new Error('Failed to fetch terms');
    }
  }
  async searchTerms(query, page = 1, limit = 10) {
    try {
      const searchRegex = new RegExp(query, 'i');
      const searchQuery = {
        name: {$regex: searchRegex},
        // Add more fields to search here if needed
      };
      return await this.getTerms(page, limit, searchQuery);
    } catch (error) {
      throw new Error('Failed to search terms');
    }
  }

  async createTerm(data) {
    try {
      const term = new Term(data);
      const savedTerm = await term.save();
      return savedTerm;
    } catch (error) {
      throw new Error('Failed to create term');
    }
  }
  async getTermBysession(session) {
    try {
      const existingTerms = await Term.find({
        session,
      });
      return existingTerms;
    } catch (error) {
      throw new Error('Failed to fetch');
    }
  }
  async getOverlapping(data) {
    try {
      const {startDate, endDate, session} = data;
      const existingTerms = await Term.find({
        session: session,
        $or: [
          {startDate: {$lt: endDate}, endDate: {$gt: startDate}}, // Check for overlaps
          {startDate: {$gte: startDate, $lte: endDate}}, // Check if one period is within another
          {endDate: {$gte: startDate, $lte: endDate}},
        ],
      });
      return existingTerms;
    } catch (error) {
      throw new Error('Failed to fetch');
    }
  }

  async updateTerm(id, data) {
    try {
      const term = await Term.findByIdAndUpdate(id, data, {new: true});
      return term;
    } catch (error) {
      throw new Error('Failed to update term');
    }
  }
  async getTermById(id) {
    try {
      const term = await Term.findById(id);
      return term;
    } catch (error) {
      console.log(error);
      throw new Error('Failed to get term by ID');
    }
  }
  async deleteTerm(id) {
    try {
      const deletedTerm = await Term.findByIdAndDelete(id);
      return deletedTerm;
    } catch (error) {
      throw new Error('Failed to delete term');
    }
  }
}

module.exports = TermService;
