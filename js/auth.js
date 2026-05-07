// Load saved auth state from localStorage
async function loadAuthState() {
    const storedUser = localStorage.getItem('elshonaCurrentUser') || sessionStorage.getItem('elshonaCurrentUser');
    if (!storedUser) return;

    if (typeof ensureDatabaseLoaded === 'function') {
        await ensureDatabaseLoaded();
    }

    window.currentUser = storedUser;
    isLoggedIn = true;
    if (typeof getCart === 'function') {
        window.cart = getCart(storedUser) || [];
    }
    if (typeof updateCart === 'function') {
        updateCart();
    }
}

// Shared notification helper
function showNotification(message) {
    const notification = document.getElementById('notification');
    if (!notification) return;
    notification.textContent = message;
    notification.classList.add('show');
    clearTimeout(notification.hideTimer);
    notification.hideTimer = setTimeout(() => notification.classList.remove('show'), 3200);
    notification.onclick = () => notification.classList.remove('show');
}

// Load external login HTML
function loadLoginHtml() {
    const container = document.getElementById('authContainer');
    if (!container) return;

    fetch('html/login.html')
        .then(response => {
            if (!response.ok) throw new Error('Unable to load login.html');
            return response.text();
        })
        .then(html => {
            container.innerHTML = html;
            updateAuthButtons();
            showLogin();
        })
        .catch(error => {
            console.warn('Failed to load login.html:', error);
            container.innerHTML = '<p style="padding: 20px; color: #900; text-align: center;">Unable to load login panel.</p>';
        });
}

function getAuthModal() {
    return document.getElementById('authModal');
}

function openModal() {
    const authModal = getAuthModal();
    if (!authModal) return;
    authModal.style.display = 'flex';
    authModal.classList.add('open');
    showLogin();
}

function closeLoginModal() {
    const authModal = getAuthModal();
    if (!authModal) return;
    authModal.classList.remove('open');
    authModal.style.display = 'none';
}

function setAuthTitle(title, subtitle) {
    const titleEl = document.getElementById('authTitle');
    const subtitleEl = document.getElementById('authSubtitle');
    if (titleEl) titleEl.innerText = title;
    if (subtitleEl) subtitleEl.innerText = subtitle;
}

function setAuthSwitch(html) {
    const authSwitch = document.getElementById('authSwitch');
    if (authSwitch) authSwitch.innerHTML = html;
}

function toggleFormSections(activeId) {
    ['loginForm', 'signupForm', 'resetForm'].forEach(id => {
        const element = document.getElementById(id);
        if (!element) return;
        element.classList.toggle('hidden', id !== activeId);
    });
}

function showLogin() {
    toggleFormSections('loginForm');
    setAuthTitle('Welcome Back', 'Sign in to your account');
    setAuthSwitch(`Don't have an account? <a href="#" onclick="showSignup(); return false;">Sign Up</a>`);
}

function showSignup() {
    toggleFormSections('signupForm');
    setAuthTitle('Create Account', 'Join Elshona Bags today');
    setAuthSwitch(`Already have an account? <a href="#" onclick="showLogin(); return false;">Sign In</a>`);
}

function showResetPassword() {
    toggleFormSections('resetForm');
    setAuthTitle('Reset Password', 'Enter your details to reset');
    setAuthSwitch(`Remembered it? <a href="#" onclick="showLogin(); return false;">Sign In</a>`);
}

function togglePasswordVisibility(fieldId) {
    const field = document.getElementById(fieldId);
    if (!field) return;
    field.type = field.type === 'password' ? 'text' : 'password';
}

