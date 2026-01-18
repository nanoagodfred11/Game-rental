// Authentication utility functions

/**
 * Check if user is authenticated
 */
function isAuthenticated() {
    return !!localStorage.getItem('token');
}

/**
 * Get current user data
 */
function getCurrentUser() {
    const userData = localStorage.getItem('user');
    return userData ? JSON.parse(userData) : null;
}

/**
 * Get authentication headers
 */
function getAuthHeaders() {
    const token = localStorage.getItem('token');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
}

/**
 * Save authentication data
 */
function saveAuth(token, user) {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
}

/**
 * Clear authentication data
 */
function clearAuth() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
}

/**
 * Logout user and redirect to home
 */
function logout() {
    clearAuth();
    window.location.href = 'index.html';
}

/**
 * Redirect to login if not authenticated
 */
function requireAuth() {
    if (!isAuthenticated()) {
        window.location.href = 'login.html';
        return false;
    }
    return true;
}

/**
 * Update navigation based on auth status
 */
function updateNavAuth() {
    const authButtons = document.getElementById('auth-buttons');
    const userMenu = document.getElementById('user-menu');
    const userName = document.getElementById('user-name');
    
    if (authButtons && userMenu) {
        const user = getCurrentUser();
        if (isAuthenticated() && user) {
            authButtons.classList.add('hidden');
            userMenu.classList.remove('hidden');
            if (userName) {
                userName.textContent = user.full_name;
            }
        } else {
            authButtons.classList.remove('hidden');
            userMenu.classList.add('hidden');
        }
    }
}

/**
 * API request wrapper with error handling
 */
async function apiRequest(endpoint, options = {}) {
    const url = `${API_URL}${endpoint}`;
    const headers = {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
        ...options.headers
    };

    try {
        const response = await fetch(url, {
            ...options,
            headers
        });

        // Handle 401 Unauthorized
        if (response.status === 401) {
            clearAuth();
            if (window.location.pathname !== '/login.html') {
                window.location.href = 'login.html';
            }
            throw new Error('Session expired. Please login again.');
        }

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.detail || 'An error occurred');
        }

        return data;
    } catch (error) {
        if (error.name === 'TypeError') {
            throw new Error('Unable to connect to server. Please try again.');
        }
        throw error;
    }
}

// Initialize auth state on page load
document.addEventListener('DOMContentLoaded', () => {
    updateNavAuth();
});
