const { Workout, Exercise, User } = require('../models');

// @desc    Get all workouts
// @route   GET /api/workouts
// @access  Private
exports.getWorkouts = async (req, res) => {
  try {
    const {
      fitnessLevel,
      type,
      search,
      page = 1,
      limit = 10,
      isCustom,
    } = req.query;

    // Build query
    const query = {};

    // Filter by fitness level
    if (fitnessLevel) {
      query.fitnessLevel = fitnessLevel;
    }

    // Filter by workout type
    if (type) {
      query.type = type;
    }

    // Filter by custom/preset
    if (isCustom !== undefined) {
      query.isCustom = isCustom === 'true';

      // If looking for custom workouts, only show the user's own
      if (query.isCustom) {
        query.createdBy = req.user._id;
      }
    }

    // Search by name or description
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } },
      ];
    }

    // Pagination
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;

    // Count total documents
    const total = await Workout.countDocuments(query);

    // Get workouts
    const workouts = await Workout.find(query)
      .populate('createdBy', 'firstName lastName')
      .populate('exercises.exerciseId', 'name muscleGroups difficulty')
      .skip(startIndex)
      .limit(limit)
      .sort({ createdAt: -1 });

    // Pagination result
    const pagination = {};

    if (endIndex < total) {
      pagination.next = {
        page: page + 1,
        limit,
      };
    }

    if (startIndex > 0) {
      pagination.prev = {
        page: page - 1,
        limit,
      };
    }

    res.json({
      success: true,
      count: workouts.length,
      pagination: {
        ...pagination,
        total,
        pages: Math.ceil(total / limit),
        page: parseInt(page),
        limit: parseInt(limit),
      },
      data: workouts,
    });
  } catch (error) {
    console.error('Error in getWorkouts:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Server error',
      },
    });
  }
};

// @desc    Get single workout
// @route   GET /api/workouts/:id
// @access  Private
exports.getWorkout = async (req, res) => {
  try {
    const workout = await Workout.findById(req.params.id)
      .populate('createdBy', 'firstName lastName')
      .populate('exercises.exerciseId');

    if (!workout) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'WORKOUT_NOT_FOUND',
          message: 'Workout not found',
        },
      });
    }

    res.json({
      success: true,
      data: workout,
    });
  } catch (error) {
    console.error('Error in getWorkout:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Server error',
      },
    });
  }
};

// @desc    Create workout
// @route   POST /api/workouts
// @access  Private
exports.createWorkout = async (req, res) => {
  try {
    const {
      name,
      description,
      type,
      fitnessLevel,
      duration,
      exercises,
      tags = [],
    } = req.body;

    // Validate exercises
    if (!exercises || !Array.isArray(exercises) || exercises.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_DATA',
          message: 'At least one exercise is required',
        },
      });
    }

    // Check if all exercises exist
    const exerciseIds = exercises.map(ex => ex.exerciseId);
    const existingExercises = await Exercise.find({
      _id: { $in: exerciseIds },
    });

    if (existingExercises.length !== exerciseIds.length) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_EXERCISES',
          message: 'One or more exercises do not exist',
        },
      });
    }

    // Create workout
    const workout = await Workout.create({
      name,
      description,
      createdBy: req.user._id,
      type,
      fitnessLevel,
      isCustom: true, // User-created workouts are custom
      duration,
      exercises: exercises.map((ex, index) => ({
        exerciseId: ex.exerciseId,
        sets: ex.sets || 3,
        reps: ex.reps || 10,
        duration: ex.duration,
        restTime: ex.restTime || 60,
        order: ex.order || index + 1,
      })),
      tags,
    });

    res.status(201).json({
      success: true,
      data: workout,
      message: 'Workout created successfully',
    });
  } catch (error) {
    console.error('Error in createWorkout:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Server error',
      },
    });
  }
};

