import { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { useToast } from '../../contexts/ToastContext';
import { apiWithToast } from '../../utils/api';
import Card from '../ui/Card';
import Button from '../ui/Button';

// Components
import DailyIntakeForm from './DailyIntakeForm';
import MealsList from './MealsList';
import WaterTracker from './WaterTracker';
import WaterChart from './WaterChart'; // Simple water chart component
import NutritionSummary from './NutritionSummary';
import NutritionStats from './NutritionStats';
import MealPlanner from './MealPlanner';
import NutritionGoals from './NutritionGoals';

const Nutrition = () => {
  const [date, setDate] = useState(new Date());
  const [nutritionLog, setNutritionLog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [activeTab, setActiveTab] = useState('daily');

  // Prevent duplicate log creation in dev/StrictMode
  const hasAttemptedLogCreation = useRef(false);

  // Get toast functions
  const toast = useToast();
  // Get toast-enabled API
  const api = apiWithToast(toast);

  // Fetch nutrition log for the selected date
  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      if (
        activeTab === 'daily' ||
        activeTab === 'meals' ||
        activeTab === 'water'
      ) {
        await fetchNutritionLog(isMounted);
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [date, activeTab]);

  const fetchNutritionLog = async (isMounted = true) => {
    if (!isMounted) return;

    setLoading(true);
    try {
      // Format date as YYYY-MM-DD
      const formattedDate = format(date, 'yyyy-MM-dd');
      console.log('Fetching nutrition log for date:', formattedDate);

      const response = await api.get('api/nutrition/logs', {
        params: {
          startDate: formattedDate,
          endDate: formattedDate,
          limit: 1,
        },
      });

      if (!isMounted) return;
      console.log('Nutrition log response:', response.data);

      if (response.data.count > 0) {
        const log = response.data.data[0];
        console.log('Setting nutrition log:', log);
        setNutritionLog(log);
        hasAttemptedLogCreation.current = false; // Reset for future date changes
      } else {
        console.log('No nutrition log found for date:', formattedDate);
        setNutritionLog(null);

        // Check if the date is today before creating a new log
        const today = new Date();
        const todayFormatted = format(today, 'yyyy-MM-dd');

        // Only create a new log if the date is today
        if (formattedDate === todayFormatted) {
          if (hasAttemptedLogCreation.current) return; // Prevent duplicate creation
          hasAttemptedLogCreation.current = true;
          console.log('Creating new log for today');
          try {
            const createResponse = await api.post('api/nutrition/logs', {
              date: formattedDate,
              meals: [],
              waterIntake: 0,
            });
            if (!isMounted) return;
            setNutritionLog(createResponse.data.data);
            toast.success('Nutrition log created successfully', {
              key: Date.now(),
            });
          } catch (createError) {
            if (!isMounted) return;
            console.error('Error creating nutrition log:', createError);
            const errorMessage =
              createError.response?.data?.error?.message ||
              'Failed to create nutrition log';
            toast.error(errorMessage, { key: Date.now() });
          }
        } else {
          hasAttemptedLogCreation.current = false; // Reset for future date changes
          console.log('Not creating log - date is not today');
          // Show appropriate message for future/past dates
          if (formattedDate > todayFormatted) {
            toast.info('Cannot create nutrition log for future dates', {
              key: Date.now(),
            });
          }
        }
      }
    } catch (err) {
      if (!isMounted) return;
      console.error('Error fetching nutrition log:', err);
      const errorMessage =
        err.response?.data?.error?.message || 'Failed to fetch nutrition log';
      toast.error(errorMessage, { key: Date.now() });
    } finally {
      if (isMounted) {
        setLoading(false);
      }
    }
  };

  // Create a new nutrition log
  const handleCreateLog = async () => {
    try {
      const formattedDate = format(date, 'yyyy-MM-dd');
      const today = new Date();
      const todayFormatted = format(today, 'yyyy-MM-dd');

      if (formattedDate > todayFormatted) {
        toast.error('Cannot create nutrition log for future dates', {
          key: Date.now(),
        });
        return;
      }

      const response = await api.post('api/nutrition/logs', {
        date: formattedDate,
        meals: [],
        waterIntake: 0,
      });

      setNutritionLog(response.data.data);
      toast.success('Nutrition log created successfully', { key: Date.now() });
    } catch (err) {
      console.error('Error creating nutrition log:', err);
      const errorMessage =
        err.response?.data?.error?.message || 'Failed to create nutrition log';
      toast.error(errorMessage, { key: Date.now() });
    }
  };

  // Handle date change
  const handleDateChange = e => {
    const newDate = new Date(e.target.value);
    setDate(newDate);
  };

  // Handle meal added
  const handleMealAdded = updatedLog => {
    setNutritionLog(updatedLog);
    setShowForm(false);
  };

  // Handle meal deleted
  const handleMealDeleted = updatedLog => {
    setNutritionLog(updatedLog);
  };

  // Handle water intake update
  const handleWaterUpdate = async amount => {
    try {
      const formattedDate = format(date, 'yyyy-MM-dd');

      // Call API to update water intake
      const response = await api.patch('api/nutrition/water', {
        date: formattedDate,
        amount,
      });

      // Update local state with the response data
      if (nutritionLog) {
        setNutritionLog({
          ...nutritionLog,
          waterIntake: amount,
        });
      } else {
        // If no nutrition log exists, create one with the water intake
        const newLogResponse = await api.post('api/nutrition/logs', {
          date: formattedDate,
          meals: [],
          waterIntake: amount,
        });
        setNutritionLog(newLogResponse.data.data);
      }

      toast.success('Water intake updated');
    } catch (err) {
      console.error('Error updating water intake:', err);
      // Revert optimistic update on error
      if (nutritionLog) {
        setNutritionLog(prev => ({
          ...prev,
          waterIntake: prev.waterIntake, // Keep previous value
        }));
      }
      toast.error('Failed to update water intake');
    }
  };

  // Render tab content
  const renderTabContent = () => {
    if (loading && !nutritionLog) {
      return (
        <div className='flex justify-center items-center h-64'>
          <div className='animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500'></div>
          <p className='ml-2 text-gray-600 dark:text-gray-400'>Loading...</p>
        </div>
      );
    }

    switch (activeTab) {
      case 'daily':
        if (!nutritionLog) {
          return (
            <div className='text-center py-10'>
              <p className='text-lg text-gray-700 dark:text-gray-300 mb-4'>
                No nutrition data found for {format(date, 'MMMM d, yyyy')}
              </p>
              <Button onClick={handleCreateLog} variant='primary'>
                Create Nutrition Log
              </Button>
            </div>
          );
        }
        return (
          <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
            {/* Left Column - Nutrition Summary + Water Pie Chart */}
            <div className='space-y-6'>
              <NutritionSummary nutritionLog={nutritionLog} />
              <WaterChart waterIntake={nutritionLog.waterIntake} goal={2000} />
            </div>

            {/* Right Column - Meals */}
            <div>
              <Card
                title="Today's Meals"
                className='mb-6'
                footer={
                  !showForm && (
                    <Button
                      onClick={() => setShowForm(true)}
                      variant='primary'
                      fullWidth
                    >
                      Add Meal
                    </Button>
                  )
                }
              >
                {showForm ? (
                  <DailyIntakeForm
                    nutritionLogId={nutritionLog._id}
                    onMealAdded={handleMealAdded}
                    onCancel={() => setShowForm(false)}
                  />
                ) : (
                  <MealsList
                    meals={nutritionLog.meals}
                    nutritionLogId={nutritionLog._id}
                    onMealDeleted={handleMealDeleted}
                  />
                )}
              </Card>
            </div>
          </div>
        );

      case 'meals':
        if (!nutritionLog) {
          return (
            <div className='text-center py-10'>
              <p className='text-lg text-gray-700 dark:text-gray-300 mb-4'>
                No nutrition data found for {format(date, 'MMMM d, yyyy')}
              </p>
              <Button onClick={handleCreateLog} variant='primary'>
                Create Nutrition Log
              </Button>
            </div>
          );
        }
        return (
          <Card
            title='Meal Management'
            subtitle='Track and manage your daily meals'
          >
            {showForm ? (
              <DailyIntakeForm
                nutritionLogId={nutritionLog._id}
                onMealAdded={handleMealAdded}
                onCancel={() => setShowForm(false)}
              />
            ) : (
              <>
                <div className='mb-6'>
                  <Button onClick={() => setShowForm(true)} variant='primary'>
                    Add New Meal
                  </Button>
                </div>
                <MealsList
                  meals={nutritionLog.meals}
                  nutritionLogId={nutritionLog._id}
                  onMealDeleted={handleMealDeleted}
                  showDetails={true}
                />
              </>
            )}
          </Card>
        );

      case 'water':
        if (!nutritionLog) {
          return (
            <div className='text-center py-10'>
              <p className='text-lg text-gray-700 dark:text-gray-300 mb-4'>
                No nutrition data found for {format(date, 'MMMM d, yyyy')}
              </p>
              <Button onClick={handleCreateLog} variant='primary'>
                Create Nutrition Log
              </Button>
            </div>
          );
        }
        return (
          <div className='max-w-2xl mx-auto'>
            <Card
              title='Water Intake Tracker'
              subtitle='Monitor your daily hydration levels'
            >
              <WaterTracker
                waterIntake={nutritionLog.waterIntake}
                onUpdate={handleWaterUpdate}
                expanded={true}
              />
            </Card>
          </div>
        );

      case 'stats':
        return <NutritionStats />;

      case 'planner':
        return <MealPlanner />;

      case 'goals':
        return <NutritionGoals />;

      default:
        return null;
    }
  };

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div className='bg-white dark:bg-gray-800 shadow rounded-lg p-6'>
        <h1 className='text-2xl font-bold text-gray-900 dark:text-white'>
          Nutrition Tracker
        </h1>
        <p className='mt-1 text-gray-500 dark:text-gray-400'>
          Monitor your nutrition, track meals, and reach your health goals
        </p>
      </div>

      {/* Tab Navigation */}
      <div className='bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden'>
        <div className='border-b border-gray-200 dark:border-gray-700'>
          <nav className='flex overflow-x-auto'>
            <button
              onClick={() => setActiveTab('daily')}
              className={`px-6 py-3 font-medium text-sm border-b-2 whitespace-nowrap ${
                activeTab === 'daily'
                  ? 'border-indigo-500 dark:border-indigo-400 text-indigo-600 dark:text-indigo-300'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              Daily Overview
            </button>
            <button
              onClick={() => setActiveTab('meals')}
              className={`px-6 py-3 font-medium text-sm border-b-2 whitespace-nowrap ${
                activeTab === 'meals'
                  ? 'border-indigo-500 dark:border-indigo-400 text-indigo-600 dark:text-indigo-300'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              Meals
            </button>
            <button
              onClick={() => setActiveTab('water')}
              className={`px-6 py-3 font-medium text-sm border-b-2 whitespace-nowrap ${
                activeTab === 'water'
                  ? 'border-indigo-500 dark:border-indigo-400 text-indigo-600 dark:text-indigo-300'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              Water Tracker
            </button>
            <button
              onClick={() => setActiveTab('stats')}
              className={`px-6 py-3 font-medium text-sm border-b-2 whitespace-nowrap ${
                activeTab === 'stats'
                  ? 'border-indigo-500 dark:border-indigo-400 text-indigo-600 dark:text-indigo-300'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              Statistics
            </button>
            <button
              onClick={() => setActiveTab('planner')}
              className={`px-6 py-3 font-medium text-sm border-b-2 whitespace-nowrap ${
                activeTab === 'planner'
                  ? 'border-indigo-500 dark:border-indigo-400 text-indigo-600 dark:text-indigo-300'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              Meal Planner
            </button>
            <button
              onClick={() => setActiveTab('goals')}
              className={`px-6 py-3 font-medium text-sm border-b-2 whitespace-nowrap ${
                activeTab === 'goals'
                  ? 'border-indigo-500 dark:border-indigo-400 text-indigo-600 dark:text-indigo-300'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              Nutrition Goals
            </button>
          </nav>
        </div>
      </div>

      {/* Date Selector (only for relevant tabs) */}
      {(activeTab === 'daily' ||
        activeTab === 'meals' ||
        activeTab === 'water') && (
        <div className='bg-white dark:bg-gray-800 shadow rounded-lg p-4'>
          <div className='flex items-center'>
            <label
              htmlFor='date'
              className='mr-2 text-gray-700 dark:text-gray-300'
            >
              Date:
            </label>
            <input
              type='date'
              id='date'
              value={format(date, 'yyyy-MM-dd')}
              onChange={handleDateChange}
              className='border-gray-300 dark:border-gray-700 dark:bg-gray-800 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500'
            />
          </div>
        </div>
      )}

      {/* Tab Content */}
      <div>{renderTabContent()}</div>
    </div>
  );
};

export default Nutrition;
