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

// Update user information with animation
const updateUserInfo = (data) => {
    const welcomeMessage = document.querySelector('.header p');
    welcomeMessage.classList.add('animate__animated', 'animate__fadeIn');
    welcomeMessage.textContent = `Welcome back, ${data.userId}! Let's make today count.`;
};

// Enhanced habits fetching with loading state and animations
const fetchHabits = async () => {
    const habitsList = document.getElementById('habits-list');
    habitsList.innerHTML = '<div class="loading">Loading your habits...</div>';

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
        habitsList.innerHTML = '<div class="error">Failed to load habits. Please try again.</div>';
    }
};

// Render habits with enhanced UI and animations
const renderHabits = (habits) => {
    const habitsList = document.getElementById('habits-list');
    habitsList.innerHTML = '';

    if (habits.length === 0) {
        habitsList.innerHTML = `
            <div class="empty-state animate__animated animate__fadeIn">
                <p>No habits found. Start building better habits today!</p>
            </div>
        `;
        return;
    }

    habits.forEach((habit, index) => {
        const habitItem = document.createElement('div');
        habitItem.className = 'habit-item animate__animated animate__fadeInUp';
        habitItem.style.animationDelay = `${index * 0.1}s`;
        
        const habitInfo = document.createElement('div');
        habitInfo.className = 'habit-info';
        
        const habitName = document.createElement('span');
        habitName.className = 'habit-name';
        habitName.textContent = habit.habit;
        
        const habitTime = document.createElement('span');
        habitTime.className = 'habit-time';
        habitTime.textContent = `⏰ ${habit.timelimit}`;
        
        const statusBtn = document.createElement('button');
        statusBtn.className = `status-btn ${habit.status ? 'done' : 'pending'}`;
        statusBtn.textContent = habit.status ? '✓ Completed' : '○ Pending';
        statusBtn.onclick = () => toggleHabitStatus(habit._id, !habit.status);
        
        habitInfo.appendChild(habitName);
        habitInfo.appendChild(habitTime);
        habitItem.appendChild(habitInfo);
        habitItem.appendChild(statusBtn);
        habitsList.appendChild(habitItem);
    });
};

// Enhanced habit status toggle with animations
const toggleHabitStatus = async (habitId, status) => {
    const button = event.target;
    const originalText = button.textContent;
    const originalClass = button.className;
    
    button.textContent = status ? '⌛ Updating...' : '⌛ Updating...';
    button.className = `status-btn ${status ? 'done' : 'pending'} animate__animated animate__pulse`;
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

        await Promise.all([fetchHabits(), fetchCompletionPercentages()]);
    } catch (error) {
        console.error('Error:', error);
        button.textContent = originalText;
        button.className = originalClass;
        button.disabled = false;
        showToast('Failed to update habit status');
    }
};

// Enhanced completion percentages fetch with animations
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
        showToast('Failed to load completion data');
    }
};

// Display completion percentages with animations
const displayCompletionPercentages = (completionData) => {
    const completionList = document.getElementById('completion-list');
    completionList.innerHTML = '';

    completionData.forEach((entry, index) => {
        const item = document.createElement('div');
        item.className = 'completion-item animate__animated animate__fadeInRight';
        item.style.animationDelay = `${index * 0.1}s`;

        const date = document.createElement('span');
        date.className = 'completion-date';
        date.textContent = new Date(entry.date).toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric'
        });

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
    const dates = completionData.map(entry => 
        new Date(entry.date).toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric'
        })
    );
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
                    },
                    ticks: {
                        callback: value => `${value}%`
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
                    displayColors: false,
                    callbacks: {
                        label: context => `Completion: ${context.parsed.y.toFixed(1)}%`
                    }
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

// Enhanced toast notification
const showToast = (message) => {
    const toast = document.createElement('div');
    toast.className = 'toast animate__animated animate__fadeInUp';
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.classList.replace('animate__fadeInUp', 'animate__fadeOutDown');
        setTimeout(() => toast.remove(), 1000);
    }, 3000);
};

// Enhanced logout with animation
const logout = () => {
    const logoutBtn = document.querySelector('.logout-btn');
    logoutBtn.classList.add('animate__animated', 'animate__fadeOutRight');
    
    setTimeout(() => {
        localStorage.clear();
        redirectToLogin('Logged out successfully');
    }, 500);
};

// Initialize the application
if (checkAuth()) {
    fetchProtectedContent();
}