// @desc    Update workout
// @route   PUT /api/workouts/:id
// @access  Private
exports.updateWorkout = async (req, res) => {
  try {
    const { name, description, type, fitnessLevel, duration, exercises, tags } =
      req.body;

    const workout = await Workout.findById(req.params.id);

    if (!workout) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'WORKOUT_NOT_FOUND',
          message: 'Workout not found',
        },
      });
    }

    // Check if user owns the workout or is admin
    if (
      workout.createdBy.toString() !== req.user._id.toString() &&
      req.user.role !== 'admin'
    ) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Not authorized to update this workout',
        },
      });
    }

    // If updating exercises, validate them
    if (exercises && Array.isArray(exercises) && exercises.length > 0) {
      // Check if all exercises exist
      const exerciseIds = exercises.map(ex => ex.exerciseId);
      const existingExercises = await Exercise.find({
        _id: { $in: exerciseIds },
      });

      if (existingExercises.length !== exerciseIds.length) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_EXERCISES',
            message: 'One or more exercises do not exist',
          },
        });
      }

      // Format exercises
      workout.exercises = exercises.map((ex, index) => ({
        exerciseId: ex.exerciseId,
        sets: ex.sets || 3,
        reps: ex.reps || 10,
        duration: ex.duration,
        restTime: ex.restTime || 60,
        order: ex.order || index + 1,
      }));
    }

    // Update other fields
    if (name) {
      workout.name = name;
    }
    if (description) {
      workout.description = description;
    }
    if (type) {
      workout.type = type;
    }
    if (fitnessLevel) {
      workout.fitnessLevel = fitnessLevel;
    }
    if (duration) {
      workout.duration = duration;
    }
    if (tags) {
      workout.tags = tags;
    }

    // Save workout
    await workout.save();

    res.json({
      success: true,
      data: workout,
      message: 'Workout updated successfully',
    });
  } catch (error) {
    console.error('Error in updateWorkout:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Server error',
      },
    });
  }
};

// @desc    Delete workout
// @route   DELETE /api/workouts/:id
// @access  Private
exports.deleteWorkout = async (req, res) => {
  try {
    const workout = await Workout.findById(req.params.id);

    if (!workout) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'WORKOUT_NOT_FOUND',
          message: 'Workout not found',
        },
      });
    }

    // Check if user owns the workout or is admin
    if (
      workout.createdBy.toString() !== req.user._id.toString() &&
      req.user.role !== 'admin'
    ) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Not authorized to delete this workout',
        },
      });
    }

    await workout.deleteOne();

    res.json({
      success: true,
      message: 'Workout deleted successfully',
    });
  } catch (error) {
    console.error('Error in deleteWorkout:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Server error',
      },
    });
  }
};

// @desc    Rate workout
// @route   POST /api/workouts/:id/ratings
// @access  Private
exports.rateWorkout = async (req, res) => {
  try {
    const { rating, review } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_RATING',
          message: 'Rating must be between 1 and 5',
        },
      });
    }

    const workout = await Workout.findById(req.params.id);

    if (!workout) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'WORKOUT_NOT_FOUND',
          message: 'Workout not found',
        },
      });
    }

    // Check if user already rated this workout
    const existingRatingIndex = workout.ratings.findIndex(
      r => r.userId.toString() === req.user._id.toString()
    );

    if (existingRatingIndex !== -1) {
      // Update existing rating
      workout.ratings[existingRatingIndex].rating = rating;
      workout.ratings[existingRatingIndex].review = review || '';
      workout.ratings[existingRatingIndex].date = Date.now();
    } else {
      // Add new rating
      workout.ratings.push({
        userId: req.user._id,
        rating,
        review: review || '',
        date: Date.now(),
      });
    }

    // Recalculate average rating
    workout.averageRating =
      workout.ratings.reduce((acc, item) => acc + item.rating, 0) /
      workout.ratings.length;

    await workout.save();

    res.json({
      success: true,
      data: {
        rating,
        review,
        averageRating: workout.averageRating,
      },
      message: 'Workout rated successfully',
    });
  } catch (error) {
    console.error('Error in rateWorkout:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Server error',
      },
    });
  }
};

// @desc    Get recommended workouts
// @route   GET /api/workouts/recommended
// @access  Private
exports.getRecommendedWorkouts = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
        },
      });
    }

    // Get workouts based on user's fitness level
    let recommendations = await Workout.find({
      fitnessLevel: user.fitnessLevel,
      isCustom: false, // Only recommend pre-defined workouts
    })
      .limit(5)
      .populate('exercises.exerciseId', 'name muscleGroups difficulty')
      .sort({ averageRating: -1 });

    // If not enough recommendations, add some workouts from adjacent fitness levels
    if (recommendations.length < 5) {
      let adjacentLevel;

      if (user.fitnessLevel === 'beginner') {
        adjacentLevel = 'intermediate';
      } else if (user.fitnessLevel === 'advanced') {
        adjacentLevel = 'intermediate';
      } else {
        // For intermediate, randomly choose between beginner and advanced
        adjacentLevel = Math.random() > 0.5 ? 'beginner' : 'advanced';
      }

      const additionalWorkouts = await Workout.find({
        fitnessLevel: adjacentLevel,
        isCustom: false,
        _id: { $nin: recommendations.map(r => r._id) },
      })
        .limit(5 - recommendations.length)
        .populate('exercises.exerciseId', 'name muscleGroups difficulty')
        .sort({ averageRating: -1 });

      recommendations = [...recommendations, ...additionalWorkouts];
    }

    res.json({
      success: true,
      data: recommendations,
    });
  } catch (error) {
    console.error('Error in getRecommendedWorkouts:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Server error',
      },
    });
  }
};