async function login() {
    await ensureDatabaseLoaded();

    const username = document.getElementById('loginUser')?.value.trim();
    const password = document.getElementById('loginPass')?.value.trim();
    const rememberMe = document.getElementById('rememberMe')?.checked;

    if (!username || !password) {
        showNotification('Please enter your username or email and password.');
        return;
    }

    const match = findAccount(username);
    if (!match) {
        showNotification('Account not found. Please sign up first.');
        return;
    }

    const account = match.account;
    const signedInUsername = match.username;
    if (!account || account.password !== password) {
        showNotification('Incorrect username/email or password.');
        return;
    }

    isLoggedIn = true;
    window.currentUser = signedInUsername;
    if (rememberMe) {
        localStorage.setItem('elshonaCurrentUser', signedInUsername);
        sessionStorage.removeItem('elshonaCurrentUser');
    } else {
        sessionStorage.setItem('elshonaCurrentUser', signedInUsername);
        localStorage.removeItem('elshonaCurrentUser');
    }
    window.cart = getCart(signedInUsername) || [];
    updateCart();
    updateAuthButtons();
    if (document.body.classList.contains('login-page')) {
        showNotification(`Signed in as ${signedInUsername}`);
        window.location.href = 'index.html';
        return;
    }
    closeLoginModal();
    showNotification(`Signed in as ${signedInUsername}`);
}

async function signup() {
    await ensureDatabaseLoaded();

    const name = document.getElementById('signupName')?.value.trim();
    const username = document.getElementById('signupUser')?.value.trim();
    const email = document.getElementById('signupEmail')?.value.trim();
    const password = document.getElementById('signupPass')?.value.trim();
    const confirm = document.getElementById('signupPassConfirm')?.value.trim();
    const agree = document.getElementById('agreeSignup');

    if (!name || !username || !email || !password || !confirm || !agree?.checked) {
        showNotification('Please complete the signup form and agree to the terms.');
        return;
    }
    if (password !== confirm) {
        showNotification('Passwords do not match.');
        return;
    }
    if (accountExists(username)) {
        showNotification('Username is already taken. Please choose another.');
        return;
    }

    const accountData = {
        name,
        email,
        password,
        createdAt: new Date().toISOString()
    };

    try {
        const response = await fetch('save_account.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, ...accountData })
        });

        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
            const text = await response.text();
            console.warn('Signup response was not JSON, falling back to local save.', text);
            saveAccount(username, accountData);
            saveCart(username, []);
            completeSignup(username);
            return;
        }

        const data = await response.json();
        if (!response.ok) {
            if (response.status === 404 || response.status >= 500) {
                saveAccount(username, accountData);
                saveCart(username, []);
                completeSignup(username);
                return;
            }
            showNotification(data.message || 'Unable to create account.');
            return;
        }

        if (!data.success) {
            showNotification(data.message || 'Unable to create account.');
            return;
        }

        saveAccount(username, accountData);
        saveCart(username, []);
        completeSignup(username);
    } catch (error) {
        console.warn('Signup fetch failed, falling back to local save:', error);
        saveAccount(username, accountData);
        saveCart(username, []);
        completeSignup(username);
    }
}

function completeSignup(username) {
    isLoggedIn = true;
    window.currentUser = username;
    window.cart = [];
    localStorage.setItem('elshonaCurrentUser', username);
    updateCart();
    updateAuthButtons();
    if (document.body.classList.contains('login-page')) {
        showNotification(`Account created for ${username}`);
        window.location.href = 'index.html';
        return;
    }
    closeLoginModal();
    showNotification(`Account created for ${username}`);
}

function resetPassword() {
    const user = document.getElementById('resetUser')?.value.trim();
    const email = document.getElementById('resetEmail')?.value.trim();
    const otp = document.getElementById('resetOtp')?.value.trim();
    const password = document.getElementById('resetPass')?.value.trim();
    const confirm = document.getElementById('resetPassConfirm')?.value.trim();

    if (!user || !email || !otp || !password || !confirm) {
        showNotification('Please complete the password reset form.');
        return;
    }
    if (password !== confirm) {
        showNotification('Passwords do not match.');
        return;
    }

    fetch('reset_password.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user, email, otp, password })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            showNotification('Password reset successful. Please sign in again.');
            showLogin();
            window.location.reload();
        } else {
            showNotification(data.message || 'Unable to reset your password.');
        }
    })
    .catch(() => {
        showNotification('Unable to connect to the password reset service.');
    });
}

