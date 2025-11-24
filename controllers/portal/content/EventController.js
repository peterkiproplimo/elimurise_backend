const express = require('express');
const mongoose = require('mongoose');
const Event = require('../../../models/portal/content/Event');
const { auth } = require('../../../middleware/portal-auth');

const router = express.Router();

// Helper function to determine text color based on background color
const getContrastTextColor = (hexColor) => {
  if (!hexColor || !hexColor.startsWith('#')) {
    return '#ffffff'; // Default to white
  }
  
  // Convert hex to RGB
  const r = parseInt(hexColor.slice(1, 3), 16);
  const g = parseInt(hexColor.slice(3, 5), 16);
  const b = parseInt(hexColor.slice(5, 7), 16);
  
  // Calculate relative luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  
  // Return black for light colors, white for dark colors
  return luminance > 0.5 ? '#000000' : '#ffffff';
};

const normalizeDate = (value, isEnd = false) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  if (isEnd) {
    date.setHours(23, 59, 59, 999);
  } else {
    date.setHours(0, 0, 0, 0);
  }
  return date;
};

const applyDateRangeFilter = (query, start, end) => {
  if (!start && !end) {
    return query;
  }

  const clauses = [];

  if (start && end) {
    clauses.push({
      startDate: { $lte: end },
      endDate: { $gte: start },
    });
  } else if (start) {
    clauses.push({ endDate: { $gte: start } });
  } else if (end) {
    clauses.push({ startDate: { $lte: end } });
  }

  if (clauses.length) {
    query.$and = query.$and || [];
    query.$and.push({ $or: clauses });
  }

  return query;
};

// Create a new event
router.post('/', auth, async (req, res) => {
  try {
    const school = req?.user?.school;
    const user = req?.user?._id;

    if (!school) {
      return res.status(400).json({ success: false, message: 'School ID is required' });
    }

    const eventData = {
      ...req.body,
      school,
      createdBy: user,
    };

    // Validate dates
    const startDate = new Date(eventData.startDate);
    const endDate = new Date(eventData.endDate);
    
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid date format' 
      });
    }
    
    if (startDate > endDate) {
      return res.status(400).json({ 
        success: false, 
        message: 'End date must be after start date' 
      });
    }

    // Validate time for non-all-day events
    if (!eventData.isAllDay) {
      if (eventData.startTime && eventData.endTime) {
        const [startHours, startMinutes] = eventData.startTime.split(':').map(Number);
        const [endHours, endMinutes] = eventData.endTime.split(':').map(Number);
        
        // If same day, validate times
        if (startDate.toDateString() === endDate.toDateString()) {
          const startTimeMinutes = startHours * 60 + startMinutes;
          const endTimeMinutes = endHours * 60 + endMinutes;
          
          if (startTimeMinutes >= endTimeMinutes) {
            return res.status(400).json({ 
              success: false, 
              message: 'End time must be after start time for same-day events' 
            });
          }
        }
      }
    }

    // Validate recurring event fields
    if (eventData.isRecurring) {
      if (!eventData.recurringPattern) {
        return res.status(400).json({ 
          success: false, 
          message: 'Recurring pattern is required for recurring events' 
        });
      }
      
      if (eventData.recurringEndDate) {
        const recurringEndDate = new Date(eventData.recurringEndDate);
        if (isNaN(recurringEndDate.getTime())) {
          return res.status(400).json({ 
            success: false, 
            message: 'Invalid recurring end date format' 
          });
        }
        if (recurringEndDate < endDate) {
          return res.status(400).json({ 
            success: false, 
            message: 'Recurring end date must be after event end date' 
          });
        }
      }
    }

    const event = await Event.create(eventData);
    res.status(201).json({ 
      success: true, 
      message: 'Event created successfully', 
      data: event 
    });
  } catch (error) {
    console.error('Error creating event:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error', 
      error: error.message 
    });
  }
});

