const Subject = require("../../models/frontoffice/Subject");
const Competency = require("../../models/frontoffice/Competency");

// Get all subjects
const getSubjects = async (req, res) => {
  try {
    const { page = 1, limit = 10, search, category, level, status } = req.query;
    
    // Build filter object
    const filter = {};
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { code: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    if (category) filter.category = category;
    if (level) filter.level = level;
    if (status) filter.status = status;
    
    const subjects = await Subject.find(filter)
      .populate('prerequisites', 'name code')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    const total = await Subject.countDocuments(filter);
    
    res.status(200).json({
      subjects,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
};

// Get single subject
const getSubject = async (req, res) => {
  try {
    const { id } = req.params;
    const subject = await Subject.findById(id)
      .populate('prerequisites', 'name code')
      .populate('createdBy', 'name email');
    
    if (!subject) {
      return res.status(404).json({ message: 'Subject not found' });
    }
    
    res.status(200).json(subject);
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
};

// Create new subject
const createSubject = async (req, res) => {
  try {
    const subjectData = req.body;
    
    // Check if subject with same code already exists
    const existingSubject = await Subject.findOne({ 
      $or: [
        { code: subjectData.code },
        { name: subjectData.name }
      ]
    });
    
    if (existingSubject) {
      return res.status(400).json({ 
        message: 'Subject with this code or name already exists' 
      });
    }
    
    const newSubject = new Subject({
      ...subjectData,
      createdBy: req.user?.id || req.body.createdBy
    });
    
    const savedSubject = await newSubject.save();
    await savedSubject.populate('prerequisites', 'name code');
    await savedSubject.populate('createdBy', 'name email');
    
    res.status(201).json(savedSubject);
  } catch (error) {
    res.status(409).json({ message: error.message });
  }
};

// Update subject
const updateSubject = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    // Check if updating code/name conflicts with existing subjects
    if (updateData.code || updateData.name) {
      const existingSubject = await Subject.findOne({
        _id: { $ne: id },
        $or: [
          { code: updateData.code },
          { name: updateData.name }
        ]
      });
      
      if (existingSubject) {
        return res.status(400).json({ 
          message: 'Subject with this code or name already exists' 
        });
      }
    }
    
    const updatedSubject = await Subject.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    )
      .populate('prerequisites', 'name code')
      .populate('createdBy', 'name email');
    
    if (!updatedSubject) {
      return res.status(404).json({ message: 'Subject not found' });
    }
    
    res.status(200).json(updatedSubject);
  } catch (error) {
    res.status(409).json({ message: error.message });
  }
};

// Delete subject
const deleteSubject = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if subject is referenced by competencies
    const competenciesUsingSubject = await Competency.find({ subject: id });
    if (competenciesUsingSubject.length > 0) {
      return res.status(400).json({ 
        message: 'Cannot delete subject. It is referenced by competencies.' 
      });
    }
    
    const deletedSubject = await Subject.findByIdAndDelete(id);
    
    if (!deletedSubject) {
      return res.status(404).json({ message: 'Subject not found' });
    }
    
    res.status(200).json({ message: 'Subject deleted successfully' });
  } catch (error) {
    res.status(409).json({ message: error.message });
  }
};

// Get subjects by category
const getSubjectsByCategory = async (req, res) => {
  try {
    const { category } = req.params;
    const subjects = await Subject.find({ 
      category, 
      isActive: true 
    })
      .select('name code description credits duration')
      .sort({ name: 1 });
    
    res.status(200).json(subjects);
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
};

// Get subjects by level
const getSubjectsByLevel = async (req, res) => {
  try {
    const { level } = req.params;
    const subjects = await Subject.find({ 
      level, 
      isActive: true 
    })
      .select('name code description credits duration')
      .sort({ name: 1 });
    
    res.status(200).json(subjects);
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
};

// Toggle subject status
const toggleSubjectStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const subject = await Subject.findById(id);
    
    if (!subject) {
      return res.status(404).json({ message: 'Subject not found' });
    }
    
    subject.isActive = !subject.isActive;
    subject.status = subject.isActive ? 'active' : 'inactive';
    
    const updatedSubject = await subject.save();
    await updatedSubject.populate('prerequisites', 'name code');
    await updatedSubject.populate('createdBy', 'name email');
    
    res.status(200).json(updatedSubject);
  } catch (error) {
    res.status(409).json({ message: error.message });
  }
};

module.exports = {
  getSubjects,
  getSubject,
  createSubject,
  updateSubject,
  deleteSubject,
  getSubjectsByCategory,
  getSubjectsByLevel,
  toggleSubjectStatus
};
