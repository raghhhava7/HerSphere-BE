const request = require('supertest');
const express = require('express');

// Mock the auth middleware
jest.mock('../middleware/auth', () => ({
  authenticateToken: (req, res, next) => {
    req.user = { id: 1 };
    next();
  }
}));

// Mock the database pool
jest.mock('../config/database', () => ({
  pool: {
    query: jest.fn()
  }
}));

// Mock the analytics service
const mockCheckGoalAchievements = jest.fn();
const mockCalculateGoalStreak = jest.fn();
const mockCalculateHistoricalCompletionRate = jest.fn();
const mockGenerateAchievementNotifications = jest.fn();

jest.mock('../services/analyticsService', () => {
  return jest.fn().mockImplementation(() => ({
    checkGoalAchievements: mockCheckGoalAchievements,
    calculateGoalStreak: mockCalculateGoalStreak,
    calculateHistoricalCompletionRate: mockCalculateHistoricalCompletionRate,
    generateAchievementNotifications: mockGenerateAchievementNotifications
  }));
});

// Import after mocking
const analyticsRouter = require('../routes/analytics');
const { pool } = require('../config/database');

describe('Goal Achievement Tracking API', () => {
  let app;
  let userId = 1;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/analytics', analyticsRouter);
    
    jest.clearAllMocks();
  });

  describe('POST /analytics/goals/check-achievements', () => {
    it('should check for goal achievements and return notifications', async () => {
      const mockAchievedGoals = [
        {
          id: 1,
          user_id: 1,
          type: 'health',
          metric: 'water_intake',
          target: '2000.00',
          description: 'Drink 2L of water daily',
          status: 'completed',
          achievedValue: 2100,
          achievedAt: new Date().toISOString()
        }
      ];

      const mockNotifications = [
        {
          type: 'goal_achievement',
          userId: 1,
          goalId: 1,
          title: 'Goal Achieved! 🎉',
          message: 'Congratulations! You\'ve achieved your health goal: Drink 2L of water daily',
          data: {
            goalType: 'health',
            metric: 'water_intake',
            target: '2000.00',
            achievedValue: 2100,
            achievedAt: mockAchievedGoals[0].achievedAt
          },
          priority: 'high',
          createdAt: new Date().toISOString()
        }
      ];

      mockCheckGoalAchievements.mockResolvedValue(mockAchievedGoals);
      mockGenerateAchievementNotifications.mockReturnValue(mockNotifications);

      const response = await request(app)
        .post('/analytics/goals/check-achievements');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('achievedGoals');
      expect(response.body.data).toHaveProperty('notifications');
      expect(response.body.data).toHaveProperty('count');
      expect(response.body.data.achievedGoals).toHaveLength(1);
      expect(response.body.data.notifications).toHaveLength(1);
      expect(response.body.data.count).toBe(1);
      expect(response.body.message).toContain('Congratulations');

      expect(mockCheckGoalAchievements).toHaveBeenCalledWith(userId);
      expect(mockGenerateAchievementNotifications).toHaveBeenCalledWith(userId, mockAchievedGoals);
    });

    it('should return appropriate message when no goals are achieved', async () => {
      mockCheckGoalAchievements.mockResolvedValue([]);
      mockGenerateAchievementNotifications.mockReturnValue([]);

      const response = await request(app)
        .post('/analytics/goals/check-achievements');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.achievedGoals).toHaveLength(0);
      expect(response.body.data.notifications).toHaveLength(0);
      expect(response.body.data.count).toBe(0);
      expect(response.body.message).toBe('No new goal achievements at this time');
    });

    it('should handle errors gracefully', async () => {
      mockCheckGoalAchievements.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .post('/analytics/goals/check-achievements');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to check goal achievements');
    });
  });

  describe('GET /analytics/goals/streaks', () => {
    it('should return goal streak data for valid metric and type', async () => {
      const mockStreakData = {
        currentStreak: 7,
        longestStreak: 14,
        lastAchievedDate: '2025-08-19'
      };

      mockCalculateGoalStreak.mockResolvedValue(mockStreakData);

      const response = await request(app)
        .get('/analytics/goals/streaks')
        .query({ metric: 'water_intake', type: 'health' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockStreakData);
      expect(response.body.metric).toBe('water_intake');
      expect(response.body.type).toBe('health');

      expect(mockCalculateGoalStreak).toHaveBeenCalledWith(userId, 'water_intake', 'health');
    });

    it('should return 400 when metric parameter is missing', async () => {
      const response = await request(app)
        .get('/analytics/goals/streaks')
        .query({ type: 'health' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Metric and type parameters are required');
    });

    it('should return 400 when type parameter is missing', async () => {
      const response = await request(app)
        .get('/analytics/goals/streaks')
        .query({ metric: 'water_intake' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Metric and type parameters are required');
    });

    it('should handle calculation errors gracefully', async () => {
      mockCalculateGoalStreak.mockRejectedValue(new Error('Calculation error'));

      const response = await request(app)
        .get('/analytics/goals/streaks')
        .query({ metric: 'water_intake', type: 'health' });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to calculate goal streaks');
    });
  });

  describe('GET /analytics/goals/completion-stats', () => {
    it('should return comprehensive goal completion statistics', async () => {
      const mockCompletionStats = {
        overall: {
          totalGoals: 10,
          completedGoals: 7,
          completionRate: 70
        },
        byType: {
          health: {
            total: 6,
            completed: 4,
            completionRate: 67
          },
          education: {
            total: 4,
            completed: 3,
            completionRate: 75
          }
        },
        recentAchievements: [
          {
            id: 1,
            user_id: 1,
            goal_id: 1,
            achieved_value: '2100.00',
            achieved_at: '2025-08-19T10:00:00.000Z',
            metric: 'water_intake',
            type: 'health'
          }
        ],
        averageTimeToCompletion: 14
      };

      mockCalculateHistoricalCompletionRate.mockResolvedValue(mockCompletionStats);

      const response = await request(app)
        .get('/analytics/goals/completion-stats');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockCompletionStats);

      // Verify structure of returned data
      expect(response.body.data.overall).toHaveProperty('totalGoals');
      expect(response.body.data.overall).toHaveProperty('completedGoals');
      expect(response.body.data.overall).toHaveProperty('completionRate');
      
      expect(response.body.data.byType).toHaveProperty('health');
      expect(response.body.data.byType).toHaveProperty('education');
      
      expect(response.body.data).toHaveProperty('recentAchievements');
      expect(response.body.data).toHaveProperty('averageTimeToCompletion');

      expect(mockCalculateHistoricalCompletionRate).toHaveBeenCalledWith(userId);
    });

    it('should handle calculation errors gracefully', async () => {
      mockCalculateHistoricalCompletionRate.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/analytics/goals/completion-stats');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to fetch goal completion statistics');
    });
  });

  describe('Goal Achievement Detection Logic', () => {
    it('should properly detect when goals are achieved', async () => {
      // This test would verify the actual achievement detection logic
      // For now, we test that the service method is called correctly
      const mockAchievedGoals = [
        {
          id: 1,
          metric: 'water_intake',
          target: '2000.00',
          achievedValue: 2200,
          achievedAt: new Date().toISOString()
        }
      ];

      mockCheckGoalAchievements.mockResolvedValue(mockAchievedGoals);
      mockGenerateAchievementNotifications.mockReturnValue([]);

      const response = await request(app)
        .post('/analytics/goals/check-achievements');

      expect(response.status).toBe(200);
      expect(response.body.data.achievedGoals[0].achievedValue).toBeGreaterThan(2000);
    });
  });

  describe('Notification Generation', () => {
    it('should generate appropriate notifications for different goal types', async () => {
      const healthGoal = {
        id: 1,
        type: 'health',
        metric: 'water_intake',
        target: '2000.00',
        description: 'Drink 2L of water daily',
        achievedValue: 2100,
        achievedAt: new Date().toISOString()
      };

      const educationGoal = {
        id: 2,
        type: 'education',
        metric: 'study_hours',
        target: '4.00',
        description: 'Study 4 hours daily',
        achievedValue: 4.5,
        achievedAt: new Date().toISOString()
      };

      const mockNotifications = [
        {
          type: 'goal_achievement',
          userId: 1,
          goalId: 1,
          title: 'Goal Achieved! 🎉',
          message: 'Congratulations! You\'ve achieved your health goal: Drink 2L of water daily',
          priority: 'high'
        },
        {
          type: 'goal_achievement',
          userId: 1,
          goalId: 2,
          title: 'Goal Achieved! 🎉',
          message: 'Congratulations! You\'ve achieved your education goal: Study 4 hours daily',
          priority: 'high'
        }
      ];

      mockCheckGoalAchievements.mockResolvedValue([healthGoal, educationGoal]);
      mockGenerateAchievementNotifications.mockReturnValue(mockNotifications);

      const response = await request(app)
        .post('/analytics/goals/check-achievements');

      expect(response.status).toBe(200);
      expect(response.body.data.notifications).toHaveLength(2);
      expect(response.body.data.notifications[0].message).toContain('health goal');
      expect(response.body.data.notifications[1].message).toContain('education goal');
    });
  });

  describe('Streak Calculation Edge Cases', () => {
    it('should handle zero streaks correctly', async () => {
      const mockStreakData = {
        currentStreak: 0,
        longestStreak: 0,
        lastAchievedDate: null
      };

      mockCalculateGoalStreak.mockResolvedValue(mockStreakData);

      const response = await request(app)
        .get('/analytics/goals/streaks')
        .query({ metric: 'water_intake', type: 'health' });

      expect(response.status).toBe(200);
      expect(response.body.data.currentStreak).toBe(0);
      expect(response.body.data.longestStreak).toBe(0);
      expect(response.body.data.lastAchievedDate).toBeNull();
    });

    it('should handle long streaks correctly', async () => {
      const mockStreakData = {
        currentStreak: 30,
        longestStreak: 45,
        lastAchievedDate: '2025-08-19'
      };

      mockCalculateGoalStreak.mockResolvedValue(mockStreakData);

      const response = await request(app)
        .get('/analytics/goals/streaks')
        .query({ metric: 'exercise_steps', type: 'health' });

      expect(response.status).toBe(200);
      expect(response.body.data.currentStreak).toBe(30);
      expect(response.body.data.longestStreak).toBe(45);
      expect(response.body.data.lastAchievedDate).toBe('2025-08-19');
    });
  });

  describe('Completion Rate Edge Cases', () => {
    it('should handle users with no goals', async () => {
      const mockEmptyStats = {
        overall: {
          totalGoals: 0,
          completedGoals: 0,
          completionRate: 0
        },
        byType: {
          health: {
            total: 0,
            completed: 0,
            completionRate: 0
          },
          education: {
            total: 0,
            completed: 0,
            completionRate: 0
          }
        },
        recentAchievements: [],
        averageTimeToCompletion: 0
      };

      mockCalculateHistoricalCompletionRate.mockResolvedValue(mockEmptyStats);

      const response = await request(app)
        .get('/analytics/goals/completion-stats');

      expect(response.status).toBe(200);
      expect(response.body.data.overall.totalGoals).toBe(0);
      expect(response.body.data.overall.completionRate).toBe(0);
      expect(response.body.data.recentAchievements).toHaveLength(0);
    });

    it('should handle perfect completion rates', async () => {
      const mockPerfectStats = {
        overall: {
          totalGoals: 5,
          completedGoals: 5,
          completionRate: 100
        },
        byType: {
          health: {
            total: 3,
            completed: 3,
            completionRate: 100
          },
          education: {
            total: 2,
            completed: 2,
            completionRate: 100
          }
        },
        recentAchievements: [],
        averageTimeToCompletion: 7
      };

      mockCalculateHistoricalCompletionRate.mockResolvedValue(mockPerfectStats);

      const response = await request(app)
        .get('/analytics/goals/completion-stats');

      expect(response.status).toBe(200);
      expect(response.body.data.overall.completionRate).toBe(100);
      expect(response.body.data.byType.health.completionRate).toBe(100);
      expect(response.body.data.byType.education.completionRate).toBe(100);
    });
  });
});