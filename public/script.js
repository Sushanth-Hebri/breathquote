// script.js
document.getElementById('loginForm').addEventListener('submit', async function (e) {
    e.preventDefault(); // Prevent the default form submission

    // Get input values
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    // Validate email format
    if (!validateEmail(email)) {
        document.getElementById('message').innerText = 'Please enter a valid email address.';
        return;
    }

    // Send login request to the server
    try {
        const response = await fetch('http://localhost:5000/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password }),
        });

        const data = await response.json();
        if (response.ok) {
            document.getElementById('message').innerText = 'Login successful! ';
            const token = data.token;
            localStorage.setItem('token', token);
             // Redirect to home page
             window.location.href = 'home.html';
        } else {
            
            document.getElementById('message').innerText = data.message;

        }
    } catch (error) {
        console.error('Error:', error);
        document.getElementById('message').innerText = 'An error occurred while logging in.';
    }
});

// Function to validate email format
function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(String(email).toLowerCase());
}
