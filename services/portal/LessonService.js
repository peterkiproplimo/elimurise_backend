const Lesson = require('../../models/cms/content/Lesson'); // or adjust the path accordingly

class LessonService {
  async getLessons({page = 1, limit = 20, query = {}}) {
    const skip = (page - 1) * limit;
    const total = await Lesson.countDocuments(query);

    const lessons = await Lesson.find(query)
      .populate('substrand')
      .skip(skip)
      .limit(parseInt(limit))
      .sort({lesson_number: 1});

    return {
      data: lessons,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getLessonById(id) {
    const lesson = await Lesson.findById(id).populate('substrand');
    if (!lesson) throw new Error('Lesson not found');
    return lesson;
  }

  async createLesson(data) {
    return await Lesson.create(data);
  }

  async updateLesson(id, data) {
    const updated = await Lesson.findByIdAndUpdate(id, data, {new: true});
    if (!updated) throw new Error('Lesson not found');
    return updated;
  }

  async deleteLesson(id) {
    const deleted = await Lesson.findByIdAndDelete(id);
    if (!deleted) throw new Error('Lesson not found');
    return deleted;
  }
}

module.exports = LessonService;
