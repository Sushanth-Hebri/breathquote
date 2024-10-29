// Enhanced authentication check with JWT decoder
const checkAuth = () => {
    const token = localStorage.getItem('token');
    if (!token) {
        redirectToLogin('Session expired. Please log in.');
        return false;
    }

    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (payload.exp < Date.now() / 1000) {
            redirectToLogin('Session expired. Please log in again.');
            return false;
        }
    } catch (e) {
        redirectToLogin('Invalid session. Please log in again.');
        return false;
    }
    return true;
};

// Enhanced redirect with message
const redirectToLogin = (message) => {
    localStorage.setItem('loginMessage', message);
    window.location.href = 'https://breathquote.onrender.com';
};

// Fetch protected content with error handling
const fetchProtectedContent = async () => {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('https://breathquote.onrender.com/protected', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) throw new Error('Failed to fetch protected content');

        const data = await response.json();
        updateUserInfo(data);
        await Promise.all([fetchHabits(), fetchCompletionPercentages()]);
    } catch (error) {
        console.error('Error:', error);
        redirectToLogin('Please log in again.');
    }
};

// Update user information
const updateUserInfo = (data) => {
    const header = document.querySelector('.header p');
    header.textContent = `Welcome back, ${data.userId}!`;
};

// Enhanced habits fetching with loading state
const fetchHabits = async () => {
    const habitsList = document.getElementById('habits-list');
    habitsList.innerHTML = '<p>Loading habits...</p>';

    try {
        const token = localStorage.getItem('token');
        const response = await fetch('https://breathquote.onrender.com/habits', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('Failed to fetch habits');

        const habits = await response.json();
        renderHabits(habits);
    } catch (error) {
        console.error('Error:', error);
        habitsList.innerHTML = '<p>Failed to load habits. Please try again.</p>';
    }
};

// Render habits with enhanced UI
const renderHabits = (habits) => {
    const habitsList = document.getElementById('habits-list');
    habitsList.innerHTML = '';

    if (habits.length === 0) {
        habitsList.innerHTML = '<p>No habits found. Start adding some!</p>';
        return;
    }

    habits.forEach(habit => {
        const habitItem = document.createElement('div');
        habitItem.className = 'habit-item animate__animated animate__fadeIn';
        
        const habitInfo = document.createElement('div');
        habitInfo.className = 'habit-info';
        
        const habitName = document.createElement('span');
        habitName.className = 'habit-name';
        habitName.textContent = habit.habit;
        
        const habitTime = document.createElement('span');
        habitTime.className = 'habit-time';
        habitTime.textContent = habit.timelimit;
        
        habitInfo.appendChild(habitName);
        habitInfo.appendChild(habitTime);
        
        const statusBtn = document.createElement('button');
        statusBtn.className = `status-btn ${habit.status ? 'done' : 'pending'}`;
        statusBtn.textContent = habit.status ? 'Completed' : 'Pending';
        statusBtn.onclick = () => toggleHabitStatus(habit._id, !habit.status);
        
        habitItem.appendChild(habitInfo);
        habitItem.appendChild(statusBtn);
        habitsList.appendChild(habitItem);
    });
};

// Enhanced habit status toggle with optimistic updates
const toggleHabitStatus = async (habitId, status) => {
    const button = event.target;
    const originalText = button.textContent;
    const originalClass = button.className;
    
    // Optimistic update
    button.textContent = status ? 'Completing...' : 'Updating...';
    button.className = `status-btn ${status ? 'done' : 'pending'}`;
    button.disabled = true;

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`https://breathquote.onrender.com/habits/${habitId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ status })
        });

        if (!response.ok) throw new Error('Failed to update habit');

        // Refresh data
        await Promise.all([fetchHabits(), fetchCompletionPercentages()]);
    } catch (error) {
        console.error('Error:', error);
        button.textContent = originalText;
        button.className = originalClass;
        button.disabled = false;
        showToast('Failed to update habit status. Please try again.');
    }
};

// Enhanced completion percentages fetch
const fetchCompletionPercentages = async () => {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('https://breathquote.onrender.com/habits/completion-percentage', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('Failed to fetch completion data');

        const completionData = await response.json();
        displayCompletionPercentages(completionData);
        plotCompletionChart(completionData);
    } catch (error) {
        console.error('Error:', error);
        showToast('Failed to load completion data. Please try again.');
    }
};

// Enhanced completion percentages display
const displayCompletionPercentages = (completionData) => {
    const completionList = document.getElementById('completion-list');
    completionList.innerHTML = '';

    completionData.forEach(entry => {
        const item = document.createElement('div');
        item.className = 'completion-item animate__animated animate__fadeIn';

        const date = document.createElement('span');
        date.className = 'completion-date';
        date.textContent = new Date(entry.date).toLocaleDateString();

        const percentage = document.createElement('span');
        percentage.className = `completion-percentage ${getPercentageClass(entry.completionPercentage)}`;
        percentage.textContent = `${entry.completionPercentage.toFixed(1)}%`;

        item.appendChild(date);
        item.appendChild(percentage);
        completionList.appendChild(item);
    });
};

// Enhanced chart plotting with animations
const plotCompletionChart = (completionData) => {
    const ctx = document.getElementById('completionChart').getContext('2d');
    const dates = completionData.map(entry => new Date(entry.date).toLocaleDateString());
    const percentages = completionData.map(entry => entry.completionPercentage);

    if (window.completionChart) {
        window.completionChart.destroy();
    }

    window.completionChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: dates,
            datasets: [{
                label: 'Daily Completion',
                data: percentages,
                borderColor: '#4a90e2',
                backgroundColor: 'rgba(74, 144, 226, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4,
                pointBackgroundColor: percentages.map(p => getPointColor(p)),
                pointRadius: 6,
                pointHoverRadius: 8
            }]
        },
        options: {
            responsive: true,
            animation: {
                duration: 2000,
                easing: 'easeInOutQuart'
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                },
                x: {
                    grid: {
                        display: false
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 12,
                    titleFont: {
                        size: 14,
                        weight: 'bold'
                    },
                    bodyFont: {
                        size: 13
                    },
                    displayColors: false
                }
            }
        }
    });
};

// Utility functions
const getPercentageClass = (percentage) => {
    if (percentage >= 85) return 'percentage-high';
    if (percentage >= 50) return 'percentage-medium';
    return 'percentage-low';
};

const getPointColor = (percentage) => {
    if (percentage >= 85) return '#48bb78';
    if (percentage >= 50) return '#ecc94b';
    return '#f56565';
};

const showToast = (message) => {
    // Implementation of toast notification
    alert(message); // Fallback to alert if toast implementation is not available
};

// Enhanced logout with confirmation
const logout = () => {
    if (confirm('Are you sure you want to logout?')) {
        localStorage.clear();
        redirectToLogin('Logged out successfully.');
    }
};

// Initialize the application
if (checkAuth()) {
    fetchProtectedContent();
}
