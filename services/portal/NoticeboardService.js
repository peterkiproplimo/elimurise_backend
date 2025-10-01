const NoticeBoard = require('../../models/portal/content/NoticeBoard');

class NoticeBoardService {
  async createNotice(data) {
    try {
      const notice = new NoticeBoard(data);
      return await notice.save();
    } catch (error) {
      throw new Error(error.message);
    }
  }

  async getAllNotices(schoolId) {
    try {
      return await NoticeBoard.find({school: schoolId}).sort({createdAt: -1}).populate('recipients');
    } catch (error) {
      throw new Error(error.message);
    }
  }

  async getNoticeById(noticeId) {
    try {
      return await NoticeBoard.findById(noticeId).populate('recipients');
    } catch (error) {
      throw new Error(error.message);
    }
  }

  async updateNotice(noticeId, updateData) {
    try {
      return await NoticeBoard.findByIdAndUpdate(noticeId, updateData, {new: true});
    } catch (error) {
      throw new Error(error.message);
    }
  }

  async deleteNotice(noticeId) {
    try {
      return await NoticeBoard.findByIdAndDelete(noticeId);
    } catch (error) {
      throw new Error(error.message);
    }
  }
}

module.exports = new NoticeBoardService();
