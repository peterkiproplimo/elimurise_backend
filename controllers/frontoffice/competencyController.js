const Competency = require("../../models/frontoffice/Competency");
const Subject = require("../../models/frontoffice/Subject");

// Get all competencies
const getCompetencies = async (req, res) => {
  try {
    const { page = 1, limit = 10, search, category, level, domain, subject } = req.query;
    
    // Build filter object
    const filter = {};
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { code: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { keywords: { $regex: search, $options: 'i' } }
      ];
    }
    if (category) filter.category = category;
    if (level) filter.level = level;
    if (domain) filter.domain = domain;
    if (subject) filter.subject = subject;
    
    const competencies = await Competency.find(filter)
      .populate('subject', 'name code')
      .populate('prerequisites', 'name code')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    const total = await Competency.countDocuments(filter);
    
    res.status(200).json({
      competencies,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
};

// Get single competency
const getCompetency = async (req, res) => {
  try {
    const { id } = req.params;
    const competency = await Competency.findById(id)
      .populate('subject', 'name code')
      .populate('prerequisites', 'name code')
      .populate('createdBy', 'name email');
    
    if (!competency) {
      return res.status(404).json({ message: 'Competency not found' });
    }
    
    res.status(200).json(competency);
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
};

// Create new competency
const createCompetency = async (req, res) => {
  try {
    const competencyData = req.body;
    
    // Check if competency with same code already exists
    const existingCompetency = await Competency.findOne({ 
      code: competencyData.code 
    });
    
    if (existingCompetency) {
      return res.status(400).json({ 
        message: 'Competency with this code already exists' 
      });
    }
    
    // Validate subject if provided and not empty
    if (competencyData.subject && competencyData.subject.trim() !== '') {
      const subject = await Subject.findById(competencyData.subject);
      if (!subject) {
        return res.status(400).json({ 
          message: 'Referenced subject does not exist' 
        });
      }
    } else {
      // Remove subject field if empty to avoid ObjectId casting error
      delete competencyData.subject;
    }
    
    const newCompetency = new Competency({
      ...competencyData,
      createdBy: req.user?.id || req.body.createdBy
    });
    
    const savedCompetency = await newCompetency.save();
    await savedCompetency.populate('subject', 'name code');
    await savedCompetency.populate('prerequisites', 'name code');
    await savedCompetency.populate('createdBy', 'name email');
    
    res.status(201).json(savedCompetency);
  } catch (error) {
    res.status(409).json({ message: error.message });
  }
};

// Update competency
const updateCompetency = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    // Check if updating code conflicts with existing competencies
    if (updateData.code) {
      const existingCompetency = await Competency.findOne({
        _id: { $ne: id },
        code: updateData.code
      });
      
      if (existingCompetency) {
        return res.status(400).json({ 
          message: 'Competency with this code already exists' 
        });
      }
    }
    
    // Validate subject if provided and not empty
    if (updateData.subject && updateData.subject.trim() !== '') {
      const subject = await Subject.findById(updateData.subject);
      if (!subject) {
        return res.status(400).json({ 
          message: 'Referenced subject does not exist' 
        });
      }
    } else {
      // Remove subject field if empty to avoid ObjectId casting error
      delete updateData.subject;
    }
    
    const updatedCompetency = await Competency.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    )
      .populate('subject', 'name code')
      .populate('prerequisites', 'name code')
      .populate('createdBy', 'name email');
    
    if (!updatedCompetency) {
      return res.status(404).json({ message: 'Competency not found' });
    }
    
    res.status(200).json(updatedCompetency);
  } catch (error) {
    res.status(409).json({ message: error.message });
  }
};

// Delete competency
const deleteCompetency = async (req, res) => {
  try {
    const { id } = req.params;
    
    const deletedCompetency = await Competency.findByIdAndDelete(id);
    
    if (!deletedCompetency) {
      return res.status(404).json({ message: 'Competency not found' });
    }
    
    res.status(200).json({ message: 'Competency deleted successfully' });
  } catch (error) {
    res.status(409).json({ message: error.message });
  }
};

// Get competencies by category
const getCompetenciesByCategory = async (req, res) => {
  try {
    const { category } = req.params;
    const competencies = await Competency.find({ 
      category, 
      isActive: true 
    })
      .populate('subject', 'name code')
      .select('name code description level domain')
      .sort({ name: 1 });
    
    res.status(200).json(competencies);
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
};

// Get competencies by level
const getCompetenciesByLevel = async (req, res) => {
  try {
    const { level } = req.params;
    const competencies = await Competency.find({ 
      level, 
      isActive: true 
    })
      .populate('subject', 'name code')
      .select('name code description category domain')
      .sort({ name: 1 });
    
    res.status(200).json(competencies);
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
};

// Get competencies by subject
const getCompetenciesBySubject = async (req, res) => {
  try {
    const { subjectId } = req.params;
    const competencies = await Competency.find({ 
      subject: subjectId, 
      isActive: true 
    })
      .select('name code description level category')
      .sort({ name: 1 });
    
    res.status(200).json(competencies);
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
};

// Toggle competency status
const toggleCompetencyStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const competency = await Competency.findById(id);
    
    if (!competency) {
      return res.status(404).json({ message: 'Competency not found' });
    }
    
    competency.isActive = !competency.isActive;
    competency.status = competency.isActive ? 'active' : 'inactive';
    
    const updatedCompetency = await competency.save();
    await updatedCompetency.populate('subject', 'name code');
    await updatedCompetency.populate('prerequisites', 'name code');
    await updatedCompetency.populate('createdBy', 'name email');
    
    res.status(200).json(updatedCompetency);
  } catch (error) {
    res.status(409).json({ message: error.message });
  }
};

// Get competency statistics
const getCompetencyStats = async (req, res) => {
  try {
    const stats = await Competency.aggregate([
      {
        $group: {
          _id: null,
          totalCompetencies: { $sum: 1 },
          activeCompetencies: {
            $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] }
          },
          averageScore: { $avg: '$averageScore' }
        }
      }
    ]);
    
    const categoryStats = await Competency.aggregate([
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 }
        }
      }
    ]);
    
    const levelStats = await Competency.aggregate([
      {
        $group: {
          _id: '$level',
          count: { $sum: 1 }
        }
      }
    ]);
    
    res.status(200).json({
      overall: stats[0] || { totalCompetencies: 0, activeCompetencies: 0, averageScore: 0 },
      byCategory: categoryStats,
      byLevel: levelStats
    });
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
};

module.exports = {
  getCompetencies,
  getCompetency,
  createCompetency,
  updateCompetency,
  deleteCompetency,
  getCompetenciesByCategory,
  getCompetenciesByLevel,
  getCompetenciesBySubject,
  toggleCompetencyStatus,
  getCompetencyStats
};
