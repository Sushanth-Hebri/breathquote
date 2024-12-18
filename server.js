const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cron = require('node-cron');
require('dotenv').config();
const { createClient } = require('redis');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public')); // Serve static files from the public directory

// User model
const UserSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true }
});
const User = mongoose.model('User', UserSchema);

// Define the Habit schema
const habitSchema = new mongoose.Schema({
    habit: String,
    status: { type: Boolean, default: false },
    timelimit: String,
    description: String,
    date: { type: Date, default: Date.now } // Set 'date' to today's date
});
const Habit = mongoose.model('Habit', habitSchema);

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.error('MongoDB connection error:', err));

// JWT verification middleware
const verifyToken = (req, res, next) => {
    const token = req.headers['authorization'];
    if (!token) {
        return res.status(403).json({ message: 'No token provided' });
    }

    const bearerToken = token.startsWith('Bearer ') ? token.split(' ')[1] : token;

    jwt.verify(bearerToken, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).json({ message: 'Unauthorized access' });
        }
        req.userId = decoded.id;
        next();
    });
};

const client = createClient({
    password: 'hFblwq5PlD39B11paWU41eMq87Y2JYwq',  // Replace with your actual password
    socket: {
        host: 'redis-15514.c277.us-east-1-3.ec2.redns.redis-cloud.com',  // Replace with your actual Redis Cloud host
        port: 15514  // Replace with your actual Redis Cloud port
    }
});

client.on('error', (err) => console.log('Redis Client Error', err));

(async () => {
    await client.connect();
    console.log('Connected to Redis Cloud');
})();

// Function to create daily habits
const createDailyHabits = async () => {
    const habits = [
        { habit: 'Wake up', timelimit: '08:00', description: 'Wake up early' },
        { habit: 'Brush and Bath', timelimit: '08:05', description: 'Get freshened up' },
        { habit: 'Food', timelimit: '08:30', description: 'Have breakfast' },
        { habit: 'Read something', timelimit: '09:30', description: 'Read something' },
        { habit: 'College or do some work', timelimit: '10:00', description: 'Do some work' },
        { habit: 'Lunch', timelimit: '13:30', description: 'Lunch' },
        { habit: 'Snack', timelimit: '17:00', description: 'Snack' },
        { habit: 'Bath', timelimit: '19:00', description: 'Bath' },
        { habit: 'Dinner', timelimit: '20:30', description: 'Eat' },
        { habit: 'Sleep', timelimit: '23:59', description: 'Sleep early' }
    ];

    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));

    const existingHabits = await Habit.find({ date: { $gte: startOfDay, $lt: endOfDay } });

    if (existingHabits.length === 0) {
        await Habit.insertMany(habits.map(habit => ({ ...habit, date: new Date() })));
        console.log('New daily habits created');
    }
};

// Schedule the creation of daily habits at midnight
cron.schedule('0 0 * * *', createDailyHabits);

// Login route
app.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ message: 'User not found' });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
        res.json({ token });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});


// API route to get habits for the current day
app.get('/habits', async (req, res) => {
    try {
        // Get the current date
        const currentDate = new Date();
        
        // Set the start and end of the current day
        const startOfDay = new Date(currentDate.setHours(0, 0, 0, 0)); // Start of the day
        const endOfDay = new Date(currentDate.setHours(23, 59, 59, 999)); // End of the day

        // Find habits where the date is between the start and end of the current day
        const habits = await Habit.find({
            date: {
                $gte: startOfDay,
                $lte: endOfDay
            }
        });

        res.json(habits);
    } catch (err) {
        res.status(500).json({ message: 'Error fetching habits' });
    }
});


