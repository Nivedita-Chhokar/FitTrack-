const express = require('express');
const router = express.Router();
const {
  getNutritionLogs,
  getNutritionLog,
  createNutritionLog,
  updateNutritionLog,
  deleteNutritionLog,
  addMeal,
  updateMeal,
  deleteMeal,
  updateWaterIntake,
  getNutritionStats,
} = require('../controllers/nutritionController');
const {
  getNutritionGoals,
  setNutritionGoals,
  calculateNutritionGoals,
  getGoalRecommendations,
  resetNutritionGoals,
} = require('../controllers/nutritionGoalsController');
const { protect } = require('../middleware/authMiddleware');

// All routes are protected
router.use(protect);

// Nutrition Goals routes
router
  .route('/goals')
  .get(getNutritionGoals)
  .post(setNutritionGoals)
  .delete(resetNutritionGoals);

router.post('/goals/calculate', calculateNutritionGoals);
router.get('/goals/recommendations', getGoalRecommendations);

// Nutrition logs routes
router.route('/logs').get(getNutritionLogs).post(createNutritionLog);

router
  .route('/logs/:id')
  .get(getNutritionLog)
  .put(updateNutritionLog)
  .delete(deleteNutritionLog);

// Meal routes
router.route('/logs/:id/meals').post(addMeal);

router.route('/logs/:id/meals/:mealId').put(updateMeal).delete(deleteMeal);

// Water intake route
router.patch('/water', updateWaterIntake);

// Stats route
router.get('/stats', getNutritionStats);

module.exports = router;
