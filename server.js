const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cron = require('node-cron');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

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

// API route to get habits
app.get('/habits', async (req, res) => {
    try {
        const habits = await Habit.find();
        res.json(habits);
    } catch (err) {
        res.status(500).json({ message: 'Error fetching habits' });
    }
});

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
