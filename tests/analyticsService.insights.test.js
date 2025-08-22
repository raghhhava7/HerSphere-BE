const AnalyticsService = require('../services/analyticsService');
const { pool } = require('../config/database');

// Mock the database pool
jest.mock('../config/database', () => ({
  pool: {
    query: jest.fn()
  }
}));

describe('AnalyticsService - Insights Generation', () => {
  let analyticsService;

  beforeEach(() => {
    analyticsService = new AnalyticsService();
    jest.clearAllMocks();
  });

  describe('generateInsights', () => {
    it('should generate comprehensive insights for a user', async () => {
      const userId = 1;
      
      // Mock health data
      const mockHealthData = {
        waterIntake: {
          average: 1500,
          trend: 'decreasing',
          trendPercentage: -20,
          daysTracked: 25,
          goalProgress: null
        },
        exercise: {
          averageSteps: 6000,
          trend: 'increasing',
          trendPercentage: 15,
          activityTypes: { walking: 20, running: 5 },
          daysTracked: 22,
          goalProgress: null
        },
        constipation: {
          positiveRate: 70,
          trend: 'stable',
          trendPercentage: 5,
          daysTracked: 20
        },
        kriya: {
          totalSessions: 18,
          consistencyRate: 60,
          daysTracked: 30
        },
        typing: {
          completionRate: 85,
          trend: 'increasing',
          trendPercentage: 10,
          completedCount: 25
        }
      };

      // Mock education data
      const mockEducationData = {
        studyHours: {
          averageHours: 3.5,
          totalHours: 105,
          trend: 'increasing',
          trendPercentage: 12,
          consistencyRate: 75
        },
        subjectProgress: [
          {
            subjectCode: 'ECO525',
            subjectName: 'Microeconomic Theory',
            taskCompletionRate: 85,
            totalTasks: 20,
            completedTasks: 17
          },
          {
            subjectCode: 'STAT501',
            subjectName: 'Statistics',
            taskCompletionRate: 45,
            totalTasks: 22,
            completedTasks: 10
          }
        ],
        taskCompletion: {
          overallCompletionRate: 65,
          regularTasksCompletionRate: 70,
          nptelTasksCompletionRate: 60
        }
      };

      // Mock the service methods
      jest.spyOn(analyticsService, 'aggregateHealthData').mockResolvedValue(mockHealthData);
      jest.spyOn(analyticsService, 'calculateEducationProgress').mockResolvedValue(mockEducationData);

      const result = await analyticsService.generateInsights(userId);

      expect(result).toHaveProperty('insights');
      expect(result).toHaveProperty('recommendations');
      expect(result).toHaveProperty('milestones');
      expect(result).toHaveProperty('generatedAt');
      expect(result).toHaveProperty('totalInsights');
      expect(result).toHaveProperty('actionableRecommendations');

      expect(Array.isArray(result.insights)).toBe(true);
      expect(Array.isArray(result.recommendations)).toBe(true);
      expect(Array.isArray(result.milestones)).toBe(true);
    });

    it('should handle empty data gracefully', async () => {
      const userId = 1;
      
      // Mock empty data
      jest.spyOn(analyticsService, 'aggregateHealthData').mockResolvedValue({});
      jest.spyOn(analyticsService, 'calculateEducationProgress').mockResolvedValue({});

      const result = await analyticsService.generateInsights(userId);

      // With empty data, cross-domain insights should not generate anything
      expect(result.insights).toEqual([]);
      expect(result.recommendations).toEqual([]);
      expect(result.milestones).toEqual([]);
    });
  });

  describe('analyzeWaterIntakePatterns', () => {
    it('should generate warning insight for low water intake', () => {
      const waterData = {
        average: 1200,
        trend: 'decreasing',
        trendPercentage: -25,
        daysTracked: 20,
        goalProgress: null
      };

      const result = analyticsService.analyzeWaterIntakePatterns(waterData);

      expect(result.insights).toHaveLength(2); // Low intake + decreasing trend
      expect(result.recommendations).toHaveLength(2);
      
      const criticalInsight = result.insights.find(i => i.severity === 'critical');
      expect(criticalInsight).toBeDefined();
      expect(criticalInsight.message).toContain('significantly below');
      expect(criticalInsight.actionable).toBe(true);

      const warningInsight = result.insights.find(i => i.severity === 'warning');
      expect(warningInsight).toBeDefined();
      expect(warningInsight.message).toContain('decreased by 25%');
    });

    it('should generate positive insight for good water intake', () => {
      const waterData = {
        average: 2100,
        trend: 'increasing',
        trendPercentage: 15,
        daysTracked: 25,
        goalProgress: { status: 'achieved', progress: 105 }
      };

      const result = analyticsService.analyzeWaterIntakePatterns(waterData);

      expect(result.insights.some(i => i.severity === 'positive')).toBe(true);
      expect(result.milestones.length).toBeGreaterThanOrEqual(1); // At least one milestone
      
      const positiveInsight = result.insights.find(i => i.severity === 'positive');
      expect(positiveInsight.message).toContain('improved by 15%');
    });

    it('should recommend consistency tracking for low tracking days', () => {
      const waterData = {
        average: 1800,
        trend: 'stable',
        trendPercentage: 2,
        daysTracked: 15, // Low tracking
        goalProgress: null
      };

      const result = analyticsService.analyzeWaterIntakePatterns(waterData);

      const consistencyRec = result.recommendations.find(r => r.message.includes('consistently'));
      expect(consistencyRec).toBeDefined();
      expect(consistencyRec.priority).toBe('medium');
    });
  });

  describe('analyzeExercisePatterns', () => {
    it('should generate positive insight for good step count', () => {
      const exerciseData = {
        averageSteps: 9000,
        trend: 'increasing',
        trendPercentage: 20,
        activityTypes: { walking: 15, running: 8, cycling: 3 },
        daysTracked: 25,
        goalProgress: null
      };

      const result = analyticsService.analyzeExercisePatterns(exerciseData);

      expect(result.insights.some(i => i.severity === 'positive')).toBe(true);
      expect(result.milestones.length).toBeGreaterThanOrEqual(1); // At least one milestone
      
      const stepsInsight = result.insights.find(i => i.message.includes('9000 daily steps'));
      expect(stepsInsight).toBeDefined();
      
      const varietyInsight = result.insights.find(i => i.message.includes('variety'));
      expect(varietyInsight).toBeDefined();
    });

    it('should generate warning for low activity', () => {
      const exerciseData = {
        averageSteps: 4000,
        trend: 'decreasing',
        trendPercentage: -10,
        activityTypes: { walking: 10 },
        daysTracked: 20,
        goalProgress: null
      };

      const result = analyticsService.analyzeExercisePatterns(exerciseData);

      expect(result.insights.some(i => i.severity === 'warning')).toBe(true);
      expect(result.recommendations).toHaveLength(2); // Low steps + variety
      
      const lowStepsInsight = result.insights.find(i => i.message.includes('below recommended'));
      expect(lowStepsInsight).toBeDefined();
      expect(lowStepsInsight.actionable).toBe(true);
    });
  });

  describe('analyzeStudyHoursPatterns', () => {
    it('should generate positive insight for adequate study hours', () => {
      const studyData = {
        averageHours: 4.5,
        totalHours: 135,
        trend: 'increasing',
        trendPercentage: 18,
        consistencyRate: 80
      };

      const result = analyticsService.analyzeStudyHoursPatterns(studyData);

      expect(result.insights.some(i => i.severity === 'positive')).toBe(true);
      expect(result.milestones).toHaveLength(2); // Good hours + milestone
      
      const hoursInsight = result.insights.find(i => i.message.includes('4.5 daily study hours'));
      expect(hoursInsight).toBeDefined();
      
      const trendInsight = result.insights.find(i => i.message.includes('increased by 18%'));
      expect(trendInsight).toBeDefined();
    });

    it('should generate warning for insufficient study hours', () => {
      const studyData = {
        averageHours: 2.5,
        totalHours: 75,
        trend: 'decreasing',
        trendPercentage: -20,
        consistencyRate: 45
      };

      const result = analyticsService.analyzeStudyHoursPatterns(studyData);

      expect(result.insights.some(i => i.severity === 'warning')).toBe(true);
      expect(result.recommendations).toHaveLength(3); // Low hours + decreasing + consistency
      
      const lowHoursInsight = result.insights.find(i => i.message.includes('below recommended'));
      expect(lowHoursInsight).toBeDefined();
      expect(lowHoursInsight.actionable).toBe(true);
    });
  });

  describe('analyzeSubjectProgressPatterns', () => {
    it('should identify best and worst performing subjects', () => {
      const subjectProgress = [
        {
          subjectCode: 'ECO525',
          subjectName: 'Microeconomic Theory',
          taskCompletionRate: 85,
          totalTasks: 20
        },
        {
          subjectCode: 'STAT501',
          subjectName: 'Statistics',
          taskCompletionRate: 35,
          totalTasks: 22
        },
        {
          subjectCode: 'MATH301',
          subjectName: 'Calculus',
          taskCompletionRate: 70,
          totalTasks: 18
        }
      ];

      const result = analyticsService.analyzeSubjectProgressPatterns(subjectProgress);

      expect(result.insights.length).toBeGreaterThanOrEqual(2); // At least best and worst subject
      expect(result.recommendations.length).toBeGreaterThanOrEqual(1); // At least one recommendation
      expect(result.milestones).toHaveLength(1); // Best subject
      
      const bestSubjectInsight = result.insights.find(i => i.message.includes('ECO525'));
      expect(bestSubjectInsight).toBeDefined();
      expect(bestSubjectInsight.severity).toBe('positive');
      
      const worstSubjectInsight = result.insights.find(i => i.message.includes('STAT501'));
      expect(worstSubjectInsight).toBeDefined();
      expect(worstSubjectInsight.severity).toBe('warning');
    });

    it('should handle single subject gracefully', () => {
      const subjectProgress = [
        {
          subjectCode: 'ECO525',
          subjectName: 'Microeconomic Theory',
          taskCompletionRate: 85,
          totalTasks: 20
        }
      ];

      const result = analyticsService.analyzeSubjectProgressPatterns(subjectProgress);

      expect(result.insights).toHaveLength(2); // Best subject + overall
      expect(result.milestones).toHaveLength(1); // Best subject
    });
  });

  describe('sortInsightsBySeverity', () => {
    it('should sort insights by severity, actionability, and timestamp', () => {
      const insights = [
        {
          severity: 'positive',
          actionable: false,
          timestamp: '2025-01-01T10:00:00Z'
        },
        {
          severity: 'critical',
          actionable: true,
          timestamp: '2025-01-01T11:00:00Z'
        },
        {
          severity: 'warning',
          actionable: false,
          timestamp: '2025-01-01T09:00:00Z'
        },
        {
          severity: 'warning',
          actionable: true,
          timestamp: '2025-01-01T12:00:00Z'
        }
      ];

      const sorted = analyticsService.sortInsightsBySeverity(insights);

      expect(sorted[0].severity).toBe('critical');
      expect(sorted[1].severity).toBe('warning');
      expect(sorted[1].actionable).toBe(true); // Actionable warning first
      expect(sorted[2].severity).toBe('warning');
      expect(sorted[2].actionable).toBe(false);
      expect(sorted[3].severity).toBe('positive');
    });
  });

  describe('prioritizeRecommendations', () => {
    it('should prioritize recommendations by priority, impact, and actionability', () => {
      const recommendations = [
        {
          priority: 'medium',
          estimatedImpact: 'high',
          actionable: false
        },
        {
          priority: 'high',
          estimatedImpact: 'low',
          actionable: true
        },
        {
          priority: 'high',
          estimatedImpact: 'high',
          actionable: true
        },
        {
          priority: 'low',
          estimatedImpact: 'high',
          actionable: true
        }
      ];

      const prioritized = analyticsService.prioritizeRecommendations(recommendations);

      expect(prioritized[0].priority).toBe('high');
      expect(prioritized[0].estimatedImpact).toBe('high');
      expect(prioritized[1].priority).toBe('high');
      expect(prioritized[1].estimatedImpact).toBe('low');
      expect(prioritized[2].priority).toBe('medium');
      expect(prioritized[3].priority).toBe('low');
    });
  });

  describe('calculateOverallHealthScore', () => {
    it('should calculate health score from multiple metrics', () => {
      const healthData = {
        waterIntake: { average: 2000 },
        exercise: { averageSteps: 8000 },
        constipation: { positiveRate: 80 },
        kriya: { consistencyRate: 70 },
        typing: { completionRate: 85 }
      };

      const score = analyticsService.calculateOverallHealthScore(healthData);

      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(100);
      expect(typeof score).toBe('number');
    });

    it('should return 0 for empty health data', () => {
      const healthData = {};
      const score = analyticsService.calculateOverallHealthScore(healthData);
      expect(score).toBe(0);
    });
  });

  describe('calculateOverallProductivityScore', () => {
    it('should calculate productivity score from education metrics', () => {
      const educationData = {
        studyHours: { averageHours: 4 },
        taskCompletion: { overallCompletionRate: 75 },
        subjectProgress: [
          { taskCompletionRate: 80 },
          { taskCompletionRate: 70 }
        ]
      };

      const score = analyticsService.calculateOverallProductivityScore(educationData);

      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(100);
      expect(typeof score).toBe('number');
    });

    it('should return 0 for empty education data', () => {
      const educationData = {};
      const score = analyticsService.calculateOverallProductivityScore(educationData);
      expect(score).toBe(0);
    });
  });

  describe('analyzeHealthStudyCorrelation', () => {
    it('should detect positive correlation', () => {
      const healthMetric = { trend: 'increasing', trendPercentage: 20 };
      const studyMetric = { trend: 'increasing', trendPercentage: 15 };

      const result = analyticsService.analyzeHealthStudyCorrelation(
        healthMetric, studyMetric, 'water_intake', 'study_performance'
      );

      expect(result).toBeDefined();
      expect(result.insight.severity).toBe('positive');
      expect(result.insight.message).toContain('correlate');
      expect(result.recommendation).toBeDefined();
    });

    it('should detect negative correlation', () => {
      const healthMetric = { trend: 'decreasing', trendPercentage: -20 };
      const studyMetric = { trend: 'decreasing', trendPercentage: -15 };

      const result = analyticsService.analyzeHealthStudyCorrelation(
        healthMetric, studyMetric, 'exercise', 'study_consistency'
      );

      expect(result).toBeDefined();
      expect(result.insight.severity).toBe('warning');
      expect(result.insight.message).toContain('impacting');
      expect(result.recommendation.priority).toBe('high');
    });

    it('should return null for no correlation', () => {
      const healthMetric = { trend: 'increasing', trendPercentage: 20 };
      const studyMetric = { trend: 'decreasing', trendPercentage: -15 };

      const result = analyticsService.analyzeHealthStudyCorrelation(
        healthMetric, studyMetric, 'water_intake', 'study_performance'
      );

      expect(result).toBeNull();
    });
  });
});