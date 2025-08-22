const { pool } = require('../config/database');

class AnalyticsService {
  
  /**
   * Aggregate health data for analytics
   * @param {number} userId - User ID
   * @param {string} timeRange - Time range in days (7, 30, 90, 365)
   * @param {string} metrics - Comma-separated metrics or 'all'
   * @returns {Object} Aggregated health data
   */
  async aggregateHealthData(userId, timeRange = '30', metrics = 'all') {
    const days = parseInt(timeRange);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const healthData = {
      timeRange: days,
      startDate: startDate.toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0]
    };
    
    // Parse metrics
    const requestedMetrics = metrics === 'all' ? 
      ['water', 'exercise', 'period', 'constipation', 'kriya', 'typing'] : 
      metrics.split(',').map(m => m.trim());
    
    // Water intake analytics
    if (requestedMetrics.includes('water')) {
      healthData.waterIntake = await this.getWaterIntakeAnalytics(userId, startDate);
    }
    
    // Exercise analytics
    if (requestedMetrics.includes('exercise')) {
      healthData.exercise = await this.getExerciseAnalytics(userId, startDate);
    }
    
    // Period tracking analytics
    if (requestedMetrics.includes('period')) {
      healthData.periodTracking = await this.getPeriodAnalytics(userId, startDate);
    }
    
    // Constipation analytics
    if (requestedMetrics.includes('constipation')) {
      healthData.constipation = await this.getConstipationAnalytics(userId, startDate);
    }
    
    // Shambhavi Kriya analytics
    if (requestedMetrics.includes('kriya')) {
      healthData.kriya = await this.getKriyaAnalytics(userId, startDate);
    }
    
    // Typing practice analytics
    if (requestedMetrics.includes('typing')) {
      healthData.typing = await this.getTypingAnalytics(userId, startDate);
    }
    
    // Add summary statistics
    healthData.summary = await this.getHealthSummary(userId, startDate, requestedMetrics);
    
