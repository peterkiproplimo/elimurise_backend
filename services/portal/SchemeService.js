const {Scheme, SchemeLesson} = require('../../models/portal/content/Scheme');

class SchemeService {
  async getSchemes({page = 1, limit = 10, filters = {}}) {
    const skip = (page - 1) * limit;
    const total = await Scheme.countDocuments(filters);
    const schemes = await Scheme.find(filters)
      .populate('learning_area created_by')
      .populate({
        path: 'learning_area',
        select: 'name grade_id',
        populate: {
          path: 'grade_id',
          select: 'name',
        },
      })
      .skip(skip)
      .limit(parseInt(limit))
      .sort({createdAt: -1});

    return {
      data: schemes,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getSchemeById(id) {
    const scheme = await Scheme.findById(id)
      .populate({
        path: 'weeks.lessons.scheme_lesson',
        populate: [
          {
            path: 'master_lesson',
            select: 'learning_outcome substrand',
          },
          {
            path: 'substrand',
            select: 'name strand',
            populate: {
              path: 'strand',
              select: 'name',
            },
          },
        ],
      })
      .populate('learning_area created_by');

    if (!scheme) throw new Error('Scheme not found');
    return scheme;
  }

  async createScheme(data) {
    return await Scheme.create(data);
  }

  async addSchemeLesson(data) {
    return await SchemeLesson.create(data);
  }

  async addLessonToWeek(schemeId, weekNumber, schemeLessonId) {
    const scheme = await Scheme.findById(schemeId);
    if (!scheme) throw new Error('Scheme not found');

    let week = scheme.weeks.find(w => w.week === weekNumber);
    if (!week) {
      week = {week: weekNumber, lessons: []};
      scheme.weeks.push(week);
    }

    week.lessons.push({scheme_lesson: schemeLessonId});
    await scheme.save();
    return scheme;
  }
}

module.exports = SchemeService;