// Caching route for completion percentage
app.get('/habits/completion-percentage', async (req, res) => {
    const cacheKey = 'completionPercentage';

    try {
        // Check if data is in Redis cache
        const cachedData = await client.get(cacheKey);
        if (cachedData) {
            return res.json(JSON.parse(cachedData));  // Return cached data
        }

        // Perform database aggregation if cache miss
        const result = await Habit.aggregate([
            {
                // Group habits by date and calculate total and completed habits
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
                    totalHabits: { $sum: 1 },
                    completedHabits: { $sum: { $cond: ["$status", 1, 0] } }
                }
            },
            {
                // Calculate completion percentage
                $project: {
                    date: "$_id",
                    _id: 0,
                    completionPercentage: {
                        $multiply: [
                            { $cond: [{ $eq: ["$totalHabits", 0] }, 0, { $divide: ["$completedHabits", "$totalHabits"] }] },
                            100
                        ]
                    }
                }
            },
            { $sort: { date: -1 } }
        ]);

        // Cache the result and set expiry (600 seconds = 10 minutes)
        await client.setEx(cacheKey, 600, JSON.stringify(result));

        res.json(result);
    } catch (err) {
        console.error(err);  // Log error for debugging
        res.status(500).json({ message: 'Error calculating completion percentage' });
    }
});







// Function to send a reminder email using Mailtrap
const sendReminderEmail = async (habitName, email) => {
    try {
        await axios.post('https://send.api.mailtrap.io/api/send', {
            from: {
                email: 'hello@demomailtrap.com',
                name: 'Daily Habit Reminder'
            },
            to: [{ email: email }],
            subject: `Reminder: Complete your habit - ${habitName}`,
            text: `Hi, please complete your habit '${habitName}' now.`,
            category: 'Habit Reminder'
        }, {
            headers: {
                Authorization: `Bearer ${process.env.MAILTRAP_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });
        console.log(`Reminder email sent for habit: ${habitName}`);
    } catch (error) {
        console.error(`Error sending reminder email for habit: ${habitName}`, error);
    }
};


const iwillcheckroutine = async () => {
    try {
        // Get the start and end of the current day
        const today = new Date();
        const startOfDay = new Date(today.setHours(0, 0, 0, 0));
        const endOfDay = new Date(today.setHours(23, 59, 59, 999));

        // Fetch habits only for the current day
        const habits = await Habit.find({ date: { $gte: startOfDay, $lt: endOfDay } });
        const email = "sushanth.cs21@bmsce.ac.in"; // User email for reminders

        habits.forEach(habit => {
            const [hours, minutes] = habit.timelimit.split(':').map(Number);
            const reminderTime = new Date();
            reminderTime.setHours(hours, minutes + 1, 0, 0); // Set reminder time to 1 minute after timelimit

            if (new Date() >= reminderTime && habit.status === false) {
                sendReminderEmail(habit.habit, email);
            }
        });
    } catch (err) {
        console.error('Error checking today\'s habits:', err);
    }
};

// Schedule cron jobs for each habit for the current day
const scheduleHabitReminders = async () => {
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));

    const habits = await Habit.find({ date: { $gte: startOfDay, $lt: endOfDay } });

    habits.forEach(habit => {
        const [hours, minutes] = habit.timelimit.split(':');
        const cronTime = `${minutes} ${hours} * * *`; // Schedule cron 1 minute after timelimit

        cron.schedule(cronTime, () => iwillcheckroutine());
        console.log(`Scheduled habit check for: ${habit.habit} at ${cronTime}`);
    });
};

// Initialize habit reminder schedules on server start
scheduleHabitReminders();


// API route to update habit status
app.post('/habits/:id', async (req, res) => {
    const { status } = req.body;
    try {
        const habit = await Habit.findByIdAndUpdate(req.params.id, { status }, { new: true });
        res.json(habit);
    } catch (err) {
        res.status(500).json({ message: 'Error updating habit' });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

// Protected route example
app.get('/protected', verifyToken, (req, res) => {
    res.json({ message: 'This is a protected route', userId: req.userId });
});

// Create habits for the first time on server start
createDailyHabits();
