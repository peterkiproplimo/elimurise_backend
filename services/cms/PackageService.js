const PricingPackage = require('../../models/cms/content/PricingPackage');

class PackageService {
  // Constructor
  constructor() {}

  // Create a new pricingPackage
  async createPackage(pricingPackageData) {
    try {
      const newPackage = new PricingPackage(pricingPackageData);
      const savedPackage = await newPackage.save();
      return savedPackage;
    } catch (error) {
      throw error;
    }
  }
  async doesPackageExist(name) {
    try {
      const existingPackage = await PricingPackage.findOne({name});
      return existingPackage; // Return true if package exists, false otherwise
    } catch (error) {
      throw error;
    }
  }
  // Get a pricingPackage by ID
  async getPackageById(pricingPackageId) {
    try {
      const pricingPackage = await PricingPackage.findById(pricingPackageId);
      return pricingPackage;
    } catch (error) {
      throw error;
    }
  }

  // Update a pricingPackage
  async updatePackage(pricingPackageId, updates) {
    try {
      const updatedPackage = await PricingPackage.findByIdAndUpdate(pricingPackageId, updates, {new: true});
      return updatedPackage;
    } catch (error) {
      throw error;
    }
  }

  // Delete a pricingPackage
  async deletePackage(pricingPackageId) {
    try {
      const deletedPackage = await PricingPackage.findByIdAndDelete(pricingPackageId);
      return deletedPackage;
    } catch (error) {
      throw error;
    }
  }

  // Get paginated pricingPackages
  async getPaginatedPackages(page = 1, limit = 10, query = {}) {
    try {
      const skip = (page - 1) * limit;
      const totalPackages = await PricingPackage.countDocuments(query);
      const data = await PricingPackage.find(query).skip(skip).limit(limit).exec();
      const totalPages = Math.ceil(totalPackages / limit);
      return {
        data,
        pagination: {
          current_page: page,
          total: totalPackages,
          total_pages: totalPages,
          per_page: limit,
        },
      };
    } catch (error) {
      throw error;
    }
  }
}

module.exports = PackageService;
