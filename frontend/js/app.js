// Common utility functions for the app

/**
 * Format currency in Ghana Cedis
 */
function formatCurrency(amount) {
    return `GH₵ ${amount.toLocaleString()}`;
}

/**
 * Format date for display
 */
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

/**
 * Format time for display
 */
function formatTime(dateString) {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
    });
}

/**
 * Format datetime for display
 */
function formatDateTime(dateString) {
    return `${formatDate(dateString)} at ${formatTime(dateString)}`;
}

/**
 * Calculate total amount for booking
 */
function calculateTotal(hours) {
    return hours * HOURLY_RATE;
}

/**
 * Format booking status for display
 */
function formatStatus(status) {
    const statusMap = {
        'pending': 'Pending',
        'confirmed': 'Confirmed',
        'in_progress': 'In Progress',
        'completed': 'Completed',
        'cancelled': 'Cancelled'
    };
    return statusMap[status] || status;
}

/**
 * Format payment status for display
 */
function formatPaymentStatus(status) {
    const statusMap = {
        'pending': 'Payment Pending',
        'paid': 'Paid',
        'refunded': 'Refunded'
    };
    return statusMap[status] || status;
}

/**
 * Get CSS classes for booking status
 */
function getStatusClasses(status) {
    const classes = {
        'pending': 'bg-yellow-500/20 text-yellow-400 border-yellow-500',
        'confirmed': 'bg-blue-500/20 text-blue-400 border-blue-500',
        'in_progress': 'bg-green-500/20 text-green-400 border-green-500',
        'completed': 'bg-gray-500/20 text-gray-400 border-gray-500',
        'cancelled': 'bg-red-500/20 text-red-400 border-red-500'
    };
    return classes[status] || 'bg-gray-500/20 text-gray-400 border-gray-500';
}

/**
 * Get CSS classes for payment status
 */
function getPaymentStatusClasses(status) {
    const classes = {
        'pending': 'bg-orange-500/20 text-orange-400 border-orange-500',
        'paid': 'bg-green-500/20 text-green-400 border-green-500',
        'refunded': 'bg-purple-500/20 text-purple-400 border-purple-500'
    };
    return classes[status] || 'bg-gray-500/20 text-gray-400 border-gray-500';
}

/**
 * Show toast notification
 */
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    const bgColor = {
        'success': 'bg-green-500',
        'error': 'bg-red-500',
        'warning': 'bg-yellow-500',
        'info': 'bg-blue-500'
    }[type] || 'bg-blue-500';

    toast.className = `fixed bottom-4 right-4 ${bgColor} text-white px-6 py-3 rounded-lg shadow-lg z-50 transform transition-transform duration-300 translate-y-full`;
    toast.textContent = message;

    document.body.appendChild(toast);

    // Animate in
    requestAnimationFrame(() => {
        toast.classList.remove('translate-y-full');
    });

    // Remove after 3 seconds
    setTimeout(() => {
        toast.classList.add('translate-y-full');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

/**
 * Show loading spinner in element
 */
function showLoading(element) {
    element.innerHTML = `
        <div class="text-center py-12">
            <i class="fas fa-spinner fa-spin text-4xl text-accent"></i>
            <p class="mt-4 text-gray-400">Loading...</p>
        </div>
    `;
}

/**
 * Show error message in element
 */
function showError(element, message, retryCallback = null) {
    element.innerHTML = `
        <div class="text-center py-12">
            <i class="fas fa-exclamation-triangle text-4xl text-red-500 mb-4"></i>
            <p class="text-gray-400 mb-4">${message}</p>
            ${retryCallback ? '<button onclick="' + retryCallback + '" class="px-6 py-2 bg-accent text-dark rounded-lg">Retry</button>' : ''}
        </div>
    `;
}

/**
 * Debounce function
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Validate email format
 */
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * Validate Ghana phone number
 */
function isValidGhanaPhone(phone) {
    const phoneRegex = /^0[235][0-9]{8}$/;
    return phoneRegex.test(phone.replace(/\s/g, ''));
}