function sendResetOtp() {
    const user = document.getElementById('resetUser')?.value.trim();
    const email = document.getElementById('resetEmail')?.value.trim();
    const button = document.querySelector('#resetForm .otp-btn');

    if (!user || !email) {
        showNotification('Enter your username and email to send OTP.');
        return;
    }

    if (button) {
        button.disabled = true;
        button.textContent = 'Sending...';
    }

    fetch('send_otp.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user, email })
    })
    .then(res => res.json())
    .then(data => {
        if (button) {
            button.disabled = false;
            button.textContent = 'Send OTP';
        }
        if (data.success) {
            showNotification('OTP sent to your email. Check your inbox.');
        } else {
            showNotification(data.message || 'Unable to send OTP.');
        }
    })
    .catch(() => {
        if (button) {
            button.disabled = false;
            button.textContent = 'Send OTP';
        }
        showNotification('Unable to send OTP. Please check your server settings.');
    });
}

function logout() {
    isLoggedIn = false;
    window.currentUser = null;
    localStorage.removeItem('elshonaCurrentUser');
    sessionStorage.removeItem('elshonaCurrentUser');
    window.cart = [];
    if (typeof updateCart === 'function') {
        updateCart();
    }
    hideAdminPanel();
    const dropdown = document.getElementById('accountDropdown');
    if (dropdown) dropdown.style.display = 'none';
    updateAuthButtons();
    showNotification('Logged out successfully.');

    const authModal = getAuthModal();
    if (authModal) {
        authModal.style.display = 'flex';
        authModal.classList.add('open');
        showLogin();
    }
}

function updateAuthButtons() {
    const logoutItem = document.getElementById('logoutItem');
    if (logoutItem) logoutItem.style.display = isLoggedIn ? 'block' : 'none';

    const adminItem = document.getElementById('adminItem');
    if (adminItem) {
        adminItem.style.display = isLoggedIn && window.currentUser === 'admin' ? 'block' : 'none';
    }
}

function renderAdminPanel() {
    const accountsBody = document.querySelector('#adminAccountsTable tbody');
    const cartsBody = document.querySelector('#adminCartsTable tbody');
    if (!accountsBody || !cartsBody) return;

    accountsBody.innerHTML = '';
    const accounts = (typeof database !== 'undefined' && database.accounts) ? database.accounts : {};
    Object.entries(accounts).forEach(([username, account]) => {
        accountsBody.innerHTML += `
            <tr>
                <td>${username}</td>
                <td>${account.name || ''}</td>
                <td>${account.email || ''}</td>
                <td>${account.createdAt || ''}</td>
            </tr>`;
    });

    cartsBody.innerHTML = '';
    const carts = (typeof database !== 'undefined' && database.carts) ? database.carts : {};
    Object.entries(carts).forEach(([username, items]) => {
        const totalQty = items.reduce((sum, item) => sum + (item.qty || 1), 0);
        const totalValue = items.reduce((sum, item) => sum + ((item.qty || 1) * item.price), 0);
        cartsBody.innerHTML += `
            <tr>
                <td>${username}</td>
                <td>${items.length}</td>
                <td>${totalQty}</td>
                <td>₱${totalValue}</td>
            </tr>`;
    });
}

function showAdminPanel() {
    if (window.currentUser !== 'admin') {
        showNotification('Admin access only.');
        return;
    }
    const panel = document.getElementById('adminPanel');
    if (!panel) return;
    panel.style.display = 'block';
    panel.classList.add('open');
    renderAdminPanel();
}

function hideAdminPanel() {
    const panel = document.getElementById('adminPanel');
    if (!panel) return;
    panel.style.display = 'none';
    panel.classList.remove('open');
}

function toggleAccountDropdown() {
    const dropdown = document.getElementById('accountDropdown');
    if (dropdown) {
        dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
    }
}

// Close dropdown when clicking outside
document.addEventListener('click', function(event) {
    const accountDropdown = document.querySelector('.account-dropdown');
    if (accountDropdown && !accountDropdown.contains(event.target)) {
        const dropdown = document.getElementById('accountDropdown');
        if (dropdown) dropdown.style.display = 'none';
    }
});

// Initialize auth state and page behavior
document.addEventListener('DOMContentLoaded', async function() {
    if (typeof ensureDatabaseLoaded === 'function') {
        await ensureDatabaseLoaded();
    }
    await loadAuthState();
    loadLoginHtml();
    if (document.body.classList.contains('login-page')) {
        showLogin();
    }
    updateAuthButtons();
});