    return healthData;
  }
  
  /**
   * Get water intake analytics
   */
  async getWaterIntakeAnalytics(userId, startDate) {
    const result = await pool.query(
      `SELECT 
        DATE(date) as date,
        amount_ml,
        created_at
      FROM water_intake 
      WHERE user_id = $1 AND date >= $2 
      ORDER BY date ASC`,
      [userId, startDate]
    );
    
    const daily = result.rows;
    const totalAmount = daily.reduce((sum, entry) => sum + entry.amount_ml, 0);
    const average = daily.length > 0 ? Math.round(totalAmount / daily.length) : 0;
    
    // Enhanced trend calculation
    const trendData = this.calculateTrend(daily.map(d => d.amount_ml));
    
    // Previous period comparison
    const previousPeriodData = await this.getPreviousPeriodComparison(
      userId, 'water_intake', 'amount_ml', startDate
    );
    
    // Weekly breakdown for better insights
    const weeklyData = this.groupDataByWeek(daily, 'amount_ml');
    
    return {
      daily,
      average,
      total: totalAmount,
      trend: trendData.trend,
      trendPercentage: trendData.percentage,
      daysTracked: daily.length,
      weeklyBreakdown: weeklyData,
      comparison: previousPeriodData,
      goalProgress: await this.calculateGoalProgress(userId, 'water_intake', average)
    };
  }
  
  /**
   * Get exercise analytics
   */
  async getExerciseAnalytics(userId, startDate) {
    const result = await pool.query(
      `SELECT 
        DATE(date) as date,
        activity_type,
        footsteps,
        created_at
      FROM exercise_tracker 
      WHERE user_id = $1 AND date >= $2 
      ORDER BY date ASC`,
      [userId, startDate]
    );
    
    const daily = result.rows;
    const totalSteps = daily.reduce((sum, entry) => sum + entry.footsteps, 0);
    const averageSteps = daily.length > 0 ? Math.round(totalSteps / daily.length) : 0;
    
    // Enhanced trend calculation
    const trendData = this.calculateTrend(daily.map(d => d.footsteps));
    
    // Previous period comparison
    const previousPeriodData = await this.getPreviousPeriodComparison(
      userId, 'exercise_tracker', 'footsteps', startDate
    );
    
    // Activity type distribution
    const activityTypes = {};
    daily.forEach(entry => {
      activityTypes[entry.activity_type] = (activityTypes[entry.activity_type] || 0) + 1;
    });
    
    // Weekly breakdown
    const weeklyData = this.groupDataByWeek(daily, 'footsteps');
    
    return {
      daily,
      totalSteps,
      averageSteps,
      trend: trendData.trend,
      trendPercentage: trendData.percentage,
      activityTypes,
      weeklyBreakdown: weeklyData,
      comparison: previousPeriodData,
      daysTracked: daily.length,
      goalProgress: await this.calculateGoalProgress(userId, 'exercise_steps', averageSteps)
    };
  }
  
  /**
   * Get period tracking analytics
   */
  async getPeriodAnalytics(userId, startDate) {
    const result = await pool.query(
      `SELECT 
        DATE(pain_start_date) as date,
        notes,
        created_at
      FROM period_tracker 
      WHERE user_id = $1 AND pain_start_date >= $2 
      ORDER BY pain_start_date ASC`,
      [userId, startDate]
    );
    
    return {
      entries: result.rows,
      totalEntries: result.rows.length
    };
  }
  
  /**
   * Get constipation analytics
   */
  async getConstipationAnalytics(userId, startDate) {
    const result = await pool.query(
      `SELECT 
        DATE(date) as date,
        status,
        created_at
      FROM constipation_tracker 
      WHERE user_id = $1 AND date >= $2 
      ORDER BY date ASC`,
      [userId, startDate]
    );
    
    const daily = result.rows;
    const positiveCount = daily.filter(entry => entry.status === true).length;
    const negativeCount = daily.filter(entry => entry.status === false).length;
    const positiveRate = daily.length > 0 ? Math.round((positiveCount / daily.length) * 100) : 0;
    
    // Calculate trend based on positive rate over time
    const positiveValues = daily.map(entry => entry.status ? 1 : 0);
    const trendData = this.calculateTrend(positiveValues);
    
    // Previous period comparison
    const previousPeriodData = await this.getPreviousPeriodComparison(
      userId, 'constipation_tracker', 'CASE WHEN status THEN 1 ELSE 0 END', startDate
    );
    
    // Weekly breakdown
    const weeklyData = this.groupDataByWeek(
      daily.map(entry => ({ ...entry, status_numeric: entry.status ? 1 : 0 })), 
      'status_numeric'
    );
    
    return {
      daily,
      positiveCount,
      negativeCount,
      positiveRate,
      trend: trendData.trend,
      trendPercentage: trendData.percentage,
      weeklyBreakdown: weeklyData,
      comparison: previousPeriodData,
      daysTracked: daily.length,
      goalProgress: await this.calculateGoalProgress(userId, 'constipation_positive_rate', positiveRate)
    };
  }
  
  /**
   * Get Shambhavi Kriya analytics
   */
  async getKriyaAnalytics(userId, startDate) {
    const result = await pool.query(
      `SELECT 
        DATE(date) as date,
        notes,
        created_at
      FROM shambhavi_kriya 
      WHERE user_id = $1 AND date >= $2 
      ORDER BY date ASC`,
      [userId, startDate]
    );
    
    const daily = result.rows;
    const totalSessions = daily.length;
    
    // Calculate consistency trend (sessions per week)
    const weeklyData = this.groupDataByWeek(
      daily.map(entry => ({ ...entry, session_count: 1 })), 
      'session_count'
    );
    
    // Previous period comparison
    const previousPeriodData = await this.getPreviousPeriodComparison(
      userId, 'shambhavi_kriya', '1', startDate
    );
    
    return {
      daily,
      totalSessions,
      daysTracked: daily.length,
      weeklyBreakdown: weeklyData,
      comparison: previousPeriodData,
      consistencyRate: await this.calculateConsistencyRate(userId, 'shambhavi_kriya', startDate),
      goalProgress: await this.calculateGoalProgress(userId, 'kriya_sessions', totalSessions)
    };
  }
  
  /**
   * Get typing practice analytics
   */
  async getTypingAnalytics(userId, startDate) {
    const result = await pool.query(
      `SELECT 
        DATE(date) as date,
        completed,
        created_at
      FROM typing_practice 
      WHERE user_id = $1 AND date >= $2 
      ORDER BY date ASC`,
      [userId, startDate]
    );
    
    const daily = result.rows;
    const completedCount = daily.filter(entry => entry.completed === true).length;
    const completionRate = daily.length > 0 ? Math.round((completedCount / daily.length) * 100) : 0;
    
    // Calculate trend based on completion rate over time
    const completionValues = daily.map(entry => entry.completed ? 1 : 0);
    const trendData = this.calculateTrend(completionValues);
    
    // Previous period comparison
    const previousPeriodData = await this.getPreviousPeriodComparison(
      userId, 'typing_practice', 'CASE WHEN completed THEN 1 ELSE 0 END', startDate
    );
    
    // Weekly breakdown
    const weeklyData = this.groupDataByWeek(
      daily.map(entry => ({ ...entry, completion_numeric: entry.completed ? 1 : 0 })), 
      'completion_numeric'
    );
    
    return {
      daily,
      completedCount,
      totalDays: daily.length,
      completionRate,
      trend: trendData.trend,
      trendPercentage: trendData.percentage,
      weeklyBreakdown: weeklyData,
      comparison: previousPeriodData,
      daysTracked: daily.length,
      goalProgress: await this.calculateGoalProgress(userId, 'typing_completion_rate', completionRate)
    };
  }
  
  /**
   * Get health summary statistics
   * @param {number} userId - User ID
   * @param {Date} startDate - Start date for analysis
   * @param {Array} requestedMetrics - Array of requested metrics
   * @returns {Object} Health summary data
   */
  async getHealthSummary(userId, startDate, requestedMetrics) {
    const summary = {
      totalDataPoints: 0,
      metricsTracked: requestedMetrics.length,
      consistencyScore: 0,
      activeDays: 0
    };
    
    // Calculate total possible days
    const daysDiff = Math.ceil((new Date() - startDate) / (1000 * 60 * 60 * 24));
    
    // Get all dates where any health data was recorded
    const activeDaysResult = await pool.query(
      `SELECT DISTINCT DATE(date) as active_date FROM (
        SELECT date FROM water_intake WHERE user_id = $1 AND date >= $2
        UNION
        SELECT date FROM exercise_tracker WHERE user_id = $1 AND date >= $2
        UNION
        SELECT date FROM constipation_tracker WHERE user_id = $1 AND date >= $2
        UNION
        SELECT date FROM shambhavi_kriya WHERE user_id = $1 AND date >= $2
        UNION
        SELECT date FROM typing_practice WHERE user_id = $1 AND date >= $2
        UNION
        SELECT pain_start_date as date FROM period_tracker WHERE user_id = $1 AND pain_start_date >= $2
      ) all_dates`,
      [userId, startDate]
    );
    
    summary.activeDays = activeDaysResult.rows.length;
    summary.consistencyScore = daysDiff > 0 ? Math.round((summary.activeDays / daysDiff) * 100) : 0;
    
    // Count total data points across all metrics
    for (const metric of requestedMetrics) {
      let tableName, dateColumn = 'date';
      
      switch (metric) {
        case 'water':
          tableName = 'water_intake';
          break;
        case 'exercise':
          tableName = 'exercise_tracker';
          break;
        case 'period':
          tableName = 'period_tracker';
          dateColumn = 'pain_start_date';
          break;
        case 'constipation':
          tableName = 'constipation_tracker';
          break;
        case 'kriya':
          tableName = 'shambhavi_kriya';
          break;
        case 'typing':
          tableName = 'typing_practice';
          break;
        default:
          continue;
      }
      
      const countResult = await pool.query(
        `SELECT COUNT(*) as count FROM ${tableName} WHERE user_id = $1 AND ${dateColumn} >= $2`,
        [userId, startDate]
      );
      
      summary.totalDataPoints += parseInt(countResult.rows[0].count);
    }
    
    return summary;
  }
  
  /**
   * Calculate education progress and analytics
   * @param {number} userId - User ID
   * @param {string} timeRange - Time range in days
   * @param {string} subjects - Subject filter
   * @returns {Object} Education analytics data
   */
  async calculateEducationProgress(userId, timeRange = '30', subjects = 'all') {
    const days = parseInt(timeRange);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const educationData = {
      timeRange: days,
      startDate: startDate.toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0]
    };
    
    // Get subject progress data
    educationData.subjectProgress = await this.getSubjectProgress(userId, startDate, subjects);
    
    // Get study hours analytics
    educationData.studyHours = await this.getStudyHoursAnalytics(userId, startDate);
    
    // Get task completion analytics
    educationData.taskCompletion = await this.getTaskCompletionAnalytics(userId, startDate, subjects);
    
    // Get unit-level progress
    educationData.unitProgress = await this.getUnitProgress(userId, startDate, subjects);
    
    // Get study pattern analysis
    educationData.studyPatterns = await this.getStudyPatternAnalysis(userId, startDate);
    
    // Calculate overall education summary
    educationData.summary = await this.getEducationSummary(userId, startDate, subjects);
    
    return educationData;
  }
  
  /**
   * Generate personalized insights based on user data
   * @param {number} userId - User ID
   * @returns {Object} Generated insights and recommendations
   */
  async generateInsights(userId) {
    const insights = [];
    const recommendations = [];
    const milestones = [];
    
    // Get recent data for analysis (last 30 days)
    const healthData = await this.aggregateHealthData(userId, '30', 'all');
    const educationData = await this.calculateEducationProgress(userId, '30', 'all');
    
    // Generate health insights
    const healthInsights = await this.generateHealthInsights(userId, healthData);
    insights.push(...healthInsights.insights);
    recommendations.push(...healthInsights.recommendations);
    milestones.push(...healthInsights.milestones);
    
    // Generate education insights
    const educationInsights = await this.generateEducationInsights(userId, educationData);
    insights.push(...educationInsights.insights);
    recommendations.push(...educationInsights.recommendations);
    milestones.push(...educationInsights.milestones);
    
    // Generate cross-domain insights (health + education patterns)
    const crossDomainInsights = await this.generateCrossDomainInsights(userId, healthData, educationData);
    insights.push(...crossDomainInsights.insights);
    recommendations.push(...crossDomainInsights.recommendations);
    
    // Sort insights by severity and actionability
    const sortedInsights = this.sortInsightsBySeverity(insights);
    const sortedRecommendations = this.prioritizeRecommendations(recommendations);
    
    return {
      insights: sortedInsights,
      recommendations: sortedRecommendations,
      milestones,
      generatedAt: new Date().toISOString(),
      totalInsights: sortedInsights.length,
      actionableRecommendations: sortedRecommendations.filter(r => r.actionable).length
    };
  }

  /**
   * Generate health-specific insights
   * @param {number} userId - User ID
   * @param {Object} healthData - Health analytics data
   * @returns {Object} Health insights and recommendations
   */
  async generateHealthInsights(userId, healthData) {
    const insights = [];
    const recommendations = [];
    const milestones = [];
    
    // Water intake insights
    if (healthData.waterIntake) {
      const waterInsights = this.analyzeWaterIntakePatterns(healthData.waterIntake);
      insights.push(...waterInsights.insights);
      recommendations.push(...waterInsights.recommendations);
      milestones.push(...waterInsights.milestones);
    }
    
    // Exercise insights
    if (healthData.exercise) {
      const exerciseInsights = this.analyzeExercisePatterns(healthData.exercise);
      insights.push(...exerciseInsights.insights);
      recommendations.push(...exerciseInsights.recommendations);
      milestones.push(...exerciseInsights.milestones);
    }
    
    // Constipation insights
    if (healthData.constipation) {
      const constipationInsights = this.analyzeConstipationPatterns(healthData.constipation);
      insights.push(...constipationInsights.insights);
      recommendations.push(...constipationInsights.recommendations);
    }
    
    // Kriya practice insights
    if (healthData.kriya) {
      const kriyaInsights = this.analyzeKriyaPatterns(healthData.kriya);
      insights.push(...kriyaInsights.insights);
      recommendations.push(...kriyaInsights.recommendations);
      milestones.push(...kriyaInsights.milestones);
    }
    
    // Typing practice insights
    if (healthData.typing) {
      const typingInsights = this.analyzeTypingPatterns(healthData.typing);
      insights.push(...typingInsights.insights);
      recommendations.push(...typingInsights.recommendations);
      milestones.push(...typingInsights.milestones);
    }
    
    return { insights, recommendations, milestones };
  }

  /**
   * Generate education-specific insights
   * @param {number} userId - User ID
   * @param {Object} educationData - Education analytics data
   * @returns {Object} Education insights and recommendations
   */
  async generateEducationInsights(userId, educationData) {
    const insights = [];
    const recommendations = [];
    const milestones = [];
    
    // Study hours insights
    if (educationData.studyHours) {
      const studyInsights = this.analyzeStudyHoursPatterns(educationData.studyHours);
      insights.push(...studyInsights.insights);
      recommendations.push(...studyInsights.recommendations);
      milestones.push(...studyInsights.milestones);
    }
    
    // Subject progress insights
    if (educationData.subjectProgress) {
      const subjectInsights = this.analyzeSubjectProgressPatterns(educationData.subjectProgress);
      insights.push(...subjectInsights.insights);
      recommendations.push(...subjectInsights.recommendations);
      milestones.push(...subjectInsights.milestones);
    }
    
    // Task completion insights
    if (educationData.taskCompletion) {
      const taskInsights = this.analyzeTaskCompletionPatterns(educationData.taskCompletion);
      insights.push(...taskInsights.insights);
      recommendations.push(...taskInsights.recommendations);
    }
    
    // Study pattern insights
    if (educationData.studyPatterns) {
      const patternInsights = this.analyzeStudyPatternEfficiency(educationData.studyPatterns);
      insights.push(...patternInsights.insights);
      recommendations.push(...patternInsights.recommendations);
    }
    
    return { insights, recommendations, milestones };
  }

  /**
   * Generate cross-domain insights combining health and education data
   * @param {number} userId - User ID
   * @param {Object} healthData - Health analytics data
   * @param {Object} educationData - Education analytics data
   * @returns {Object} Cross-domain insights and recommendations
   */
  async generateCrossDomainInsights(userId, healthData, educationData) {
    const insights = [];
    const recommendations = [];
    
    // Only generate cross-domain insights if we have meaningful data
    const hasHealthData = Object.keys(healthData).length > 0;
    const hasEducationData = Object.keys(educationData).length > 0;
    
    if (!hasHealthData || !hasEducationData) {
      return { insights, recommendations };
    }
    
    // Analyze correlation between health habits and study performance
    if (healthData.waterIntake && educationData.studyHours) {
      const correlationInsight = this.analyzeHealthStudyCorrelation(
        healthData.waterIntake, 
        educationData.studyHours,
        'water_intake',
        'study_performance'
      );
      if (correlationInsight) {
        insights.push(correlationInsight.insight);
        if (correlationInsight.recommendation) {
          recommendations.push(correlationInsight.recommendation);
        }
      }
    }
    
    // Analyze exercise impact on study consistency
    if (healthData.exercise && educationData.studyHours) {
      const exerciseStudyInsight = this.analyzeHealthStudyCorrelation(
        healthData.exercise,
        educationData.studyHours,
        'exercise',
        'study_consistency'
      );
      if (exerciseStudyInsight) {
        insights.push(exerciseStudyInsight.insight);
        if (exerciseStudyInsight.recommendation) {
          recommendations.push(exerciseStudyInsight.recommendation);
        }
      }
    }
    
    // Overall wellness-productivity correlation
    const overallWellnessInsight = this.analyzeOverallWellnessProductivity(healthData, educationData);
    if (overallWellnessInsight) {
      insights.push(overallWellnessInsight.insight);
      if (overallWellnessInsight.recommendation) {
        recommendations.push(overallWellnessInsight.recommendation);
      }
    }
    
    return { insights, recommendations };
  }
  
  /**
   * Process goal progress for a user
   * @param {number} userId - User ID
   * @returns {Object} Goal progress data
   */
  async processGoalProgress(userId) {
    const result = await pool.query(
      'SELECT * FROM user_goals WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    
    const goals = [];
    
    for (const goal of result.rows) {
      const progressData = await this.calculateDetailedGoalProgress(userId, goal);
      goals.push({
        ...goal,
        ...progressData
      });
    }
    
    // Calculate overall goal statistics
    const activeGoals = goals.filter(g => g.status === 'active');
    const completedGoals = goals.filter(g => g.status === 'completed');
    const onTrackGoals = goals.filter(g => g.progressStatus === 'on_track' || g.progressStatus === 'achieved');
    
    return {
      goals,
      summary: {
        total: goals.length,
        active: activeGoals.length,
        completed: completedGoals.length,
        onTrack: onTrackGoals.length,
        averageProgress: goals.length > 0 ? Math.round(goals.reduce((sum, g) => sum + g.progress, 0) / goals.length) : 0
      }
    };
  }

  /**
   * Calculate detailed progress for a specific goal
   * @param {number} userId - User ID
   * @param {Object} goal - Goal object
   * @returns {Object} Detailed progress data
   */
  async calculateDetailedGoalProgress(userId, goal) {
    const currentValue = await this.getCurrentMetricValue(userId, goal.metric, goal.type);
    const target = parseFloat(goal.target);
    const progress = target > 0 ? Math.round((currentValue / target) * 100) : 0;
    
    // Determine progress status
    let progressStatus = 'needs_attention';
    if (progress >= 100) progressStatus = 'achieved';
    else if (progress >= 80) progressStatus = 'on_track';
    else if (progress >= 50) progressStatus = 'behind';
    
    // Calculate trend over last 7 days
    const trendData = await this.getGoalTrend(userId, goal.metric, goal.type);
    
    // Calculate days since goal creation
    const daysSinceCreation = Math.ceil((new Date() - new Date(goal.created_at)) / (1000 * 60 * 60 * 24));
    
    return {
      currentValue,
      progress: Math.min(progress, 100),
      progressStatus,
      trend: trendData.trend,
      trendPercentage: trendData.percentage,
      daysSinceCreation,
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * Get current metric value for goal calculation
   * @param {number} userId - User ID
   * @param {string} metric - Metric name
   * @param {string} type - Goal type (health/education)
   * @returns {number} Current metric value
   */
  async getCurrentMetricValue(userId, metric, type) {
    const last30Days = new Date();
    last30Days.setDate(last30Days.getDate() - 30);
    
    switch (metric) {
      case 'water_intake':
        const waterResult = await pool.query(
          'SELECT AVG(amount_ml) as avg_value FROM water_intake WHERE user_id = $1 AND date >= $2',
          [userId, last30Days]
        );
        return waterResult.rows[0].avg_value ? Math.round(parseFloat(waterResult.rows[0].avg_value)) : 0;
        
      case 'exercise_steps':
        const stepsResult = await pool.query(
          'SELECT AVG(footsteps) as avg_value FROM exercise_tracker WHERE user_id = $1 AND date >= $2',
          [userId, last30Days]
        );
        return stepsResult.rows[0].avg_value ? Math.round(parseFloat(stepsResult.rows[0].avg_value)) : 0;
        
      case 'study_hours':
        const studyResult = await pool.query(
          'SELECT AVG(hours) as avg_value FROM study_logs WHERE user_id = $1 AND date >= $2',
          [userId, last30Days]
        );
        return studyResult.rows[0].avg_value ? Math.round(parseFloat(studyResult.rows[0].avg_value)) : 0;
        
      case 'kriya_sessions':
        const kriyaResult = await pool.query(
          'SELECT COUNT(*) as total FROM shambhavi_kriya WHERE user_id = $1 AND date >= $2',
          [userId, last30Days]
        );
        return parseInt(kriyaResult.rows[0].total);
        
      case 'typing_completion_rate':
        const typingResult = await pool.query(
          'SELECT AVG(CASE WHEN completed THEN 100 ELSE 0 END) as avg_rate FROM typing_practice WHERE user_id = $1 AND date >= $2',
          [userId, last30Days]
        );
        return typingResult.rows[0].avg_rate ? Math.round(parseFloat(typingResult.rows[0].avg_rate)) : 0;
        
      case 'constipation_positive_rate':
        const constipationResult = await pool.query(
          'SELECT AVG(CASE WHEN status THEN 100 ELSE 0 END) as avg_rate FROM constipation_tracker WHERE user_id = $1 AND date >= $2',
          [userId, last30Days]
        );
        return constipationResult.rows[0].avg_rate ? Math.round(parseFloat(constipationResult.rows[0].avg_rate)) : 0;
        
      case 'task_completion_rate':
        const taskResult = await pool.query(
          'SELECT AVG(CASE WHEN completed THEN 100 ELSE 0 END) as avg_rate FROM tasks WHERE user_id = $1 AND updated_at >= $2',
          [userId, last30Days]
        );
        return taskResult.rows[0].avg_rate ? Math.round(parseFloat(taskResult.rows[0].avg_rate)) : 0;
        
      default:
        return 0;
    }
  }

  /**
   * Get goal trend over the last 7 days
   * @param {number} userId - User ID
   * @param {string} metric - Metric name
   * @param {string} type - Goal type
   * @returns {Object} Trend data
   */
  async getGoalTrend(userId, metric, type) {
    const last7Days = new Date();
    last7Days.setDate(last7Days.getDate() - 7);
    
    let values = [];
    
    switch (metric) {
      case 'water_intake':
        const waterResult = await pool.query(
          'SELECT amount_ml FROM water_intake WHERE user_id = $1 AND date >= $2 ORDER BY date ASC',
          [userId, last7Days]
        );
        values = waterResult.rows.map(row => row.amount_ml);
        break;
        
      case 'exercise_steps':
        const stepsResult = await pool.query(
          'SELECT footsteps FROM exercise_tracker WHERE user_id = $1 AND date >= $2 ORDER BY date ASC',
          [userId, last7Days]
        );
        values = stepsResult.rows.map(row => row.footsteps);
        break;
        
      case 'study_hours':
        const studyResult = await pool.query(
          'SELECT hours FROM study_logs WHERE user_id = $1 AND date >= $2 ORDER BY date ASC',
          [userId, last7Days]
        );
        values = studyResult.rows.map(row => parseFloat(row.hours));
        break;
        
      default:
        values = [];
    }
    
    return this.calculateTrend(values);
  }

  /**
   * Check for goal achievements and update goal status
   * @param {number} userId - User ID
   * @returns {Array} Array of newly achieved goals
   */
  async checkGoalAchievements(userId) {
    const activeGoals = await pool.query(
      'SELECT * FROM user_goals WHERE user_id = $1 AND status = $2',
      [userId, 'active']
    );

    const achievedGoals = [];

    for (const goal of activeGoals.rows) {
      const currentValue = await this.getCurrentMetricValue(userId, goal.metric, goal.type);
      const target = parseFloat(goal.target);
      
      if (currentValue >= target) {
        // Mark goal as completed
        await pool.query(
          'UPDATE user_goals SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
          ['completed', goal.id]
        );

        // Record achievement
        await this.recordGoalAchievement(userId, goal.id, currentValue);
        
        achievedGoals.push({
          ...goal,
          achievedValue: currentValue,
          achievedAt: new Date().toISOString()
        });
      }
    }

    return achievedGoals;
  }

  /**
   * Record a goal achievement in the database
   * @param {number} userId - User ID
   * @param {number} goalId - Goal ID
   * @param {number} achievedValue - Value achieved
   */
  async recordGoalAchievement(userId, goalId, achievedValue) {
    await pool.query(
      `INSERT INTO goal_achievements (user_id, goal_id, achieved_value, achieved_at) 
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`,
      [userId, goalId, achievedValue]
    );
  }

  /**
   * Calculate goal streaks for a user
   * @param {number} userId - User ID
   * @param {string} metric - Metric name
   * @param {string} type - Goal type
   * @returns {Object} Streak information
   */
  async calculateGoalStreak(userId, metric, type) {
    const goal = await pool.query(
      'SELECT * FROM user_goals WHERE user_id = $1 AND metric = $2 AND type = $3 ORDER BY created_at DESC LIMIT 1',
      [userId, metric, type]
    );

    if (goal.rows.length === 0) {
      return { currentStreak: 0, longestStreak: 0, lastAchievedDate: null };
    }

    const target = parseFloat(goal.rows[0].target);
    const dailyValues = await this.getDailyMetricValues(userId, metric, 30); // Last 30 days
    
    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 0;
    let lastAchievedDate = null;

    // Calculate streaks by checking if daily values meet the target
    for (let i = dailyValues.length - 1; i >= 0; i--) {
      const dailyValue = dailyValues[i];
      
      if (dailyValue.value >= target) {
        tempStreak++;
        if (i === dailyValues.length - 1) {
          currentStreak = tempStreak;
        }
        if (!lastAchievedDate) {
          lastAchievedDate = dailyValue.date;
        }
      } else {
        if (tempStreak > longestStreak) {
          longestStreak = tempStreak;
        }
        if (i === dailyValues.length - 1) {
          currentStreak = 0;
        }
        tempStreak = 0;
      }
    }

    if (tempStreak > longestStreak) {
      longestStreak = tempStreak;
    }

    return {
      currentStreak,
      longestStreak,
      lastAchievedDate
    };
  }

  /**
   * Get daily metric values for streak calculation
   * @param {number} userId - User ID
   * @param {string} metric - Metric name
   * @param {number} days - Number of days to retrieve
   * @returns {Array} Array of daily values
   */
  async getDailyMetricValues(userId, metric, days) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    let query = '';
    let valueColumn = '';

    switch (metric) {
      case 'water_intake':
        query = 'SELECT DATE(date) as date, amount_ml as value FROM water_intake WHERE user_id = $1 AND date >= $2 ORDER BY date ASC';
        break;
      case 'exercise_steps':
        query = 'SELECT DATE(date) as date, footsteps as value FROM exercise_tracker WHERE user_id = $1 AND date >= $2 ORDER BY date ASC';
        break;
      case 'study_hours':
        query = 'SELECT DATE(date) as date, hours as value FROM study_logs WHERE user_id = $1 AND date >= $2 ORDER BY date ASC';
        break;
      case 'kriya_sessions':
        query = 'SELECT DATE(date) as date, COUNT(*) as value FROM shambhavi_kriya WHERE user_id = $1 AND date >= $2 GROUP BY DATE(date) ORDER BY date ASC';
        break;
      default:
        return [];
    }

    const result = await pool.query(query, [userId, startDate]);
    return result.rows.map(row => ({
      date: row.date,
      value: parseFloat(row.value) || 0
    }));
  }

  /**
   * Calculate historical goal completion rate
   * @param {number} userId - User ID
   * @returns {Object} Completion rate statistics
   */
  async calculateHistoricalCompletionRate(userId) {
    const allGoals = await pool.query(
      'SELECT * FROM user_goals WHERE user_id = $1',
      [userId]
    );

    const completedGoals = allGoals.rows.filter(goal => goal.status === 'completed');
    const totalGoals = allGoals.rows.length;
    const completionRate = totalGoals > 0 ? Math.round((completedGoals.length / totalGoals) * 100) : 0;

    // Get completion rate by goal type
    const healthGoals = allGoals.rows.filter(goal => goal.type === 'health');
    const educationGoals = allGoals.rows.filter(goal => goal.type === 'education');
    
    const healthCompletionRate = healthGoals.length > 0 ? 
      Math.round((healthGoals.filter(g => g.status === 'completed').length / healthGoals.length) * 100) : 0;
    
    const educationCompletionRate = educationGoals.length > 0 ? 
      Math.round((educationGoals.filter(g => g.status === 'completed').length / educationGoals.length) * 100) : 0;

    // Get recent achievements (last 30 days)
    const recentAchievements = await pool.query(
      `SELECT ga.*, ug.metric, ug.type FROM goal_achievements ga 
       JOIN user_goals ug ON ga.goal_id = ug.id 
       WHERE ga.user_id = $1 AND ga.achieved_at >= $2 
       ORDER BY ga.achieved_at DESC`,
      [userId, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)]
    );

    return {
      overall: {
        totalGoals,
        completedGoals: completedGoals.length,
        completionRate
      },
      byType: {
        health: {
          total: healthGoals.length,
          completed: healthGoals.filter(g => g.status === 'completed').length,
          completionRate: healthCompletionRate
        },
        education: {
          total: educationGoals.length,
          completed: educationGoals.filter(g => g.status === 'completed').length,
          completionRate: educationCompletionRate
        }
      },
      recentAchievements: recentAchievements.rows,
      averageTimeToCompletion: await this.calculateAverageTimeToCompletion(userId)
    };
  }

  /**
   * Calculate average time to complete goals
   * @param {number} userId - User ID
   * @returns {number} Average days to completion
   */
  async calculateAverageTimeToCompletion(userId) {
    const completedGoals = await pool.query(
      `SELECT ug.created_at, ga.achieved_at 
       FROM user_goals ug 
       JOIN goal_achievements ga ON ug.id = ga.goal_id 
       WHERE ug.user_id = $1 AND ug.status = 'completed'`,
      [userId]
    );

    if (completedGoals.rows.length === 0) {
      return 0;
    }

    const totalDays = completedGoals.rows.reduce((sum, goal) => {
      const createdAt = new Date(goal.created_at);
      const achievedAt = new Date(goal.achieved_at);
      const daysDiff = Math.ceil((achievedAt - createdAt) / (1000 * 60 * 60 * 24));
      return sum + daysDiff;
    }, 0);

    return Math.round(totalDays / completedGoals.rows.length);
  }

  /**
   * Generate achievement notifications
   * @param {number} userId - User ID
   * @param {Array} achievedGoals - Array of newly achieved goals
   * @returns {Array} Array of notification objects
   */
  generateAchievementNotifications(userId, achievedGoals) {
    const notifications = [];

    for (const goal of achievedGoals) {
      notifications.push({
        type: 'goal_achievement',
        userId,
        goalId: goal.id,
        title: 'Goal Achieved! 🎉',
        message: `Congratulations! You've achieved your ${goal.type} goal: ${goal.description || goal.metric}`,
        data: {
          goalType: goal.type,
          metric: goal.metric,
          target: goal.target,
          achievedValue: goal.achievedValue,
          achievedAt: goal.achievedAt
        },
        priority: 'high',
        createdAt: new Date().toISOString()
      });

      // Add milestone notifications for significant achievements
      if (goal.type === 'health' && goal.metric === 'water_intake' && goal.achievedValue >= 2000) {
        notifications.push({
          type: 'milestone',
          userId,
          title: 'Hydration Hero! 💧',
          message: 'You\'re maintaining excellent hydration habits!',
          priority: 'medium',
          createdAt: new Date().toISOString()
        });
      }

      if (goal.type === 'education' && goal.metric === 'study_hours' && goal.achievedValue >= 4) {
        notifications.push({
          type: 'milestone',
          userId,
          title: 'Study Champion! 📚',
          message: 'Your dedication to learning is paying off!',
          priority: 'medium',
          createdAt: new Date().toISOString()
        });
      }
    }

    return notifications;
  }
  
  /**
   * Calculate trend from data array using linear regression
   * @param {Array} values - Array of numeric values
   * @returns {Object} Trend information
   */
  calculateTrend(values) {
    if (values.length < 2) {
      return { trend: 'insufficient_data', percentage: 0 };
    }
    
    // Simple trend calculation using first half vs second half
    const midPoint = Math.floor(values.length / 2);
    const firstHalf = values.slice(0, midPoint);
    const secondHalf = values.slice(midPoint);
    
    const firstHalfAvg = firstHalf.reduce((sum, val) => sum + val, 0) / firstHalf.length;
    const secondHalfAvg = secondHalf.reduce((sum, val) => sum + val, 0) / secondHalf.length;
    
    const percentageChange = firstHalfAvg > 0 ? 
      Math.round(((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100) : 0;
    
    let trend = 'stable';
    if (percentageChange > 10) trend = 'increasing';
    else if (percentageChange < -10) trend = 'decreasing';
    
    return {
      trend,
      percentage: percentageChange
    };
  }
  
  /**
   * Get previous period comparison data
   * @param {number} userId - User ID
   * @param {string} tableName - Database table name
   * @param {string} valueColumn - Column to aggregate
   * @param {Date} currentStartDate - Current period start date
   * @returns {Object} Comparison data
   */
  async getPreviousPeriodComparison(userId, tableName, valueColumn, currentStartDate) {
    const daysDiff = Math.ceil((new Date() - currentStartDate) / (1000 * 60 * 60 * 24));
    const previousStartDate = new Date(currentStartDate);
    previousStartDate.setDate(previousStartDate.getDate() - daysDiff);
    
    const previousEndDate = new Date(currentStartDate);
    previousEndDate.setDate(previousEndDate.getDate() - 1);
    
    let dateColumn = 'date';
    if (tableName === 'period_tracker') {
      dateColumn = 'pain_start_date';
    }
    
    const result = await pool.query(
      `SELECT AVG(${valueColumn}) as avg_value, COUNT(*) as count 
       FROM ${tableName} 
       WHERE user_id = $1 AND ${dateColumn} >= $2 AND ${dateColumn} <= $3`,
      [userId, previousStartDate, previousEndDate]
    );
    
    const previousAvg = result.rows[0].avg_value ? Math.round(parseFloat(result.rows[0].avg_value)) : 0;
    const previousCount = parseInt(result.rows[0].count);
    
    return {
      previousAverage: previousAvg,
      previousCount,
      periodStart: previousStartDate.toISOString().split('T')[0],
      periodEnd: previousEndDate.toISOString().split('T')[0]
    };
  }
  
  /**
   * Group data by week for weekly breakdown
   * @param {Array} dailyData - Array of daily data points
   * @param {string} valueField - Field name containing the value
   * @returns {Array} Weekly grouped data
   */
  groupDataByWeek(dailyData, valueField) {
    const weeks = {};
    
    dailyData.forEach(entry => {
      const date = new Date(entry.date);
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay()); // Start of week (Sunday)
      const weekKey = weekStart.toISOString().split('T')[0];
      
      if (!weeks[weekKey]) {
        weeks[weekKey] = {
          weekStart: weekKey,
          values: [],
          total: 0,
          count: 0
        };
      }
      
      weeks[weekKey].values.push(entry[valueField]);
      weeks[weekKey].total += entry[valueField];
      weeks[weekKey].count += 1;
    });
    
    // Convert to array and calculate averages
    return Object.values(weeks).map(week => ({
      ...week,
      average: Math.round(week.total / week.count)
    })).sort((a, b) => new Date(a.weekStart) - new Date(b.weekStart));
  }
  
  /**
   * Calculate goal progress for a specific metric
   * @param {number} userId - User ID
   * @param {string} metric - Metric name
   * @param {number} currentValue - Current average value
   * @returns {Object} Goal progress data
   */
  async calculateGoalProgress(userId, metric, currentValue) {
    const result = await pool.query(
      'SELECT * FROM user_goals WHERE user_id = $1 AND metric = $2 AND status = $3 ORDER BY created_at DESC LIMIT 1',
      [userId, metric, 'active']
    );
    
    if (result.rows.length === 0) {
      return null;
    }
    
    const goal = result.rows[0];
    const target = parseFloat(goal.target);
    const progress = target > 0 ? Math.round((currentValue / target) * 100) : 0;
    
    return {
      goalId: goal.id,
      target,
      current: currentValue,
      progress: Math.min(progress, 100), // Cap at 100%
      status: progress >= 100 ? 'achieved' : progress >= 80 ? 'on_track' : progress >= 50 ? 'behind' : 'needs_attention'
    };
  }
  
  /**
   * Calculate consistency rate for activities
   * @param {number} userId - User ID
   * @param {string} tableName - Database table name
   * @param {Date} startDate - Start date for analysis
   * @returns {number} Consistency rate percentage
   */
  async calculateConsistencyRate(userId, tableName, startDate) {
    const daysDiff = Math.ceil((new Date() - startDate) / (1000 * 60 * 60 * 24));
    
    let dateColumn = 'date';
    if (tableName === 'period_tracker') {
      dateColumn = 'pain_start_date';
    }
    
    const result = await pool.query(
      `SELECT COUNT(DISTINCT ${dateColumn}) as active_days FROM ${tableName} WHERE user_id = $1 AND ${dateColumn} >= $2`,
      [userId, startDate]
    );
    
    const activeDays = parseInt(result.rows[0].active_days);
    return daysDiff > 0 ? Math.round((activeDays / daysDiff) * 100) : 0;
  }

  /**
   * Get subject progress analytics
   * @param {number} userId - User ID
   * @param {Date} startDate - Start date for analysis
   * @param {string} subjects - Subject filter
   * @returns {Array} Subject progress data
   */
  async getSubjectProgress(userId, startDate, subjects) {
    let subjectFilter = '';
    let params = [userId, startDate];
    
    if (subjects !== 'all') {
      const subjectCodes = subjects.split(',').map(s => s.trim());
      subjectFilter = `AND s.code = ANY($3)`;
      params.push(subjectCodes);
    }
    
    const result = await pool.query(`
      SELECT 
        s.id as subject_id,
        s.code as subject_code,
        s.name as subject_name,
        COUNT(DISTINCT u.id) as total_units,
        COUNT(DISTINCT t.id) as total_tasks,
        COUNT(DISTINCT CASE WHEN t.completed = true THEN t.id END) as completed_tasks,
        COUNT(DISTINCT nt.id) as total_nptel_tasks,
        COUNT(DISTINCT CASE WHEN nt.completed = true THEN nt.id END) as completed_nptel_tasks,
        COUNT(DISTINCT rp.id) as total_research_projects,
        COALESCE(AVG(sl.hours), 0) as avg_daily_study_hours,
        SUM(sl.hours) as total_study_hours
      FROM subjects s
      LEFT JOIN units u ON s.id = u.subject_id
      LEFT JOIN tasks t ON u.id = t.unit_id AND t.user_id = $1
      LEFT JOIN nptel_tasks nt ON s.id = nt.subject_id AND nt.user_id = $1
      LEFT JOIN research_projects rp ON s.id = rp.subject_id AND rp.user_id = $1
      LEFT JOIN study_logs sl ON sl.user_id = $1 AND sl.date >= $2
      WHERE 1=1 ${subjectFilter}
      GROUP BY s.id, s.code, s.name
      ORDER BY s.code
    `, params);
    
    return result.rows.map(row => ({
      subjectId: row.subject_id,
      subjectCode: row.subject_code,
      subjectName: row.subject_name,
      totalUnits: parseInt(row.total_units),
      totalTasks: parseInt(row.total_tasks),
      completedTasks: parseInt(row.completed_tasks),
      taskCompletionRate: row.total_tasks > 0 ? Math.round((row.completed_tasks / row.total_tasks) * 100) : 0,
      totalNptelTasks: parseInt(row.total_nptel_tasks),
      completedNptelTasks: parseInt(row.completed_nptel_tasks),
      nptelCompletionRate: row.total_nptel_tasks > 0 ? Math.round((row.completed_nptel_tasks / row.total_nptel_tasks) * 100) : 0,
      totalResearchProjects: parseInt(row.total_research_projects),
      avgDailyStudyHours: parseFloat(row.avg_daily_study_hours).toFixed(2),
      totalStudyHours: parseFloat(row.total_study_hours) || 0
    }));
  }

  /**
   * Get study hours analytics
   * @param {number} userId - User ID
   * @param {Date} startDate - Start date for analysis
   * @returns {Object} Study hours analytics data
   */
  async getStudyHoursAnalytics(userId, startDate) {
    const result = await pool.query(`
      SELECT 
        DATE(date) as date,
        hours,
        created_at
      FROM study_logs 
      WHERE user_id = $1 AND date >= $2 
      ORDER BY date ASC
    `, [userId, startDate]);
    
    const daily = result.rows;
    const totalHours = daily.reduce((sum, entry) => sum + parseFloat(entry.hours), 0);
    const averageHours = daily.length > 0 ? (totalHours / daily.length).toFixed(2) : 0;
    
    // Calculate trend
    const trendData = this.calculateTrend(daily.map(d => parseFloat(d.hours)));
    
    // Previous period comparison
    const previousPeriodData = await this.getPreviousPeriodComparison(
      userId, 'study_logs', 'hours', startDate
    );
    
    // Weekly breakdown
    const weeklyData = this.groupDataByWeek(
      daily.map(entry => ({ ...entry, hours: parseFloat(entry.hours) })), 
      'hours'
    );
    
    // Calculate consistency (days studied vs total days)
    const daysDiff = Math.ceil((new Date() - startDate) / (1000 * 60 * 60 * 24));
    const consistencyRate = daysDiff > 0 ? Math.round((daily.length / daysDiff) * 100) : 0;
    
    return {
      daily,
      totalHours: parseFloat(totalHours.toFixed(2)),
      averageHours: parseFloat(averageHours),
      trend: trendData.trend,
      trendPercentage: trendData.percentage,
      weeklyBreakdown: weeklyData,
      comparison: previousPeriodData,
      daysStudied: daily.length,
      consistencyRate,
      goalProgress: await this.calculateGoalProgress(userId, 'daily_study_hours', parseFloat(averageHours))
    };
  }

  /**
   * Get task completion analytics
   * @param {number} userId - User ID
   * @param {Date} startDate - Start date for analysis
   * @param {string} subjects - Subject filter
   * @returns {Object} Task completion analytics data
   */
  async getTaskCompletionAnalytics(userId, startDate, subjects) {
    let subjectFilter = '';
    let overallSubjectFilter = '';
    let params = [userId, startDate];
    let overallParams = [userId];
    
    if (subjects !== 'all') {
      const subjectCodes = subjects.split(',').map(s => s.trim());
      subjectFilter = `AND s.code = ANY($3)`;
      overallSubjectFilter = `AND s.code = ANY($2)`;
      params.push(subjectCodes);
      overallParams.push(subjectCodes);
    }
    
    // Get task completion data over time
    const taskCompletionResult = await pool.query(`
      SELECT 
        DATE(t.updated_at) as completion_date,
        s.code as subject_code,
        s.name as subject_name,
        COUNT(*) as tasks_completed
      FROM tasks t
      JOIN units u ON t.unit_id = u.id
      JOIN subjects s ON u.subject_id = s.id
      WHERE t.user_id = $1 AND t.completed = true AND DATE(t.updated_at) >= $2 ${subjectFilter}
      GROUP BY DATE(t.updated_at), s.code, s.name
      ORDER BY completion_date ASC
    `, params);
    
    // Get NPTEL task completion data
    const nptelCompletionResult = await pool.query(`
      SELECT 
        DATE(nt.updated_at) as completion_date,
        s.code as subject_code,
        s.name as subject_name,
        COUNT(*) as nptel_tasks_completed
      FROM nptel_tasks nt
      JOIN subjects s ON nt.subject_id = s.id
      WHERE nt.user_id = $1 AND nt.completed = true AND DATE(nt.updated_at) >= $2 ${subjectFilter}
      GROUP BY DATE(nt.updated_at), s.code, s.name
      ORDER BY completion_date ASC
    `, params);
    
    // Calculate overall completion rates
    const overallStatsResult = await pool.query(`
      SELECT 
        COUNT(DISTINCT t.id) as total_tasks,
        COUNT(DISTINCT CASE WHEN t.completed = true THEN t.id END) as completed_tasks,
        COUNT(DISTINCT nt.id) as total_nptel_tasks,
        COUNT(DISTINCT CASE WHEN nt.completed = true THEN nt.id END) as completed_nptel_tasks
      FROM subjects s
      LEFT JOIN units u ON s.id = u.subject_id
      LEFT JOIN tasks t ON u.id = t.unit_id AND t.user_id = $1
      LEFT JOIN nptel_tasks nt ON s.id = nt.subject_id AND nt.user_id = $1
      WHERE 1=1 ${overallSubjectFilter}
    `, overallParams);
    
    const stats = overallStatsResult.rows[0];
    const totalTasks = parseInt(stats.total_tasks) + parseInt(stats.total_nptel_tasks);
    const completedTasks = parseInt(stats.completed_tasks) + parseInt(stats.completed_nptel_tasks);
    const overallCompletionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    
    return {
      dailyTaskCompletions: taskCompletionResult.rows,
      dailyNptelCompletions: nptelCompletionResult.rows,
      totalTasks,
      completedTasks,
      overallCompletionRate,
      regularTasksCompletionRate: stats.total_tasks > 0 ? Math.round((stats.completed_tasks / stats.total_tasks) * 100) : 0,
      nptelTasksCompletionRate: stats.total_nptel_tasks > 0 ? Math.round((stats.completed_nptel_tasks / stats.total_nptel_tasks) * 100) : 0
    };
  }

  /**
   * Get unit-level progress analytics
   * @param {number} userId - User ID
   * @param {Date} startDate - Start date for analysis
   * @param {string} subjects - Subject filter
   * @returns {Array} Unit progress data
   */
  async getUnitProgress(userId, startDate, subjects) {
    let subjectFilter = '';
    let params = [userId];
    
    if (subjects !== 'all') {
      const subjectCodes = subjects.split(',').map(s => s.trim());
      subjectFilter = `AND s.code = ANY($2)`;
      params.push(subjectCodes);
    }
    
    const result = await pool.query(`
      SELECT 
        s.code as subject_code,
        s.name as subject_name,
        u.id as unit_id,
        u.unit_number,
        u.title as unit_title,
        COUNT(t.id) as total_tasks,
        COUNT(CASE WHEN t.completed = true THEN t.id END) as completed_tasks
      FROM subjects s
      JOIN units u ON s.id = u.subject_id
      LEFT JOIN tasks t ON u.id = t.unit_id AND t.user_id = $1
      WHERE 1=1 ${subjectFilter}
      GROUP BY s.code, s.name, u.id, u.unit_number, u.title
      ORDER BY s.code, u.unit_number
    `, params);
    
    return result.rows.map(row => ({
      subjectCode: row.subject_code,
      subjectName: row.subject_name,
      unitId: row.unit_id,
      unitNumber: row.unit_number,
      unitTitle: row.unit_title,
      totalTasks: parseInt(row.total_tasks),
      completedTasks: parseInt(row.completed_tasks),
      completionRate: row.total_tasks > 0 ? Math.round((row.completed_tasks / row.total_tasks) * 100) : 0,
      status: row.total_tasks === 0 ? 'no_tasks' : 
              row.completed_tasks === row.total_tasks ? 'completed' :
              row.completed_tasks > 0 ? 'in_progress' : 'not_started'
    }));
  }

  /**
   * Get education summary statistics
   * @param {number} userId - User ID
   * @param {Date} startDate - Start date for analysis
   * @param {string} subjects - Subject filter
   * @returns {Object} Education summary data
   */
  async getEducationSummary(userId, startDate, subjects) {
    let subjectFilter = '';
    let params = [userId, startDate];
    
    if (subjects !== 'all') {
      const subjectCodes = subjects.split(',').map(s => s.trim());
      subjectFilter = `AND s.code = ANY($3)`;
      params.push(subjectCodes);
    }
    
    // Get overall statistics
    const statsResult = await pool.query(`
      SELECT 
        COUNT(DISTINCT s.id) as total_subjects,
        COUNT(DISTINCT u.id) as total_units,
        COUNT(DISTINCT t.id) as total_tasks,
        COUNT(DISTINCT CASE WHEN t.completed = true THEN t.id END) as completed_tasks,
        COUNT(DISTINCT nt.id) as total_nptel_tasks,
        COUNT(DISTINCT CASE WHEN nt.completed = true THEN nt.id END) as completed_nptel_tasks,
        COUNT(DISTINCT rp.id) as total_research_projects,
        COALESCE(SUM(sl.hours), 0) as total_study_hours,
        COUNT(DISTINCT sl.date) as days_studied
      FROM subjects s
      LEFT JOIN units u ON s.id = u.subject_id
      LEFT JOIN tasks t ON u.id = t.unit_id AND t.user_id = $1
      LEFT JOIN nptel_tasks nt ON s.id = nt.subject_id AND nt.user_id = $1
      LEFT JOIN research_projects rp ON s.id = rp.subject_id AND rp.user_id = $1
      LEFT JOIN study_logs sl ON sl.user_id = $1 AND sl.date >= $2
      WHERE 1=1 ${subjectFilter}
    `, params);
    
    const stats = statsResult.rows[0];
    const totalTasks = parseInt(stats.total_tasks) + parseInt(stats.total_nptel_tasks);
    const completedTasks = parseInt(stats.completed_tasks) + parseInt(stats.completed_nptel_tasks);
    const overallCompletionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    
    // Calculate study consistency
    const daysDiff = Math.ceil((new Date() - startDate) / (1000 * 60 * 60 * 24));
    const studyConsistency = daysDiff > 0 ? Math.round((parseInt(stats.days_studied) / daysDiff) * 100) : 0;
    
    return {
      totalSubjects: parseInt(stats.total_subjects),
      totalUnits: parseInt(stats.total_units),
      totalTasks,
      completedTasks,
      overallCompletionRate,
      totalNptelTasks: parseInt(stats.total_nptel_tasks),
      completedNptelTasks: parseInt(stats.completed_nptel_tasks),
      totalResearchProjects: parseInt(stats.total_research_projects),
      totalStudyHours: parseFloat(stats.total_study_hours),
      daysStudied: parseInt(stats.days_studied),
      studyConsistency,
      averageDailyStudyHours: stats.days_studied > 0 ? (parseFloat(stats.total_study_hours) / parseInt(stats.days_studied)).toFixed(2) : 0
    };
  }
  /**
   * Get study pattern analysis
   * @param {number} userId - User ID
   * @param {Date} startDate - Start date for analysis
   * @returns {Object} Study pattern analysis data
   */
  async getStudyPatternAnalysis(userId, startDate) {
    // Get daily study patterns
    const dailyPatternResult = await pool.query(`
      SELECT 
        EXTRACT(DOW FROM date) as day_of_week,
        AVG(hours) as avg_hours,
        COUNT(*) as study_days,
        SUM(hours) as total_hours
      FROM study_logs 
      WHERE user_id = $1 AND date >= $2 
      GROUP BY EXTRACT(DOW FROM date)
      ORDER BY day_of_week
    `, [userId, startDate]);
    
    // Map day numbers to names
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dailyPatterns = dailyPatternResult.rows.map(row => ({
      dayOfWeek: parseInt(row.day_of_week),
      dayName: dayNames[parseInt(row.day_of_week)],
      averageHours: parseFloat(row.avg_hours).toFixed(2),
      studyDays: parseInt(row.study_days),
      totalHours: parseFloat(row.total_hours)
    }));
    
    // Calculate productivity patterns (based on study hours distribution)
    const productivityAnalysis = this.calculateProductivityPatterns(dailyPatterns);
    
    // Get subject performance comparison
    const subjectPerformance = await this.getSubjectPerformanceComparison(userId, startDate);
    
    // Calculate study consistency patterns
    const consistencyPatterns = await this.calculateStudyConsistencyPatterns(userId, startDate);
    
    // Time-of-day analysis (placeholder - would need more detailed time tracking)
    const timeOfDayAnalysis = {
      message: 'Detailed time-of-day analysis requires session-level time tracking',
      recommendation: 'Consider implementing study session tracking with start/end times for more detailed insights',
      currentCapability: 'Daily study hours only'
    };
    
    return {
      dailyPatterns,
      productivityAnalysis,
      subjectPerformance,
      consistencyPatterns,
      timeOfDayAnalysis
    };
  }

  /**
   * Calculate productivity patterns from daily study data
   * @param {Array} dailyPatterns - Daily study pattern data
   * @returns {Object} Productivity analysis
   */
  calculateProductivityPatterns(dailyPatterns) {
    if (dailyPatterns.length === 0) {
      return {
        mostProductiveDay: null,
        leastProductiveDay: null,
        weekdayVsWeekendRatio: 0,
        consistencyScore: 0
      };
    }
    
    // Find most and least productive days
    const sortedByHours = [...dailyPatterns].sort((a, b) => parseFloat(b.averageHours) - parseFloat(a.averageHours));
    const mostProductiveDay = sortedByHours[0];
    const leastProductiveDay = sortedByHours[sortedByHours.length - 1];
    
    // Calculate weekday vs weekend ratio
    const weekdays = dailyPatterns.filter(day => day.dayOfWeek >= 1 && day.dayOfWeek <= 5);
    const weekends = dailyPatterns.filter(day => day.dayOfWeek === 0 || day.dayOfWeek === 6);
    
    const weekdayAvg = weekdays.length > 0 ? 
      weekdays.reduce((sum, day) => sum + parseFloat(day.averageHours), 0) / weekdays.length : 0;
    const weekendAvg = weekends.length > 0 ? 
      weekends.reduce((sum, day) => sum + parseFloat(day.averageHours), 0) / weekends.length : 0;
    
    const weekdayVsWeekendRatio = weekendAvg > 0 ? (weekdayAvg / weekendAvg).toFixed(2) : 0;
    
    // Calculate consistency score (based on standard deviation)
    const allHours = dailyPatterns.map(day => parseFloat(day.averageHours));
    const mean = allHours.reduce((sum, hours) => sum + hours, 0) / allHours.length;
    const variance = allHours.reduce((sum, hours) => sum + Math.pow(hours - mean, 2), 0) / allHours.length;
    const stdDev = Math.sqrt(variance);
    const consistencyScore = mean > 0 ? Math.max(0, Math.round((1 - (stdDev / mean)) * 100)) : 0;
    
    return {
      mostProductiveDay: mostProductiveDay ? {
        day: mostProductiveDay.dayName,
        averageHours: mostProductiveDay.averageHours
      } : null,
      leastProductiveDay: leastProductiveDay ? {
        day: leastProductiveDay.dayName,
        averageHours: leastProductiveDay.averageHours
      } : null,
      weekdayVsWeekendRatio: parseFloat(weekdayVsWeekendRatio),
      weekdayAverage: weekdayAvg.toFixed(2),
      weekendAverage: weekendAvg.toFixed(2),
      consistencyScore
    };
  }

  /**
   * Get subject performance comparison
   * @param {number} userId - User ID
   * @param {Date} startDate - Start date for analysis
   * @returns {Array} Subject performance comparison data
   */
  async getSubjectPerformanceComparison(userId, startDate) {
    const result = await pool.query(`
      SELECT 
        s.code as subject_code,
        s.name as subject_name,
        COUNT(DISTINCT t.id) as total_tasks,
        COUNT(DISTINCT CASE WHEN t.completed = true THEN t.id END) as completed_tasks,
        COUNT(DISTINCT nt.id) as total_nptel_tasks,
        COUNT(DISTINCT CASE WHEN nt.completed = true THEN nt.id END) as completed_nptel_tasks,
        AVG(CASE WHEN t.completed = true THEN 
          EXTRACT(EPOCH FROM (t.updated_at - t.created_at)) / 86400 
        END) as avg_task_completion_days,
        COUNT(DISTINCT CASE WHEN t.completed = true AND DATE(t.updated_at) >= $2 THEN t.id END) as recent_completions
      FROM subjects s
      LEFT JOIN units u ON s.id = u.subject_id
      LEFT JOIN tasks t ON u.id = t.unit_id AND t.user_id = $1
      LEFT JOIN nptel_tasks nt ON s.id = nt.subject_id AND nt.user_id = $1
      GROUP BY s.id, s.code, s.name
      HAVING COUNT(DISTINCT t.id) > 0 OR COUNT(DISTINCT nt.id) > 0
      ORDER BY s.code
    `, [userId, startDate]);
    
    return result.rows.map(row => {
      const totalTasks = parseInt(row.total_tasks) + parseInt(row.total_nptel_tasks);
      const completedTasks = parseInt(row.completed_tasks) + parseInt(row.completed_nptel_tasks);
      const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
      
      return {
        subjectCode: row.subject_code,
        subjectName: row.subject_name,
        totalTasks,
        completedTasks,
        completionRate,
        averageTaskCompletionDays: row.avg_task_completion_days ? 
          parseFloat(row.avg_task_completion_days).toFixed(1) : null,
        recentCompletions: parseInt(row.recent_completions),
        performanceLevel: completionRate >= 80 ? 'excellent' : 
                         completionRate >= 60 ? 'good' : 
                         completionRate >= 40 ? 'average' : 'needs_improvement'
      };
    });
  }

  /**
   * Calculate study consistency patterns
   * @param {number} userId - User ID
   * @param {Date} startDate - Start date for analysis
   * @returns {Object} Study consistency analysis
   */
  async calculateStudyConsistencyPatterns(userId, startDate) {
    // Get all study days in the period
    const studyDaysResult = await pool.query(`
      SELECT 
        DATE(date) as study_date,
        hours
      FROM study_logs 
      WHERE user_id = $1 AND date >= $2 
      ORDER BY date ASC
    `, [userId, startDate]);
    
    const studyDays = studyDaysResult.rows;
    const totalDays = Math.ceil((new Date() - startDate) / (1000 * 60 * 60 * 24));
    
    if (studyDays.length === 0) {
      return {
        totalDays,
        studyDays: 0,
        consistencyRate: 0,
        longestStreak: 0,
        currentStreak: 0,
        averageGapBetweenSessions: 0,
        patterns: []
      };
    }
    
    // Calculate streaks and gaps
    const streaks = [];
    const gaps = [];
    let currentStreak = 1;
    let longestStreak = 1;
    
    for (let i = 1; i < studyDays.length; i++) {
      const prevDate = new Date(studyDays[i - 1].study_date);
      const currDate = new Date(studyDays[i].study_date);
      const daysDiff = Math.round((currDate - prevDate) / (1000 * 60 * 60 * 24));
      
      if (daysDiff === 1) {
        currentStreak++;
      } else {
        streaks.push(currentStreak);
        longestStreak = Math.max(longestStreak, currentStreak);
        gaps.push(daysDiff - 1);
        currentStreak = 1;
      }
    }
    
    streaks.push(currentStreak);
    longestStreak = Math.max(longestStreak, currentStreak);
    
    // Calculate current streak (from most recent study day to today)
    const lastStudyDate = new Date(studyDays[studyDays.length - 1].study_date);
    const today = new Date();
    const daysSinceLastStudy = Math.round((today - lastStudyDate) / (1000 * 60 * 60 * 24));
    const currentActiveStreak = daysSinceLastStudy <= 1 ? currentStreak : 0;
    
    const averageGap = gaps.length > 0 ? Math.round(gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length) : 0;
    const consistencyRate = Math.round((studyDays.length / totalDays) * 100);
    
    return {
      totalDays,
      studyDays: studyDays.length,
      consistencyRate,
      longestStreak,
      currentStreak: currentActiveStreak,
      averageGapBetweenSessions: averageGap,
      patterns: {
        totalStreaks: streaks.length,
        averageStreakLength: streaks.length > 0 ? Math.round(streaks.reduce((sum, streak) => sum + streak, 0) / streaks.length) : 0,
        totalGaps: gaps.length,
        longestGap: gaps.length > 0 ? Math.max(...gaps) : 0
      }
    };
  }

  /**
   * Analyze water intake patterns and generate insights
   * @param {Object} waterData - Water intake analytics data
   * @returns {Object} Water intake insights and recommendations
   */
  analyzeWaterIntakePatterns(waterData) {
    const insights = [];
    const recommendations = [];
    const milestones = [];
    
    const { average, trend, trendPercentage, comparison, goalProgress, daysTracked } = waterData;
    const recommendedDaily = 2000; // 2L recommended daily intake
    
    // Trend analysis
    if (trend === 'increasing' && trendPercentage > 15) {
      insights.push({
        type: 'health',
        category: 'water_intake',
        message: `Your water intake has improved by ${trendPercentage}% this month - excellent progress!`,
        severity: 'positive',
        actionable: false,
        icon: '💧',
        timestamp: new Date().toISOString()
      });
    } else if (trend === 'decreasing' && trendPercentage < -15) {
      insights.push({
        type: 'health',
        category: 'water_intake',
        message: `Your water intake has decreased by ${Math.abs(trendPercentage)}% this month`,
        severity: 'warning',
        actionable: true,
        icon: '⚠️',
        timestamp: new Date().toISOString()
      });
      
      recommendations.push({
        type: 'health',
        category: 'water_intake',
        message: 'Set hourly reminders to drink water throughout the day',
        actionable: true,
        priority: 'high',
        estimatedImpact: 'high',
        icon: '⏰'
      });
    }
    
    // Adequacy analysis
    if (average < recommendedDaily * 0.7) {
      insights.push({
        type: 'health',
        category: 'water_intake',
        message: `Your daily water intake (${average}ml) is significantly below the recommended 2L`,
        severity: 'critical',
        actionable: true,
        icon: '🚨',
        timestamp: new Date().toISOString()
      });
      
      recommendations.push({
        type: 'health',
        category: 'water_intake',
        message: 'Gradually increase water intake by 200ml every few days until reaching 2L daily',
        actionable: true,
        priority: 'high',
        estimatedImpact: 'high',
        icon: '📈'
      });
    } else if (average >= recommendedDaily) {
      milestones.push({
        type: 'achievement',
        category: 'water_intake',
        message: 'Congratulations! You\'re meeting your daily hydration goals',
        icon: '🎉',
        timestamp: new Date().toISOString()
      });
    }
    
    // Consistency analysis
    if (daysTracked < 20) {
      recommendations.push({
        type: 'health',
        category: 'water_intake',
        message: 'Track your water intake more consistently for better insights',
        actionable: true,
        priority: 'medium',
        estimatedImpact: 'medium',
        icon: '📊'
      });
    }
    
    // Goal progress analysis
    if (goalProgress && goalProgress.status === 'achieved') {
      milestones.push({
        type: 'goal_achievement',
        category: 'water_intake',
        message: `Goal achieved! You've reached ${goalProgress.progress}% of your water intake target`,
        icon: '🏆',
        timestamp: new Date().toISOString()
      });
    }
    
    return { insights, recommendations, milestones };
  }

  /**
   * Analyze exercise patterns and generate insights
   * @param {Object} exerciseData - Exercise analytics data
   * @returns {Object} Exercise insights and recommendations
   */
  analyzeExercisePatterns(exerciseData) {
    const insights = [];
    const recommendations = [];
    const milestones = [];
    
    const { averageSteps, trend, trendPercentage, activityTypes, daysTracked, goalProgress } = exerciseData;
    const recommendedSteps = 8000; // Recommended daily steps
    
    // Step count analysis
    if (averageSteps >= recommendedSteps) {
      insights.push({
        type: 'health',
        category: 'exercise',
        message: `Great job! Your average ${averageSteps} daily steps exceeds the recommended ${recommendedSteps}`,
        severity: 'positive',
        actionable: false,
        icon: '👟',
        timestamp: new Date().toISOString()
      });
      
      milestones.push({
        type: 'achievement',
        category: 'exercise',
        message: 'You\'re maintaining an active lifestyle with consistent daily movement',
        icon: '🎯',
        timestamp: new Date().toISOString()
      });
    } else if (averageSteps < recommendedSteps * 0.6) {
      insights.push({
        type: 'health',
        category: 'exercise',
        message: `Your average ${averageSteps} daily steps is below recommended levels`,
        severity: 'warning',
        actionable: true,
        icon: '⚠️',
        timestamp: new Date().toISOString()
      });
      
      recommendations.push({
        type: 'health',
        category: 'exercise',
        message: 'Try taking short walks during breaks or using stairs instead of elevators',
        actionable: true,
        priority: 'high',
        estimatedImpact: 'high',
        icon: '🚶'
      });
    }
    
    // Trend analysis
    if (trend === 'increasing' && trendPercentage > 20) {
      insights.push({
        type: 'health',
        category: 'exercise',
        message: `Your activity level has increased by ${trendPercentage}% - keep up the momentum!`,
        severity: 'positive',
        actionable: false,
        icon: '📈',
        timestamp: new Date().toISOString()
      });
    }
    
    // Activity variety analysis
    const activityCount = Object.keys(activityTypes).length;
    if (activityCount === 1) {
      recommendations.push({
        type: 'health',
        category: 'exercise',
        message: 'Consider adding variety to your exercise routine with different activities',
        actionable: true,
        priority: 'medium',
        estimatedImpact: 'medium',
        icon: '🔄'
      });
    } else if (activityCount >= 3) {
      insights.push({
        type: 'health',
        category: 'exercise',
        message: 'Excellent variety in your exercise routine with multiple activity types',
        severity: 'positive',
        actionable: false,
        icon: '🌟',
        timestamp: new Date().toISOString()
      });
    }
    
    return { insights, recommendations, milestones };
  }

  /**
   * Analyze constipation patterns and generate insights
   * @param {Object} constipationData - Constipation analytics data
   * @returns {Object} Constipation insights and recommendations
   */
  analyzeConstipationPatterns(constipationData) {
    const insights = [];
    const recommendations = [];
    
    const { positiveRate, trend, trendPercentage, daysTracked } = constipationData;
    
    // Rate analysis
    if (positiveRate > 80) {
      insights.push({
        type: 'health',
        category: 'constipation',
        message: `Your digestive health is excellent with ${positiveRate}% positive days`,
        severity: 'positive',
        actionable: false,
        icon: '✅',
        timestamp: new Date().toISOString()
      });
    } else if (positiveRate < 50) {
      insights.push({
        type: 'health',
        category: 'constipation',
        message: `Your constipation rate is concerning at ${100 - positiveRate}% of tracked days`,
        severity: 'warning',
        actionable: true,
        icon: '⚠️',
        timestamp: new Date().toISOString()
      });
      
      recommendations.push({
        type: 'health',
        category: 'constipation',
        message: 'Increase fiber intake, water consumption, and consider regular exercise',
        actionable: true,
        priority: 'high',
        estimatedImpact: 'high',
        icon: '🥗'
      });
    }
    
    // Trend analysis
    if (trend === 'increasing' && trendPercentage > 15) {
      insights.push({
        type: 'health',
        category: 'constipation',
        message: `Your digestive health has improved by ${trendPercentage}% this month`,
        severity: 'positive',
        actionable: false,
        icon: '📈',
        timestamp: new Date().toISOString()
      });
    } else if (trend === 'decreasing' && trendPercentage < -15) {
      insights.push({
        type: 'health',
        category: 'constipation',
        message: `Your digestive health has declined by ${Math.abs(trendPercentage)}% this month`,
        severity: 'warning',
        actionable: true,
        icon: '📉',
        timestamp: new Date().toISOString()
      });
      
      recommendations.push({
        type: 'health',
        category: 'constipation',
        message: 'Consider consulting a healthcare provider if digestive issues persist',
        actionable: true,
        priority: 'high',
        estimatedImpact: 'high',
        icon: '👩‍⚕️'
      });
    }
    
    return { insights, recommendations };
  }

  /**
   * Analyze Kriya practice patterns and generate insights
   * @param {Object} kriyaData - Kriya analytics data
   * @returns {Object} Kriya insights and recommendations
   */
  analyzeKriyaPatterns(kriyaData) {
    const insights = [];
    const recommendations = [];
    const milestones = [];
    
    const { totalSessions, consistencyRate, daysTracked } = kriyaData;
    
    // Consistency analysis
    if (consistencyRate >= 80) {
      insights.push({
        type: 'health',
        category: 'kriya',
        message: `Excellent Shambhavi Kriya consistency at ${consistencyRate}%`,
        severity: 'positive',
        actionable: false,
        icon: '🧘',
        timestamp: new Date().toISOString()
      });
      
      milestones.push({
        type: 'achievement',
        category: 'kriya',
        message: 'You\'re maintaining a strong meditation practice',
        icon: '🏆',
        timestamp: new Date().toISOString()
      });
    } else if (consistencyRate < 50) {
      insights.push({
        type: 'health',
        category: 'kriya',
        message: `Your Kriya practice consistency is at ${consistencyRate}% - room for improvement`,
        severity: 'warning',
        actionable: true,
        icon: '⚠️',
        timestamp: new Date().toISOString()
      });
      
      recommendations.push({
        type: 'health',
        category: 'kriya',
        message: 'Set a daily reminder for Kriya practice at the same time each day',
        actionable: true,
        priority: 'medium',
        estimatedImpact: 'high',
        icon: '⏰'
      });
    }
    
    // Session count milestones
    if (totalSessions >= 30) {
      milestones.push({
        type: 'milestone',
        category: 'kriya',
        message: `Congratulations on completing ${totalSessions} Kriya sessions this month!`,
        icon: '🎉',
        timestamp: new Date().toISOString()
      });
    }
    
    return { insights, recommendations, milestones };
  }

  /**
   * Analyze typing practice patterns and generate insights
   * @param {Object} typingData - Typing analytics data
   * @returns {Object} Typing insights and recommendations
   */
  analyzeTypingPatterns(typingData) {
    const insights = [];
    const recommendations = [];
    const milestones = [];
    
    const { completionRate, trend, trendPercentage, completedCount } = typingData;
    
    // Completion rate analysis
    if (completionRate >= 80) {
      insights.push({
        type: 'health',
        category: 'typing',
        message: `Excellent typing practice consistency at ${completionRate}% completion rate`,
        severity: 'positive',
        actionable: false,
        icon: '⌨️',
        timestamp: new Date().toISOString()
      });
      
      milestones.push({
        type: 'achievement',
        category: 'typing',
        message: 'You\'re building strong typing skills through consistent practice',
        icon: '🎯',
        timestamp: new Date().toISOString()
      });
    } else if (completionRate < 50) {
      insights.push({
        type: 'health',
        category: 'typing',
        message: `Your typing practice completion rate is ${completionRate}% - consider more regular practice`,
        severity: 'warning',
        actionable: true,
        icon: '⚠️',
        timestamp: new Date().toISOString()
      });
      
      recommendations.push({
        type: 'health',
        category: 'typing',
        message: 'Schedule short 10-15 minute typing sessions daily for better skill development',
        actionable: true,
        priority: 'medium',
        estimatedImpact: 'medium',
        icon: '📅'
      });
    }
    
    // Trend analysis
    if (trend === 'increasing' && trendPercentage > 20) {
      insights.push({
        type: 'health',
        category: 'typing',
        message: `Your typing practice consistency has improved by ${trendPercentage}%`,
        severity: 'positive',
        actionable: false,
        icon: '📈',
        timestamp: new Date().toISOString()
      });
    }
    
    // Milestone tracking
    if (completedCount >= 20) {
      milestones.push({
        type: 'milestone',
        category: 'typing',
        message: `Great progress! You've completed ${completedCount} typing sessions this month`,
        icon: '🏆',
        timestamp: new Date().toISOString()
      });
    }
    
    return { insights, recommendations, milestones };
  }

  /**
   * Analyze study hours patterns and generate insights
   * @param {Object} studyData - Study hours analytics data
   * @returns {Object} Study insights and recommendations
   */
  analyzeStudyHoursPatterns(studyData) {
    const insights = [];
    const recommendations = [];
    const milestones = [];
    
    const { averageHours, totalHours, trend, trendPercentage, consistencyRate } = studyData;
    const recommendedDaily = 4; // 4 hours recommended daily study
    
    // Study hours adequacy
    if (averageHours >= recommendedDaily) {
      insights.push({
        type: 'education',
        category: 'study_hours',
        message: `Excellent! Your average ${averageHours} daily study hours meets recommended levels`,
        severity: 'positive',
        actionable: false,
        icon: '📚',
        timestamp: new Date().toISOString()
      });
      
      milestones.push({
        type: 'achievement',
        category: 'study_hours',
        message: 'You\'re maintaining consistent study habits',
        icon: '🎯',
        timestamp: new Date().toISOString()
      });
    } else if (averageHours < recommendedDaily * 0.7) {
      insights.push({
        type: 'education',
        category: 'study_hours',
        message: `Your average ${averageHours} daily study hours is below recommended ${recommendedDaily} hours`,
        severity: 'warning',
        actionable: true,
        icon: '⚠️',
        timestamp: new Date().toISOString()
      });
      
      recommendations.push({
        type: 'education',
        category: 'study_hours',
        message: 'Gradually increase study time by 30 minutes each week until reaching 4 hours daily',
        actionable: true,
        priority: 'high',
        estimatedImpact: 'high',
        icon: '📈'
      });
    }
    
    // Trend analysis
    if (trend === 'increasing' && trendPercentage > 15) {
      insights.push({
        type: 'education',
        category: 'study_hours',
        message: `Your study time has increased by ${trendPercentage}% - great momentum!`,
        severity: 'positive',
        actionable: false,
        icon: '📈',
        timestamp: new Date().toISOString()
      });
    } else if (trend === 'decreasing' && trendPercentage < -15) {
      insights.push({
        type: 'education',
        category: 'study_hours',
        message: `Your study time has decreased by ${Math.abs(trendPercentage)}% this month`,
        severity: 'warning',
        actionable: true,
        icon: '📉',
        timestamp: new Date().toISOString()
      });
      
      recommendations.push({
        type: 'education',
        category: 'study_hours',
        message: 'Review your schedule and identify time blocks for consistent study sessions',
        actionable: true,
        priority: 'high',
        estimatedImpact: 'high',
        icon: '📅'
      });
    }
    
    // Consistency analysis
    if (consistencyRate < 60) {
      recommendations.push({
        type: 'education',
        category: 'study_hours',
        message: 'Improve study consistency by setting fixed daily study times',
        actionable: true,
        priority: 'medium',
        estimatedImpact: 'high',
        icon: '⏰'
      });
    }
    
    // Total hours milestone
    if (totalHours >= 100) {
      milestones.push({
        type: 'milestone',
        category: 'study_hours',
        message: `Impressive! You've studied ${totalHours} hours this month`,
        icon: '🏆',
        timestamp: new Date().toISOString()
      });
    }
    
    return { insights, recommendations, milestones };
  }

  /**
   * Analyze subject progress patterns and generate insights
   * @param {Array} subjectProgress - Subject progress data
   * @returns {Object} Subject progress insights and recommendations
   */
  analyzeSubjectProgressPatterns(subjectProgress) {
    const insights = [];
    const recommendations = [];
    const milestones = [];
    
    // Find best and worst performing subjects
    const sortedByCompletion = subjectProgress
      .filter(s => s.totalTasks > 0)
      .sort((a, b) => b.taskCompletionRate - a.taskCompletionRate);
    
    if (sortedByCompletion.length > 0) {
      const bestSubject = sortedByCompletion[0];
      const worstSubject = sortedByCompletion[sortedByCompletion.length - 1];
      
      // Best performing subject
      if (bestSubject.taskCompletionRate >= 80) {
        insights.push({
          type: 'education',
          category: 'subject_progress',
          message: `Excellent progress in ${bestSubject.subjectCode} with ${bestSubject.taskCompletionRate}% completion`,
          severity: 'positive',
          actionable: false,
          icon: '🌟',
          timestamp: new Date().toISOString()
        });
        
        milestones.push({
          type: 'achievement',
          category: 'subject_progress',
          message: `${bestSubject.subjectCode} is your top performing subject`,
          icon: '🏆',
          timestamp: new Date().toISOString()
        });
      }
      
      // Worst performing subject
      if (worstSubject.taskCompletionRate < 40 && sortedByCompletion.length > 1) {
        insights.push({
          type: 'education',
          category: 'subject_progress',
          message: `${worstSubject.subjectCode} needs attention with only ${worstSubject.taskCompletionRate}% completion`,
          severity: 'warning',
          actionable: true,
          icon: '⚠️',
          timestamp: new Date().toISOString()
        });
        
        recommendations.push({
          type: 'education',
          category: 'subject_progress',
          message: `Allocate more study time to ${worstSubject.subjectCode} to catch up on pending tasks`,
          actionable: true,
          priority: 'high',
          estimatedImpact: 'high',
          icon: '📚'
        });
      }
    }
    
    // Overall progress analysis
    const overallCompletion = subjectProgress.reduce((sum, s) => sum + s.taskCompletionRate, 0) / subjectProgress.length;
    
    if (overallCompletion >= 70) {
      insights.push({
        type: 'education',
        category: 'subject_progress',
        message: `Strong overall academic progress with ${Math.round(overallCompletion)}% average completion`,
        severity: 'positive',
        actionable: false,
        icon: '📈',
        timestamp: new Date().toISOString()
      });
    } else if (overallCompletion < 50) {
      insights.push({
        type: 'education',
        category: 'subject_progress',
        message: `Overall completion rate of ${Math.round(overallCompletion)}% suggests need for better time management`,
        severity: 'warning',
        actionable: true,
        icon: '⚠️',
        timestamp: new Date().toISOString()
      });
      
      recommendations.push({
        type: 'education',
        category: 'subject_progress',
        message: 'Create a weekly study schedule prioritizing subjects with lowest completion rates',
        actionable: true,
        priority: 'high',
        estimatedImpact: 'high',
        icon: '📅'
      });
    }
    
    return { insights, recommendations, milestones };
  }

  /**
   * Analyze task completion patterns and generate insights
   * @param {Object} taskData - Task completion analytics data
   * @returns {Object} Task completion insights and recommendations
   */
  analyzeTaskCompletionPatterns(taskData) {
    const insights = [];
    const recommendations = [];
    
    const { overallCompletionRate, regularTasksCompletionRate, nptelTasksCompletionRate } = taskData;
    
    // Overall completion analysis
    if (overallCompletionRate >= 75) {
      insights.push({
        type: 'education',
        category: 'task_completion',
        message: `Excellent task completion rate of ${overallCompletionRate}%`,
        severity: 'positive',
        actionable: false,
        icon: '✅',
        timestamp: new Date().toISOString()
      });
    } else if (overallCompletionRate < 50) {
      insights.push({
        type: 'education',
        category: 'task_completion',
        message: `Task completion rate of ${overallCompletionRate}% indicates need for better task management`,
        severity: 'warning',
        actionable: true,
        icon: '⚠️',
        timestamp: new Date().toISOString()
      });
      
      recommendations.push({
        type: 'education',
        category: 'task_completion',
        message: 'Break large tasks into smaller, manageable chunks and set daily completion goals',
        actionable: true,
        priority: 'high',
        estimatedImpact: 'high',
        icon: '🎯'
      });
    }
    
    // Compare regular vs NPTEL tasks
    if (regularTasksCompletionRate > nptelTasksCompletionRate + 20) {
      insights.push({
        type: 'education',
        category: 'task_completion',
        message: 'You perform better on regular tasks than NPTEL tasks - consider adjusting study approach',
        severity: 'info',
        actionable: true,
        icon: '💡',
        timestamp: new Date().toISOString()
      });
      
      recommendations.push({
        type: 'education',
        category: 'task_completion',
        message: 'Allocate dedicated time slots for NPTEL content and take notes while watching',
        actionable: true,
        priority: 'medium',
        estimatedImpact: 'medium',
        icon: '📝'
      });
    }
    
    return { insights, recommendations };
  }

  /**
   * Analyze study pattern efficiency
   * @param {Object} studyPatterns - Study pattern data
   * @returns {Object} Study pattern insights and recommendations
   */
  analyzeStudyPatternEfficiency(studyPatterns) {
    const insights = [];
    const recommendations = [];
    
    // This would analyze time-of-day productivity patterns
    // For now, return basic recommendations
    recommendations.push({
      type: 'education',
      category: 'study_patterns',
      message: 'Track your most productive hours and schedule difficult subjects during peak times',
      actionable: true,
      priority: 'medium',
      estimatedImpact: 'medium',
      icon: '⏰'
    });
    
    return { insights, recommendations };
  }

  /**
   * Analyze correlation between health habits and study performance
   * @param {Object} healthMetric - Health metric data
   * @param {Object} studyMetric - Study metric data
   * @param {string} healthType - Type of health metric
   * @param {string} studyType - Type of study metric
   * @returns {Object} Correlation insight and recommendation
   */
  analyzeHealthStudyCorrelation(healthMetric, studyMetric, healthType, studyType) {
    // Simple correlation analysis
    if (healthMetric.trend === 'increasing' && studyMetric.trend === 'increasing') {
      return {
        insight: {
          type: 'correlation',
          category: 'health_study',
          message: `Your improving ${healthType} appears to correlate with better ${studyType}`,
          severity: 'positive',
          actionable: false,
          icon: '🔗',
          timestamp: new Date().toISOString()
        },
        recommendation: {
          type: 'correlation',
          category: 'health_study',
          message: `Continue maintaining good ${healthType} habits to support your academic performance`,
          actionable: true,
          priority: 'medium',
          estimatedImpact: 'medium',
          icon: '💪'
        }
      };
    }
    
    if (healthMetric.trend === 'decreasing' && studyMetric.trend === 'decreasing') {
      return {
        insight: {
          type: 'correlation',
          category: 'health_study',
          message: `Declining ${healthType} may be impacting your ${studyType}`,
          severity: 'warning',
          actionable: true,
          icon: '⚠️',
          timestamp: new Date().toISOString()
        },
        recommendation: {
          type: 'correlation',
          category: 'health_study',
          message: `Focus on improving ${healthType} habits to potentially boost academic performance`,
          actionable: true,
          priority: 'high',
          estimatedImpact: 'high',
          icon: '🎯'
        }
      };
    }
    
    return null;
  }

  /**
   * Analyze overall wellness-productivity correlation
   * @param {Object} healthData - Health analytics data
   * @param {Object} educationData - Education analytics data
   * @returns {Object} Overall wellness insight and recommendation
   */
  analyzeOverallWellnessProductivity(healthData, educationData) {
    const healthScore = this.calculateOverallHealthScore(healthData);
    const productivityScore = this.calculateOverallProductivityScore(educationData);
    
    if (healthScore >= 70 && productivityScore >= 70) {
      return {
        insight: {
          type: 'correlation',
          category: 'overall_wellness',
          message: 'Your strong health habits are supporting excellent academic performance',
          severity: 'positive',
          actionable: false,
          icon: '🌟',
          timestamp: new Date().toISOString()
        }
      };
    } else if (healthScore < 50 && productivityScore < 50) {
      return {
        insight: {
          type: 'correlation',
          category: 'overall_wellness',
          message: 'Both health and academic metrics need attention - they often influence each other',
          severity: 'warning',
          actionable: true,
          icon: '⚠️',
          timestamp: new Date().toISOString()
        },
        recommendation: {
          type: 'correlation',
          category: 'overall_wellness',
          message: 'Focus on improving one area at a time - start with health habits to build momentum',
          actionable: true,
          priority: 'high',
          estimatedImpact: 'high',
          icon: '🎯'
        }
      };
    }
    
    return null;
  }

  /**
   * Calculate overall health score
   * @param {Object} healthData - Health analytics data
   * @returns {number} Health score (0-100)
   */
  calculateOverallHealthScore(healthData) {
    let score = 0;
    let metrics = 0;
    
    if (healthData.waterIntake) {
      score += Math.min((healthData.waterIntake.average / 2000) * 100, 100);
      metrics++;
    }
    
    if (healthData.exercise) {
      score += Math.min((healthData.exercise.averageSteps / 8000) * 100, 100);
      metrics++;
    }
    
    if (healthData.constipation) {
      score += healthData.constipation.positiveRate;
      metrics++;
    }
    
    if (healthData.kriya) {
      score += healthData.kriya.consistencyRate;
      metrics++;
    }
    
    if (healthData.typing) {
      score += healthData.typing.completionRate;
      metrics++;
    }
    
    return metrics > 0 ? Math.round(score / metrics) : 0;
  }

  /**
   * Calculate overall productivity score
   * @param {Object} educationData - Education analytics data
   * @returns {number} Productivity score (0-100)
   */
  calculateOverallProductivityScore(educationData) {
    let score = 0;
    let metrics = 0;
    
    if (educationData.studyHours) {
      score += Math.min((educationData.studyHours.averageHours / 4) * 100, 100);
      metrics++;
    }
    
    if (educationData.taskCompletion) {
      score += educationData.taskCompletion.overallCompletionRate;
      metrics++;
    }
    
    if (educationData.subjectProgress && educationData.subjectProgress.length > 0) {
      const avgCompletion = educationData.subjectProgress.reduce((sum, s) => sum + s.taskCompletionRate, 0) / educationData.subjectProgress.length;
      score += avgCompletion;
      metrics++;
    }
    
    return metrics > 0 ? Math.round(score / metrics) : 0;
  }

  /**
   * Sort insights by severity and actionability
   * @param {Array} insights - Array of insights
   * @returns {Array} Sorted insights
   */
  sortInsightsBySeverity(insights) {
    const severityOrder = { 'critical': 0, 'warning': 1, 'info': 2, 'positive': 3 };
    
    return insights.sort((a, b) => {
      // First sort by severity
      const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
      if (severityDiff !== 0) return severityDiff;
      
      // Then by actionability (actionable first)
      if (a.actionable && !b.actionable) return -1;
      if (!a.actionable && b.actionable) return 1;
      
      // Finally by timestamp (newest first)
      return new Date(b.timestamp) - new Date(a.timestamp);
    });
  }

  /**
   * Prioritize recommendations by priority and impact
   * @param {Array} recommendations - Array of recommendations
   * @returns {Array} Prioritized recommendations
   */
  prioritizeRecommendations(recommendations) {
    const priorityOrder = { 'high': 0, 'medium': 1, 'low': 2 };
    const impactOrder = { 'high': 0, 'medium': 1, 'low': 2 };
    
    return recommendations.sort((a, b) => {
      // First sort by priority
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      
      // Then by estimated impact
      const impactDiff = impactOrder[a.estimatedImpact] - impactOrder[b.estimatedImpact];
      if (impactDiff !== 0) return impactDiff;
      
      // Finally by actionability (actionable first)
      if (a.actionable && !b.actionable) return -1;
      if (!a.actionable && b.actionable) return 1;
      
      return 0;
    });
  }
}

module.exports = AnalyticsService;