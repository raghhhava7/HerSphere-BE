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
const mockProcessGoalProgress = jest.fn();
jest.mock('../services/analyticsService', () => {
  return jest.fn().mockImplementation(() => ({
    processGoalProgress: mockProcessGoalProgress
  }));
});

// Import after mocking
const analyticsRouter = require('../routes/analytics');
const { pool } = require('../config/database');

describe('Goal Management API', () => {
  let app;
  let userId = 1;
  let goalId = 1;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/analytics', analyticsRouter);
    
    jest.clearAllMocks();
  });

  describe('POST /analytics/goals', () => {
    it('should create a new goal successfully', async () => {
      const goalData = {
        type: 'health',
        metric: 'water_intake',
        target: 2000,
        description: 'Drink 2L of water daily'
      };

      const mockGoalResult = {
        rows: [{
          id: 1,
          user_id: 1,
          type: 'health',
          metric: 'water_intake',
          target: '2000.00',
          description: 'Drink 2L of water daily',
          status: 'active',
          created_at: new Date(),
          updated_at: new Date()
        }]
      };

      pool.query.mockResolvedValue(mockGoalResult);

      const response = await request(app)
        .post('/analytics/goals')
        .send(goalData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.type).toBe('health');
      expect(response.body.data.metric).toBe('water_intake');
      expect(parseFloat(response.body.data.target)).toBe(2000);
      expect(response.body.data.description).toBe('Drink 2L of water daily');
      expect(response.body.data.status).toBe('active');

      goalId = response.body.data.id;
    });

    it('should fail to create goal without required fields', async () => {
      const incompleteGoalData = {
        type: 'health',
        description: 'Incomplete goal'
      };

      const response = await request(app)
        .post('/analytics/goals')
        .send(incompleteGoalData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Type, metric, and target are required');
    });
  });

  describe('GET /analytics/goals', () => {
    it('should retrieve user goals with progress calculation', async () => {
      const mockGoalsData = {
        goals: [{
          id: 1,
          user_id: 1,
          type: 'health',
          metric: 'water_intake',
          target: '2000.00',
          description: 'Drink 2L of water daily',
          status: 'active',
          currentValue: 1800,
          progress: 90,
          progressStatus: 'on_track',
          trend: 'increasing',
          trendPercentage: 5,
          daysSinceCreation: 7
        }],
        summary: {
          total: 1,
          active: 1,
          completed: 0,
          onTrack: 1,
          averageProgress: 90
        }
      };

      mockProcessGoalProgress.mockResolvedValue(mockGoalsData);

      const response = await request(app)
        .get('/analytics/goals');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('goals');
      expect(response.body.data).toHaveProperty('summary');
      expect(Array.isArray(response.body.data.goals)).toBe(true);
      expect(response.body.data.goals.length).toBeGreaterThan(0);

      const goal = response.body.data.goals[0];
      expect(goal).toHaveProperty('id');
      expect(goal).toHaveProperty('currentValue');
      expect(goal).toHaveProperty('progress');
      expect(goal).toHaveProperty('progressStatus');
      expect(goal).toHaveProperty('trend');
      expect(goal).toHaveProperty('daysSinceCreation');

      // Check summary statistics
      expect(response.body.data.summary).toHaveProperty('total');
      expect(response.body.data.summary).toHaveProperty('active');
      expect(response.body.data.summary).toHaveProperty('completed');
      expect(response.body.data.summary).toHaveProperty('onTrack');
      expect(response.body.data.summary).toHaveProperty('averageProgress');
    });
  });

  describe('PUT /analytics/goals/:id', () => {
    it('should update goal successfully', async () => {
      const updateData = {
        target: 2500,
        description: 'Updated: Drink 2.5L of water daily',
        status: 'active'
      };

      const mockUpdateResult = {
        rows: [{
          id: 1,
          user_id: 1,
          type: 'health',
          metric: 'water_intake',
          target: '2500.00',
          description: 'Updated: Drink 2.5L of water daily',
          status: 'active',
          created_at: new Date(),
          updated_at: new Date()
        }]
      };

      pool.query.mockResolvedValue(mockUpdateResult);

      const response = await request(app)
        .put(`/analytics/goals/${goalId}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(parseFloat(response.body.data.target)).toBe(2500);
      expect(response.body.data.description).toBe('Updated: Drink 2.5L of water daily');
      expect(response.body.message).toBe('Goal updated successfully');
    });

    it('should return 404 for non-existent goal', async () => {
      const updateData = {
        target: 3000
      };

      const mockEmptyResult = {
        rows: []
      };

      pool.query.mockResolvedValue(mockEmptyResult);

      const response = await request(app)
        .put('/analytics/goals/99999')
        .send(updateData);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Goal not found');
    });
  });

  describe('Goal Progress Calculation', () => {
    it('should calculate goal progress correctly', async () => {
      const mockGoalsData = {
        goals: [{
          id: 1,
          metric: 'water_intake',
          currentValue: 1800,
          progress: 90,
          progressStatus: 'on_track'
        }],
        summary: {
          total: 1,
          active: 1,
          completed: 0,
          onTrack: 1,
          averageProgress: 90
        }
      };

      mockProcessGoalProgress.mockResolvedValue(mockGoalsData);

      const response = await request(app)
        .get('/analytics/goals');

      expect(response.status).toBe(200);
      const waterGoal = response.body.data.goals.find(g => g.metric === 'water_intake');
      
      expect(waterGoal).toBeDefined();
      expect(waterGoal.currentValue).toBeGreaterThan(0);
      expect(waterGoal.progress).toBeGreaterThanOrEqual(0);
      expect(waterGoal.progress).toBeLessThanOrEqual(100);
      expect(['needs_attention', 'behind', 'on_track', 'achieved']).toContain(waterGoal.progressStatus);
    });
  });

  describe('Multiple Goal Types', () => {
    it('should create and manage education goals', async () => {
      const educationGoal = {
        type: 'education',
        metric: 'study_hours',
        target: 4,
        description: 'Study 4 hours daily'
      };

      const mockEducationGoalResult = {
        rows: [{
          id: 2,
          user_id: 1,
          type: 'education',
          metric: 'study_hours',
          target: '4.00',
          description: 'Study 4 hours daily',
          status: 'active',
          created_at: new Date(),
          updated_at: new Date()
        }]
      };

      pool.query.mockResolvedValue(mockEducationGoalResult);

      const createResponse = await request(app)
        .post('/analytics/goals')
        .send(educationGoal);

      expect(createResponse.status).toBe(201);
      expect(createResponse.body.data.type).toBe('education');
      expect(createResponse.body.data.metric).toBe('study_hours');

      // Mock the get goals response with multiple goals
      const mockMultipleGoalsData = {
        goals: [
          {
            id: 1,
            type: 'health',
            metric: 'water_intake',
            target: '2000.00'
          },
          {
            id: 2,
            type: 'education',
            metric: 'study_hours',
            target: '4.00'
          }
        ],
        summary: {
          total: 2,
          active: 2,
          completed: 0,
          onTrack: 2,
          averageProgress: 85
        }
      };

      mockProcessGoalProgress.mockResolvedValue(mockMultipleGoalsData);

      const getResponse = await request(app)
        .get('/analytics/goals');

      expect(getResponse.body.data.goals.length).toBeGreaterThanOrEqual(2);
      const educationGoals = getResponse.body.data.goals.filter(g => g.type === 'education');
      expect(educationGoals.length).toBeGreaterThanOrEqual(1);
    });

    it('should create goals for different health metrics', async () => {
      const exerciseGoal = {
        type: 'health',
        metric: 'exercise_steps',
        target: 10000,
        description: 'Walk 10,000 steps daily'
      };

      const mockExerciseGoalResult = {
        rows: [{
          id: 3,
          user_id: 1,
          type: 'health',
          metric: 'exercise_steps',
          target: '10000.00',
          description: 'Walk 10,000 steps daily',
          status: 'active',
          created_at: new Date(),
          updated_at: new Date()
        }]
      };

      pool.query.mockResolvedValue(mockExerciseGoalResult);

      const response = await request(app)
        .post('/analytics/goals')
        .send(exerciseGoal);

      expect(response.status).toBe(201);
      expect(response.body.data.metric).toBe('exercise_steps');
      expect(parseFloat(response.body.data.target)).toBe(10000);
    });
  });
});