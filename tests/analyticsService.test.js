const AnalyticsService = require('../services/analyticsService');
const { pool } = require('../config/database');

// Mock the database pool
jest.mock('../config/database', () => ({
  pool: {
    query: jest.fn()
  }
}));

describe('AnalyticsService - Education Analytics', () => {
  let analyticsService;
  const mockUserId = 1;
  const mockStartDate = new Date('2025-01-01');

  beforeEach(() => {
    analyticsService = new AnalyticsService();
    jest.clearAllMocks();
  });

  describe('calculateEducationProgress', () => {
    it('should return education progress data with all components', async () => {
      // Mock all the database queries that will be called
      pool.query
        // Mock for getSubjectProgress
        .mockResolvedValueOnce({
          rows: [
            {
              subject_id: 1,
              subject_code: 'ECO525',
              subject_name: 'Microeconomic Theory',
              total_units: 5,
              total_tasks: 10,
              completed_tasks: 7,
              total_nptel_tasks: 3,
              completed_nptel_tasks: 2,
              total_research_projects: 1,
              avg_daily_study_hours: 2.5,
              total_study_hours: 50
            }
          ]
        })
        // Mock for getStudyHoursAnalytics
        .mockResolvedValueOnce({
          rows: [
            { date: '2025-01-01', hours: 3, created_at: '2025-01-01T10:00:00Z' },
            { date: '2025-01-02', hours: 2, created_at: '2025-01-02T10:00:00Z' }
          ]
        })
        // Mock for getPreviousPeriodComparison (study hours)
        .mockResolvedValueOnce({
          rows: [{ avg_value: 2.0, count: 15 }]
        })
        // Mock for calculateGoalProgress (study hours)
        .mockResolvedValueOnce({
          rows: []
        })
        // Mock for getTaskCompletionAnalytics - task completions
        .mockResolvedValueOnce({
          rows: [
            { completion_date: '2025-01-01', subject_code: 'ECO525', subject_name: 'Microeconomic Theory', tasks_completed: 2 }
          ]
        })
        // Mock for getTaskCompletionAnalytics - nptel completions
        .mockResolvedValueOnce({
          rows: [
            { completion_date: '2025-01-01', subject_code: 'ECO525', subject_name: 'Microeconomic Theory', nptel_tasks_completed: 1 }
          ]
        })
        // Mock for getTaskCompletionAnalytics - overall stats
        .mockResolvedValueOnce({
          rows: [{ total_tasks: 10, completed_tasks: 7, total_nptel_tasks: 3, completed_nptel_tasks: 2 }]
        })
        // Mock for getUnitProgress
        .mockResolvedValueOnce({
          rows: [
            {
              subject_code: 'ECO525',
              subject_name: 'Microeconomic Theory',
              unit_id: 1,
              unit_number: 1,
              unit_title: 'Introduction to Microeconomics',
              total_tasks: 3,
              completed_tasks: 2
            }
          ]
        })
        // Mock for getStudyPatternAnalysis - daily patterns
        .mockResolvedValueOnce({
          rows: [
            { day_of_week: 1, avg_hours: 2.5, study_days: 4, total_hours: 10 },
            { day_of_week: 2, avg_hours: 3.0, study_days: 3, total_hours: 9 }
          ]
        })
        // Mock for getSubjectPerformanceComparison
        .mockResolvedValueOnce({
          rows: [
            {
              subject_code: 'ECO525',
              subject_name: 'Microeconomic Theory',
              total_tasks: 10,
              completed_tasks: 7,
              total_nptel_tasks: 3,
              completed_nptel_tasks: 2,
              avg_task_completion_days: 5.5,
              recent_completions: 3
            }
          ]
        })
        // Mock for calculateStudyConsistencyPatterns
        .mockResolvedValueOnce({
          rows: [
            { study_date: '2025-01-01', hours: 3 },
            { study_date: '2025-01-02', hours: 2 },
            { study_date: '2025-01-04', hours: 2.5 }
          ]
        })
        // Mock for getEducationSummary
        .mockResolvedValueOnce({
          rows: [{
            total_subjects: 1,
            total_units: 5,
            total_tasks: 10,
            completed_tasks: 7,
            total_nptel_tasks: 3,
            completed_nptel_tasks: 2,
            total_research_projects: 1,
            total_study_hours: 50,
            days_studied: 20
          }]
        });

      const result = await analyticsService.calculateEducationProgress(mockUserId, '30', 'all');

      expect(result).toHaveProperty('timeRange', 30);
      expect(result).toHaveProperty('subjectProgress');
      expect(result).toHaveProperty('studyHours');
      expect(result).toHaveProperty('taskCompletion');
      expect(result).toHaveProperty('unitProgress');
      expect(result).toHaveProperty('studyPatterns');
      expect(result).toHaveProperty('summary');
      
      expect(result.subjectProgress).toHaveLength(1);
      expect(result.subjectProgress[0]).toHaveProperty('subjectCode', 'ECO525');
      expect(result.subjectProgress[0]).toHaveProperty('taskCompletionRate', 70);
    });
  });

  describe('getSubjectProgress', () => {
    it('should calculate subject progress correctly', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [
          {
            subject_id: 1,
            subject_code: 'ECO525',
            subject_name: 'Microeconomic Theory',
            total_units: 5,
            total_tasks: 10,
            completed_tasks: 8,
            total_nptel_tasks: 2,
            completed_nptel_tasks: 1,
            total_research_projects: 1,
            avg_daily_study_hours: 2.5,
            total_study_hours: 50
          }
        ]
      });

      const result = await analyticsService.getSubjectProgress(mockUserId, mockStartDate, 'all');

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        subjectId: 1,
        subjectCode: 'ECO525',
        subjectName: 'Microeconomic Theory',
        totalUnits: 5,
        totalTasks: 10,
        completedTasks: 8,
        taskCompletionRate: 80,
        totalNptelTasks: 2,
        completedNptelTasks: 1,
        nptelCompletionRate: 50,
        totalResearchProjects: 1,
        avgDailyStudyHours: '2.50',
        totalStudyHours: 50
      });
    });

    it('should handle subjects with no tasks', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [
          {
            subject_id: 1,
            subject_code: 'ECO525',
            subject_name: 'Microeconomic Theory',
            total_units: 5,
            total_tasks: 0,
            completed_tasks: 0,
            total_nptel_tasks: 0,
            completed_nptel_tasks: 0,
            total_research_projects: 0,
            avg_daily_study_hours: 0,
            total_study_hours: 0
          }
        ]
      });

      const result = await analyticsService.getSubjectProgress(mockUserId, mockStartDate, 'all');

      expect(result[0].taskCompletionRate).toBe(0);
      expect(result[0].nptelCompletionRate).toBe(0);
    });
  });

  describe('getStudyHoursAnalytics', () => {
    it('should calculate study hours analytics correctly', async () => {
      pool.query
        .mockResolvedValueOnce({
          rows: [
            { date: '2025-01-01', hours: 3, created_at: '2025-01-01T10:00:00Z' },
            { date: '2025-01-02', hours: 2, created_at: '2025-01-02T10:00:00Z' },
            { date: '2025-01-03', hours: 4, created_at: '2025-01-03T10:00:00Z' }
          ]
        })
        .mockResolvedValueOnce({
          rows: [{ avg_value: 2.5, count: 10 }]
        })
        .mockResolvedValueOnce({
          rows: []
        });

      const result = await analyticsService.getStudyHoursAnalytics(mockUserId, mockStartDate);

      expect(result.totalHours).toBe(9);
      expect(result.averageHours).toBe(3);
      expect(result.daysStudied).toBe(3);
      expect(result.daily).toHaveLength(3);
      expect(result).toHaveProperty('trend');
      expect(result).toHaveProperty('weeklyBreakdown');
    });

    it('should handle no study data', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ avg_value: null, count: 0 }] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await analyticsService.getStudyHoursAnalytics(mockUserId, mockStartDate);

      expect(result.totalHours).toBe(0);
      expect(result.averageHours).toBe(0);
      expect(result.daysStudied).toBe(0);
    });
  });

  describe('calculateProductivityPatterns', () => {
    it('should calculate productivity patterns correctly', () => {
      const dailyPatterns = [
        { dayOfWeek: 1, dayName: 'Monday', averageHours: '3.0', studyDays: 4, totalHours: 12 },
        { dayOfWeek: 2, dayName: 'Tuesday', averageHours: '2.5', studyDays: 3, totalHours: 7.5 },
        { dayOfWeek: 6, dayName: 'Saturday', averageHours: '1.5', studyDays: 2, totalHours: 3 }
      ];

      const result = analyticsService.calculateProductivityPatterns(dailyPatterns);

      expect(result.mostProductiveDay.day).toBe('Monday');
      expect(result.mostProductiveDay.averageHours).toBe('3.0');
      expect(result.leastProductiveDay.day).toBe('Saturday');
      expect(result.weekdayAverage).toBe('2.75');
      expect(result.weekendAverage).toBe('1.50');
      expect(result.consistencyScore).toBeGreaterThan(0);
    });

    it('should handle empty daily patterns', () => {
      const result = analyticsService.calculateProductivityPatterns([]);

      expect(result.mostProductiveDay).toBeNull();
      expect(result.leastProductiveDay).toBeNull();
      expect(result.weekdayVsWeekendRatio).toBe(0);
      expect(result.consistencyScore).toBe(0);
    });
  });

  describe('getSubjectPerformanceComparison', () => {
    it('should compare subject performance correctly', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [
          {
            subject_code: 'ECO525',
            subject_name: 'Microeconomic Theory',
            total_tasks: 10,
            completed_tasks: 8,
            total_nptel_tasks: 2,
            completed_nptel_tasks: 2,
            avg_task_completion_days: 5.5,
            recent_completions: 3
          },
          {
            subject_code: 'MAT301',
            subject_name: 'Advanced Mathematics',
            total_tasks: 15,
            completed_tasks: 6,
            total_nptel_tasks: 0,
            completed_nptel_tasks: 0,
            avg_task_completion_days: 7.2,
            recent_completions: 1
          }
        ]
      });

      const result = await analyticsService.getSubjectPerformanceComparison(mockUserId, mockStartDate);

      expect(result).toHaveLength(2);
      expect(result[0].completionRate).toBe(83); // (8+2)/(10+2) * 100
      expect(result[0].performanceLevel).toBe('excellent');
      expect(result[1].completionRate).toBe(40); // 6/15 * 100
      expect(result[1].performanceLevel).toBe('average');
    });
  });

  describe('calculateStudyConsistencyPatterns', () => {
    it('should calculate study consistency patterns correctly', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [
          { study_date: '2025-01-01', hours: 3 },
          { study_date: '2025-01-02', hours: 2 },
          { study_date: '2025-01-03', hours: 2.5 },
          { study_date: '2025-01-05', hours: 4 }, // 1 day gap
          { study_date: '2025-01-06', hours: 3 }
        ]
      });

      const result = await analyticsService.calculateStudyConsistencyPatterns(mockUserId, mockStartDate);

      expect(result.studyDays).toBe(5);
      expect(result.longestStreak).toBe(3);
      expect(result.averageGapBetweenSessions).toBe(1);
      expect(result.patterns.totalStreaks).toBe(2);
      expect(result.consistencyRate).toBeGreaterThan(0);
    });

    it('should handle no study data for consistency patterns', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      const result = await analyticsService.calculateStudyConsistencyPatterns(mockUserId, mockStartDate);

      expect(result.studyDays).toBe(0);
      expect(result.consistencyRate).toBe(0);
      expect(result.longestStreak).toBe(0);
      expect(result.currentStreak).toBe(0);
    });
  });

  describe('calculateTrend', () => {
    it('should calculate increasing trend correctly', () => {
      const values = [1, 2, 3, 4, 5, 6];
      const result = analyticsService.calculateTrend(values);

      expect(result.trend).toBe('increasing');
      expect(result.percentage).toBeGreaterThan(0);
    });

    it('should calculate decreasing trend correctly', () => {
      const values = [6, 5, 4, 3, 2, 1];
      const result = analyticsService.calculateTrend(values);

      expect(result.trend).toBe('decreasing');
      expect(result.percentage).toBeLessThan(0);
    });

    it('should handle insufficient data', () => {
      const values = [5];
      const result = analyticsService.calculateTrend(values);

      expect(result.trend).toBe('insufficient_data');
      expect(result.percentage).toBe(0);
    });
  });
});