// Get all events for the logged-in user's school
router.get('/', auth, async (req, res) => {
  try {
    const school = req?.user?.school;

    if (!school) {
      return res.status(400).json({ success: false, message: 'School ID is required' });
    }

    const {
      startDate,
      endDate,
      eventType,
      status,
      search,
      page = 1,
      limit = 20,
      sort = 'startDate',
      sortOrder = 'asc',
    } = req.query;

    const parsedStart = normalizeDate(startDate);
    const parsedEnd = normalizeDate(endDate, true);
    const parsedPage = Number.isNaN(parseInt(page, 10)) ? 1 : parseInt(page, 10);
    const parsedLimit = Number.isNaN(parseInt(limit, 10)) ? 20 : parseInt(limit, 10);

    const query = { school };

    if (search) {
      query.title = { $regex: search, $options: 'i' };
    }

    if (eventType) {
      const types = eventType.split(',').map((type) => type.trim()).filter(Boolean);
      if (types.length) {
        query.eventType = { $in: types };
      }
    }

    if (status) {
      const statuses = status.split(',').map((value) => value.trim()).filter(Boolean);
      if (statuses.length) {
        query.status = { $in: statuses };
      }
    }

    applyDateRangeFilter(query, parsedStart, parsedEnd);

    const skip = (parsedPage - 1) * parsedLimit;
    const sortField = ['startDate', 'createdAt', 'title'].includes(sort) ? sort : 'startDate';
    const sortDirection = sortOrder === 'desc' ? -1 : 1;

    const [events, total] = await Promise.all([
      Event.find(query)
        .populate('createdBy', 'firstname lastname email')
        .populate('attendees')
        .sort({ [sortField]: sortDirection, startDate: sortField === 'startDate' ? sortDirection : 1 })
        .skip(skip)
        .limit(parsedLimit),
      Event.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      data: events,
      meta: {
        page: parsedPage,
        limit: parsedLimit,
        total,
        totalPages: Math.ceil(total / parsedLimit) || 1,
      },
    });
  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get events for calendar view (formatted for FullCalendar)
router.get('/calendar', auth, async (req, res) => {
  try {
    const school = req?.user?.school;

    if (!school) {
      return res.status(400).json({ success: false, message: 'School ID is required' });
    }

    const { start, end } = req.query;
    
    // If no date range provided, default to current month
    let parsedStart = normalizeDate(start);
    let parsedEnd = normalizeDate(end, true);
    
    if (!parsedStart || !parsedEnd) {
      const now = new Date();
      parsedStart = new Date(now.getFullYear(), now.getMonth(), 1);
      parsedStart.setHours(0, 0, 0, 0);
      parsedEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      parsedEnd.setHours(23, 59, 59, 999);
    }
    
    const query = { 
      school,
      status: { $in: ['published', 'draft'] }, // Only get active events
    };

    applyDateRangeFilter(query, parsedStart, parsedEnd);

    const events = await Event.find(query)
      .populate('createdBy', 'firstname lastname')
      .sort({ startDate: 1 });

    // Format events for FullCalendar
    const formattedEvents = events.map(event => {
      // Handle all-day events
      if (event.isAllDay) {
        // For all-day events, use date-only format (YYYY-MM-DD)
        const startDate = new Date(event.startDate);
        const endDate = new Date(event.endDate);
        // Add one day to end date for all-day events to make them inclusive
        endDate.setDate(endDate.getDate() + 1);
        
        return {
          id: event._id.toString(),
          title: event.title,
          start: startDate.toISOString().split('T')[0],
          end: endDate.toISOString().split('T')[0],
          allDay: true,
          backgroundColor: event.color || '#6366f1',
          borderColor: event.color || '#6366f1',
          textColor: getContrastTextColor(event.color || '#6366f1'),
          extendedProps: {
            description: event.description,
            location: event.location,
            eventType: event.eventType,
            createdBy: event.createdBy,
            status: event.status,
          },
        };
      }
      
      // Handle timed events
      const startDate = new Date(event.startDate);
      const endDate = new Date(event.endDate);
      const [startHours = 0, startMinutes = 0] = (event.startTime || '00:00').split(':').map(Number);
      const [endHours = 23, endMinutes = 59] = (event.endTime || '23:59').split(':').map(Number);
      
      startDate.setHours(startHours, startMinutes, 0, 0);
      endDate.setHours(endHours, endMinutes, 0, 0);
      
      return {
        id: event._id.toString(),
        title: event.title,
        start: startDate.toISOString(),
        end: endDate.toISOString(),
        allDay: false,
        backgroundColor: event.color || '#6366f1',
        borderColor: event.color || '#6366f1',
        textColor: '#ffffff',
        extendedProps: {
          description: event.description,
          location: event.location,
          eventType: event.eventType,
          createdBy: event.createdBy,
          status: event.status,
        },
      };
    });

    res.status(200).json({ success: true, data: formattedEvents });
  } catch (error) {
    console.error('Error fetching calendar events:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Event stats for dashboards
router.get('/stats/overview', auth, async (req, res) => {
  try {
    const school = req?.user?.school;

    if (!school) {
      return res.status(400).json({ success: false, message: 'School ID is required' });
    }

    const schoolId = new mongoose.Types.ObjectId(school);
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);

    const statusCountsPromise = Event.aggregate([
      { $match: { school: schoolId } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    const todayCountPromise = Event.countDocuments({
      school,
      startDate: { $lte: endOfToday },
      endDate: { $gte: startOfToday },
      status: { $nin: ['cancelled'] },
    });

    const upcomingEventsPromise = Event.find({
      school,
      startDate: { $gt: endOfToday },
      status: { $ne: 'cancelled' },
    })
      .sort({ startDate: 1 })
      .limit(5)
      .select('title startDate endDate eventType status color location')
      .lean();

    const recentEventsPromise = Event.find({ school })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('title status startDate endDate color eventType')
      .lean();

    const [statusCounts, todayCount, upcomingEvents, recentEvents] = await Promise.all([
      statusCountsPromise,
      todayCountPromise,
      upcomingEventsPromise,
      recentEventsPromise,
    ]);

    const statusSummary = statusCounts.reduce(
      (acc, record) => {
        acc[record._id] = record.count;
        return acc;
      },
      { draft: 0, published: 0, completed: 0, cancelled: 0 }
    );

    res.status(200).json({
      success: true,
      data: {
        todayCount,
        upcomingCount: upcomingEvents.length,
        upcomingEvents,
        recentEvents,
        statusCounts: statusSummary,
      },
    });
  } catch (error) {
    console.error('Error fetching event stats:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get a specific event by its ID
router.get('/:eventId', auth, async (req, res) => {
  try {
    const event = await Event.findById(req.params.eventId)
      .populate('createdBy', 'firstname lastname email')
      .populate('attendees')
      .populate('school', 'name');

    if (!event || event.school.toString() !== req?.user?.school.toString()) {
      return res.status(403).json({ 
        success: false, 
        message: 'Unauthorized to access this event' 
      });
    }

    res.status(200).json({ success: true, data: event });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update an event
router.put('/:eventId', auth, async (req, res) => {
  try {
    const event = await Event.findById(req.params.eventId);

    if (!event || event.school.toString() !== req?.user?.school.toString()) {
      return res.status(403).json({ 
        success: false, 
        message: 'Unauthorized to update this event' 
      });
    }

    // Validate dates if provided
    const startDate = req.body.startDate ? new Date(req.body.startDate) : event.startDate;
    const endDate = req.body.endDate ? new Date(req.body.endDate) : event.endDate;
    
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid date format' 
      });
    }
    
    if (startDate > endDate) {
      return res.status(400).json({ 
        success: false, 
        message: 'End date must be after start date' 
      });
    }

    // Validate time for non-all-day events
    const isAllDay = req.body.isAllDay !== undefined ? req.body.isAllDay : event.isAllDay;
    if (!isAllDay) {
      const startTime = req.body.startTime || event.startTime;
      const endTime = req.body.endTime || event.endTime;
      
      if (startTime && endTime && startDate.toDateString() === endDate.toDateString()) {
        const [startHours, startMinutes] = startTime.split(':').map(Number);
        const [endHours, endMinutes] = endTime.split(':').map(Number);
        const startTimeMinutes = startHours * 60 + startMinutes;
        const endTimeMinutes = endHours * 60 + endMinutes;
        
        if (startTimeMinutes >= endTimeMinutes) {
          return res.status(400).json({ 
            success: false, 
            message: 'End time must be after start time for same-day events' 
          });
        }
      }
    }

    // Validate recurring event fields
    const isRecurring = req.body.isRecurring !== undefined ? req.body.isRecurring : event.isRecurring;
    if (isRecurring) {
      const recurringPattern = req.body.recurringPattern || event.recurringPattern;
      if (!recurringPattern) {
        return res.status(400).json({ 
          success: false, 
          message: 'Recurring pattern is required for recurring events' 
        });
      }
      
      if (req.body.recurringEndDate || event.recurringEndDate) {
        const recurringEndDate = new Date(req.body.recurringEndDate || event.recurringEndDate);
        if (isNaN(recurringEndDate.getTime())) {
          return res.status(400).json({ 
            success: false, 
            message: 'Invalid recurring end date format' 
          });
        }
        if (recurringEndDate < endDate) {
          return res.status(400).json({ 
            success: false, 
            message: 'Recurring end date must be after event end date' 
          });
        }
      }
    }

    const updatedEvent = await Event.findByIdAndUpdate(
      req.params.eventId,
      { ...req.body },
      { new: true, runValidators: true }
    )
      .populate('createdBy', 'firstname lastname email')
      .populate('attendees');

    res.status(200).json({ 
      success: true, 
      message: 'Event updated successfully', 
      data: updatedEvent 
    });
  } catch (error) {
    console.error('Error updating event:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update event status only
router.patch('/:eventId/status', auth, async (req, res) => {
  try {
    const { status } = req.body;
    const allowedStatuses = ['draft', 'published', 'cancelled', 'completed'];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status value',
      });
    }

    const event = await Event.findById(req.params.eventId);

    if (!event || event.school.toString() !== req?.user?.school.toString()) {
      return res.status(403).json({ 
        success: false, 
        message: 'Unauthorized to update this event' 
      });
    }

    event.status = status;

    if (status === 'completed') {
      event.isRecurring = false;
    }

    await event.save();

    res.status(200).json({
      success: true,
      message: 'Event status updated successfully',
      data: event,
    });
  } catch (error) {
    console.error('Error updating event status:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete an event
router.delete('/:eventId', auth, async (req, res) => {
  try {
    const event = await Event.findById(req.params.eventId);

    if (!event || event.school.toString() !== req?.user?.school.toString()) {
      return res.status(403).json({ 
        success: false, 
        message: 'Unauthorized to delete this event' 
      });
    }

    await Event.findByIdAndDelete(req.params.eventId);
    res.status(200).json({ success: true, message: 'Event deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;


