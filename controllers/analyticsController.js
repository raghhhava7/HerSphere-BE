const { pool } = require('../config/database');
const AnalyticsService = require('../services/analyticsService');

const analyticsService = new AnalyticsService();

const getHealthAnalytics = async (req, res) => {
  try {
    const userId = req.user.id;
    const { timeRange = '30', metrics = 'all' } = req.query;
    
    const healthData = await analyticsService.aggregateHealthData(userId, timeRange, metrics);
    
    res.json({
      success: true,
      data: healthData,
      timeRange: parseInt(timeRange),
      metrics: metrics === 'all' ? ['water', 'exercise', 'period', 'constipation', 'kriya', 'typing'] : metrics.split(',')
    });
  } catch (error) {
    console.error('Health analytics error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch health analytics' 
    });
  }
};

const getEducationAnalytics = async (req, res) => {
  try {
    const userId = req.user.id;
    const { timeRange = '30', subjects = 'all' } = req.query;
    
    const educationData = await analyticsService.calculateEducationProgress(userId, timeRange, subjects);
    
    res.json({
      success: true,
      data: educationData,
      timeRange: parseInt(timeRange),
      subjects: subjects === 'all' ? 'all' : subjects.split(',')
    });
  } catch (error) {
    console.error('Education analytics error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch education analytics' 
    });
  }
};

const getPersonalizedInsights = async (req, res) => {
  try {
    const userId = req.user.id;
    const { category, severity, actionable } = req.query;
    
    // Generate insights using the analytics service
    const rawInsights = await analyticsService.generateInsights(userId);
    
    // Apply filters if provided
    let filteredInsights = rawInsights.insights;
    let filteredRecommendations = rawInsights.recommendations;
    
    if (category) {
      const categories = category.split(',').map(c => c.trim());
      filteredInsights = filteredInsights.filter(insight => categories.includes(insight.category));
      filteredRecommendations = filteredRecommendations.filter(rec => categories.includes(rec.category));
    }
    
    if (severity) {
      const severities = severity.split(',').map(s => s.trim());
      filteredInsights = filteredInsights.filter(insight => severities.includes(insight.severity));
    }
    
    if (actionable !== undefined) {
      const isActionable = actionable.toLowerCase() === 'true';
      filteredInsights = filteredInsights.filter(insight => insight.actionable === isActionable);
      filteredRecommendations = filteredRecommendations.filter(rec => rec.actionable === isActionable);
    }
    
    // Format the response with proper categorization
    const formattedResponse = {
      insights: {
        total: filteredInsights.length,
        byCategory: categorizeInsights(filteredInsights),
        bySeverity: groupBySeverity(filteredInsights),
        items: filteredInsights
      },
      recommendations: {
        total: filteredRecommendations.length,
        actionable: filteredRecommendations.filter(r => r.actionable).length,
        byPriority: groupByPriority(filteredRecommendations),
        items: filteredRecommendations
      },
      milestones: rawInsights.milestones || [],
      summary: {
        totalInsights: rawInsights.totalInsights,
        actionableRecommendations: rawInsights.actionableRecommendations,
        criticalIssues: filteredInsights.filter(i => i.severity === 'critical').length,
        positiveInsights: filteredInsights.filter(i => i.severity === 'positive').length,
        generatedAt: rawInsights.generatedAt
      },
      filters: {
        applied: {
          category: category || null,
          severity: severity || null,
          actionable: actionable || null
        },
        available: {
          categories: ['health', 'education', 'correlation'],
          severities: ['critical', 'warning', 'info', 'positive'],
          actionable: [true, false]
        }
      }
    };
    
    res.json({
      success: true,
      data: formattedResponse,
      message: 'Insights generated successfully'
    });
  } catch (error) {
    console.error('Insights generation error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to generate insights',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

const createGoal = async (req, res) => {
  try {
    const userId = req.user.id;
    const { type, metric, target, description } = req.body;
    
    if (!type || !metric || !target) {
      return res.status(400).json({ 
        success: false, 
        error: 'Type, metric, and target are required' 
      });
    }
    
    const result = await pool.query(
      'INSERT INTO user_goals (user_id, type, metric, target, description) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [userId, type, metric, target, description || null]
    );
    
    res.status(201).json({
      success: true,
      data: result.rows[0],
      message: 'Goal created successfully'
    });
  } catch (error) {
    console.error('Goal creation error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to create goal' 
    });
  }
};

const getGoals = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const goals = await analyticsService.processGoalProgress(userId);
    
    res.json({
      success: true,
      data: goals
    });
  } catch (error) {
    console.error('Goals fetch error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch goals' 
    });
  }
};

