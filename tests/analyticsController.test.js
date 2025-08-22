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
const mockGenerateInsights = jest.fn();
jest.mock('../services/analyticsService', () => {
  return jest.fn().mockImplementation(() => ({
    generateInsights: mockGenerateInsights
  }));
});

// Import after mocking
const analyticsRouter = require('../routes/analytics');

describe('Analytics Controller - Insights API Endpoint', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/analytics', analyticsRouter);
    
    jest.clearAllMocks();
  });

  describe('GET /analytics/insights', () => {
    it('should return formatted insights with proper categorization', async () => {
      const mockInsightsData = {
        insights: [
          {
            id: 'insight_1',
            type: 'health',
            category: 'water_intake',
            message: 'Your water intake has improved by 15% this month',
            severity: 'positive',
            actionable: true,
            timestamp: '2025-01-19T10:00:00Z'
          },
          {
            id: 'insight_2',
            type: 'education',
            category: 'study_hours',
            message: 'Your study hours are below recommended levels',
            severity: 'warning',
            actionable: true,
            timestamp: '2025-01-19T11:00:00Z'
          },
          {
            id: 'insight_3',
            type: 'health',
            category: 'exercise',
            message: 'You have maintained consistent exercise patterns',
            severity: 'info',
            actionable: false,
            timestamp: '2025-01-19T12:00:00Z'
          }
        ],
        recommendations: [
          {
            id: 'rec_1',
            type: 'health',
            category: 'water_intake',
            message: 'Keep up the good work! Try setting hourly reminders.',
            priority: 'medium',
            actionable: true,
            estimatedImpact: 'high'
          },
          {
            id: 'rec_2',
            type: 'education',
            category: 'study_hours',
            message: 'Consider increasing daily study time to 4 hours',
            priority: 'high',
            actionable: true,
            estimatedImpact: 'high'
          }
        ],
        milestones: [
          {
            id: 'milestone_1',
            type: 'health',
            achievement: 'Consistent water intake for 7 days',
            date: '2025-01-19'
          }
        ],
        generatedAt: '2025-01-19T12:00:00Z',
        totalInsights: 3,
        actionableRecommendations: 2
      };

      mockGenerateInsights.mockResolvedValue(mockInsightsData);

      const response = await request(app)
        .get('/analytics/insights')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('insights');
      expect(response.body.data).toHaveProperty('recommendations');
      expect(response.body.data).toHaveProperty('milestones');
      expect(response.body.data).toHaveProperty('summary');
      expect(response.body.data).toHaveProperty('filters');

      // Check insights structure
      expect(response.body.data.insights.total).toBe(3);
      expect(response.body.data.insights.items).toHaveLength(3);
      expect(response.body.data.insights.byCategory).toHaveProperty('water_intake');
      expect(response.body.data.insights.byCategory).toHaveProperty('study_hours');
      expect(response.body.data.insights.byCategory).toHaveProperty('exercise');
      expect(response.body.data.insights.bySeverity).toHaveProperty('positive');
      expect(response.body.data.insights.bySeverity).toHaveProperty('warning');
      expect(response.body.data.insights.bySeverity).toHaveProperty('info');

      // Check recommendations structure
      expect(response.body.data.recommendations.total).toBe(2);
      expect(response.body.data.recommendations.actionable).toBe(2);
      expect(response.body.data.recommendations.byPriority).toHaveProperty('high');
      expect(response.body.data.recommendations.byPriority).toHaveProperty('medium');

      // Check summary
      expect(response.body.data.summary.totalInsights).toBe(3);
      expect(response.body.data.summary.actionableRecommendations).toBe(2);
      expect(response.body.data.summary.criticalIssues).toBe(0);
      expect(response.body.data.summary.positiveInsights).toBe(1);

      // Check filters
      expect(response.body.data.filters.available.categories).toContain('health');
      expect(response.body.data.filters.available.categories).toContain('education');
      expect(response.body.data.filters.available.severities).toContain('critical');
      expect(response.body.data.filters.available.severities).toContain('warning');
      expect(response.body.data.filters.available.severities).toContain('info');
      expect(response.body.data.filters.available.severities).toContain('positive');
    });

    it('should handle service errors gracefully', async () => {
      mockGenerateInsights.mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app)
        .get('/analytics/insights')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to generate insights');
      expect(response.body.details).toBeUndefined(); // Should not expose internal errors in production
    });

    it('should expose error details in development environment', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      mockGenerateInsights.mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app)
        .get('/analytics/insights')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to generate insights');
      expect(response.body.details).toBe('Database connection failed');

      process.env.NODE_ENV = originalEnv;
    });

    it('should handle empty insights data gracefully', async () => {
      const mockInsightsData = {
        insights: [],
        recommendations: [],
        milestones: [],
        generatedAt: '2025-01-19T12:00:00Z',
        totalInsights: 0,
        actionableRecommendations: 0
      };

      mockGenerateInsights.mockResolvedValue(mockInsightsData);

      const response = await request(app)
        .get('/analytics/insights')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.insights.total).toBe(0);
      expect(response.body.data.insights.items).toHaveLength(0);
      expect(response.body.data.recommendations.total).toBe(0);
      expect(response.body.data.recommendations.items).toHaveLength(0);
      expect(response.body.data.summary.totalInsights).toBe(0);
      expect(response.body.data.summary.actionableRecommendations).toBe(0);
      expect(response.body.data.summary.criticalIssues).toBe(0);
      expect(response.body.data.summary.positiveInsights).toBe(0);
    });

    it('should validate severity flags correctly', async () => {
      const mockInsightsData = {
        insights: [
          {
            id: 'insight_1',
            type: 'health',
            category: 'water_intake',
            message: 'Critical water issue',
            severity: 'critical',
            actionable: true,
            timestamp: '2025-01-19T10:00:00Z'
          },
          {
            id: 'insight_2',
            type: 'health',
            category: 'exercise',
            message: 'Positive exercise progress',
            severity: 'positive',
            actionable: false,
            timestamp: '2025-01-19T11:00:00Z'
          },
          {
            id: 'insight_3',
            type: 'education',
            category: 'study_hours',
            message: 'Warning study issue',
            severity: 'warning',
            actionable: true,
            timestamp: '2025-01-19T12:00:00Z'
          }
        ],
        recommendations: [],
        milestones: [],
        generatedAt: '2025-01-19T12:00:00Z',
        totalInsights: 3,
        actionableRecommendations: 0
      };

      mockGenerateInsights.mockResolvedValue(mockInsightsData);

      const response = await request(app)
        .get('/analytics/insights')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.summary.criticalIssues).toBe(1);
      expect(response.body.data.summary.positiveInsights).toBe(1);
      expect(response.body.data.insights.bySeverity.critical).toHaveLength(1);
      expect(response.body.data.insights.bySeverity.positive).toHaveLength(1);
      expect(response.body.data.insights.bySeverity.warning).toHaveLength(1);
    });

    it('should validate actionability flags correctly', async () => {
      const mockInsightsData = {
        insights: [
          {
            id: 'insight_1',
            type: 'health',
            category: 'water_intake',
            message: 'Actionable insight',
            severity: 'warning',
            actionable: true,
            timestamp: '2025-01-19T10:00:00Z'
          },
          {
            id: 'insight_2',
            type: 'health',
            category: 'exercise',
            message: 'Non-actionable insight',
            severity: 'info',
            actionable: false,
            timestamp: '2025-01-19T11:00:00Z'
          }
        ],
        recommendations: [
          {
            id: 'rec_1',
            type: 'health',
            category: 'water_intake',
            message: 'Actionable recommendation',
            priority: 'high',
            actionable: true
          },
          {
            id: 'rec_2',
            type: 'health',
            category: 'exercise',
            message: 'Non-actionable recommendation',
            priority: 'low',
            actionable: false
          }
        ],
        milestones: [],
        generatedAt: '2025-01-19T12:00:00Z',
        totalInsights: 2,
        actionableRecommendations: 1
      };

      mockGenerateInsights.mockResolvedValue(mockInsightsData);

      const response = await request(app)
        .get('/analytics/insights')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.recommendations.actionable).toBe(1);
      expect(response.body.data.summary.actionableRecommendations).toBe(1);
    });

    it('should filter insights by category', async () => {
      const mockInsightsData = {
        insights: [
          {
            id: 'insight_1',
            type: 'health',
            category: 'water_intake',
            message: 'Water intake insight',
            severity: 'positive',
            actionable: true,
            timestamp: '2025-01-19T10:00:00Z'
          },
          {
            id: 'insight_2',
            type: 'education',
            category: 'study_hours',
            message: 'Study hours insight',
            severity: 'warning',
            actionable: true,
            timestamp: '2025-01-19T11:00:00Z'
          }
        ],
        recommendations: [
          {
            id: 'rec_1',
            type: 'health',
            category: 'water_intake',
            message: 'Water recommendation',
            priority: 'medium',
            actionable: true
          },
          {
            id: 'rec_2',
            type: 'education',
            category: 'study_hours',
            message: 'Study recommendation',
            priority: 'high',
            actionable: true
          }
        ],
        milestones: [],
        generatedAt: '2025-01-19T12:00:00Z',
        totalInsights: 2,
        actionableRecommendations: 2
      };

      mockGenerateInsights.mockResolvedValue(mockInsightsData);

      const response = await request(app)
        .get('/analytics/insights?category=water_intake')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.insights.items).toHaveLength(1);
      expect(response.body.data.insights.items[0].category).toBe('water_intake');
      expect(response.body.data.recommendations.items).toHaveLength(1);
      expect(response.body.data.recommendations.items[0].category).toBe('water_intake');
      expect(response.body.data.filters.applied.category).toBe('water_intake');
    });

    it('should filter insights by severity', async () => {
      const mockInsightsData = {
        insights: [
          {
            id: 'insight_1',
            type: 'health',
            category: 'water_intake',
            message: 'Critical water issue',
            severity: 'critical',
            actionable: true,
            timestamp: '2025-01-19T10:00:00Z'
          },
          {
            id: 'insight_2',
            type: 'health',
            category: 'exercise',
            message: 'Warning exercise issue',
            severity: 'warning',
            actionable: true,
            timestamp: '2025-01-19T11:00:00Z'
          },
          {
            id: 'insight_3',
            type: 'health',
            category: 'typing',
            message: 'Positive typing progress',
            severity: 'positive',
            actionable: false,
            timestamp: '2025-01-19T12:00:00Z'
          }
        ],
        recommendations: [],
        milestones: [],
        generatedAt: '2025-01-19T12:00:00Z',
        totalInsights: 3,
        actionableRecommendations: 0
      };

      mockGenerateInsights.mockResolvedValue(mockInsightsData);

      const response = await request(app)
        .get('/analytics/insights?severity=critical,warning')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.insights.items).toHaveLength(2);
      expect(response.body.data.insights.items[0].severity).toBe('critical');
      expect(response.body.data.insights.items[1].severity).toBe('warning');
      expect(response.body.data.summary.criticalIssues).toBe(1);
      expect(response.body.data.summary.positiveInsights).toBe(0);
      expect(response.body.data.filters.applied.severity).toBe('critical,warning');
    });

    it('should filter insights by actionability', async () => {
      const mockInsightsData = {
        insights: [
          {
            id: 'insight_1',
            type: 'health',
            category: 'water_intake',
            message: 'Actionable water insight',
            severity: 'warning',
            actionable: true,
            timestamp: '2025-01-19T10:00:00Z'
          },
          {
            id: 'insight_2',
            type: 'health',
            category: 'exercise',
            message: 'Non-actionable exercise insight',
            severity: 'info',
            actionable: false,
            timestamp: '2025-01-19T11:00:00Z'
          }
        ],
        recommendations: [
          {
            id: 'rec_1',
            type: 'health',
            category: 'water_intake',
            message: 'Actionable recommendation',
            priority: 'high',
            actionable: true
          },
          {
            id: 'rec_2',
            type: 'health',
            category: 'exercise',
            message: 'Non-actionable recommendation',
            priority: 'low',
            actionable: false
          }
        ],
        milestones: [],
        generatedAt: '2025-01-19T12:00:00Z',
        totalInsights: 2,
        actionableRecommendations: 1
      };

      mockGenerateInsights.mockResolvedValue(mockInsightsData);

      const response = await request(app)
        .get('/analytics/insights?actionable=true')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.insights.items).toHaveLength(1);
      expect(response.body.data.insights.items[0].actionable).toBe(true);
      expect(response.body.data.recommendations.items).toHaveLength(1);
      expect(response.body.data.recommendations.items[0].actionable).toBe(true);
      expect(response.body.data.filters.applied.actionable).toBe('true');
    });
  });
});