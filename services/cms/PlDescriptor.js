const PlDescriptor = require('../../models/cms/content/plDescriptor'); // Assuming your model is in a 'models' folder

// Define the service layer
class PlDescriptorService {
  // Find descriptor by score
  async findByScore(score) {
    try {
      return await PlDescriptor.findByScore(score);
    } catch (error) {
      throw new Error(error.message);
    }
  }

  // Create a new descriptor
  async createDescriptor(data) {
    try {
      const {mark, score, description, description_swahili} = data;

      // Create a new plDescriptor document
      const descriptor = new PlDescriptor({mark, score, description, description_swahili});
      return await descriptor.save();
    } catch (error) {
      throw new Error(error.message);
    }
  }

  // Get all descriptors
  async getAllDescriptors() {
    try {
      return await PlDescriptor.find().sort({marks: 1});
    } catch (error) {
      throw new Error(error.message);
    }
  }
  async getAllDescriptorsByLanguage(language = 'english') {
    try {
      const descriptors = await PlDescriptor.find().sort({mark: -1});

      return descriptors.map(descriptor => ({
        mark: descriptor.mark,
        score: descriptor.score,
        description: language === 'swahili' ? descriptor.description_swahili : descriptor.description,
      }));
    } catch (error) {
      throw new Error(error.message);
    }
  }

  // Update descriptor by ID
  async updateDescriptor(id, data) {
    try {
      const updatedDescriptor = await PlDescriptor.findByIdAndUpdate(id, data, {new: true});
      if (!updatedDescriptor) {
        throw new Error('Descriptor not found.');
      }
      return updatedDescriptor;
    } catch (error) {
      throw new Error(error.message);
    }
  }

  // Delete descriptor by ID
  async deleteDescriptor(id) {
    try {
      const deletedDescriptor = await PlDescriptor.findByIdAndDelete(id);
      if (!deletedDescriptor) {
        throw new Error('Descriptor not found.');
      }
      return deletedDescriptor;
    } catch (error) {
      throw new Error(error.message);
    }
  }
}

module.exports = new PlDescriptorService();