const updateGoal = async (req, res) => {
  try {
    const userId = req.user.id;
    const goalId = req.params.id;
    const { target, description, status } = req.body;
    
    const result = await pool.query(
      'UPDATE user_goals SET target = COALESCE($1, target), description = COALESCE($2, description), status = COALESCE($3, status), updated_at = CURRENT_TIMESTAMP WHERE id = $4 AND user_id = $5 RETURNING *',
      [target, description, status, goalId, userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Goal not found' 
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0],
      message: 'Goal updated successfully'
    });
  } catch (error) {
    console.error('Goal update error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to update goal' 
    });
  }
};

const checkGoalAchievements = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const achievedGoals = await analyticsService.checkGoalAchievements(userId);
    const notifications = analyticsService.generateAchievementNotifications(userId, achievedGoals);
    
    res.json({
      success: true,
      data: {
        achievedGoals,
        notifications,
        count: achievedGoals.length
      },
      message: achievedGoals.length > 0 ? 
        `Congratulations! You've achieved ${achievedGoals.length} goal(s)!` : 
        'No new goal achievements at this time'
    });
  } catch (error) {
    console.error('Goal achievement check error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to check goal achievements' 
    });
  }
};

const getGoalStreaks = async (req, res) => {
  try {
    const userId = req.user.id;
    const { metric, type } = req.query;
    
    if (!metric || !type) {
      return res.status(400).json({ 
        success: false, 
        error: 'Metric and type parameters are required' 
      });
    }
    
    const streakData = await analyticsService.calculateGoalStreak(userId, metric, type);
    
    res.json({
      success: true,
      data: streakData,
      metric,
      type
    });
  } catch (error) {
    console.error('Goal streak calculation error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to calculate goal streaks' 
    });
  }
};

const getGoalCompletionStats = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const completionStats = await analyticsService.calculateHistoricalCompletionRate(userId);
    
    res.json({
      success: true,
      data: completionStats
    });
  } catch (error) {
    console.error('Goal completion stats error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch goal completion statistics' 
    });
  }
};

const setGoalReminder = async (req, res) => {
  try {
    const userId = req.user.id;
    const goalId = req.params.id;
    const { enabled, frequency, time, message } = req.body;
    
    // Verify the goal belongs to the user
    const goalCheck = await pool.query(
      'SELECT id FROM user_goals WHERE id = $1 AND user_id = $2',
      [goalId, userId]
    );
    
    if (goalCheck.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Goal not found' 
      });
    }
    
    if (enabled) {
      // Create or update reminder
      const result = await pool.query(
        `INSERT INTO goal_reminders (user_id, goal_id, frequency, time, message, enabled) 
         VALUES ($1, $2, $3, $4, $5, $6) 
         ON CONFLICT (user_id, goal_id) 
         DO UPDATE SET frequency = $3, time = $4, message = $5, enabled = $6, updated_at = CURRENT_TIMESTAMP
         RETURNING *`,
        [userId, goalId, frequency, time, message || null, enabled]
      );
      
      res.json({
        success: true,
        data: result.rows[0],
        message: 'Goal reminder set successfully'
      });
    } else {
      // Disable reminder
      await pool.query(
        'UPDATE goal_reminders SET enabled = false, updated_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND goal_id = $2',
        [userId, goalId]
      );
      
      res.json({
        success: true,
        message: 'Goal reminder disabled successfully'
      });
    }
  } catch (error) {
    console.error('Goal reminder error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to set goal reminder' 
    });
  }
};

const exportAnalytics = async (req, res) => {
  try {
    const userId = req.user.id;
    const { format = 'pdf', timeRange = '90', metrics = 'all' } = req.query;
    
    // For now, return a placeholder response
    // PDF generation will be implemented in task 12
    res.json({
      success: true,
      message: 'Export functionality will be implemented in a future update',
      requestedFormat: format,
      timeRange: parseInt(timeRange),
      metrics: metrics
    });
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to export analytics' 
    });
  }
};

// Helper functions for insight categorization and grouping
const categorizeInsights = (insights) => {
  const categories = {};
  insights.forEach(insight => {
    if (!categories[insight.category]) {
      categories[insight.category] = [];
    }
    categories[insight.category].push(insight);
  });
  return categories;
};

const groupBySeverity = (insights) => {
  const severities = {};
  insights.forEach(insight => {
    if (!severities[insight.severity]) {
      severities[insight.severity] = [];
    }
    severities[insight.severity].push(insight);
  });
  return severities;
};

const groupByPriority = (recommendations) => {
  const priorities = {};
  recommendations.forEach(rec => {
    if (!priorities[rec.priority]) {
      priorities[rec.priority] = [];
    }
    priorities[rec.priority].push(rec);
  });
  return priorities;
};

module.exports = {
  getHealthAnalytics,
  getEducationAnalytics,
  getPersonalizedInsights,
  createGoal,
  getGoals,
  updateGoal,
  checkGoalAchievements,
  getGoalStreaks,
  getGoalCompletionStats,
  setGoalReminder,
  exportAnalytics,
  categorizeInsights,
  groupBySeverity,
  groupByPriority
};