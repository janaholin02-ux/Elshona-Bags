const http = require('http');
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

require('dotenv').config();

const PORT = process.env.PORT || 3000;
const BASE_DIR = path.resolve(__dirname);
const DATA_FILE = path.join(BASE_DIR, 'data.json');
const emailConfig = require('./email_config');

const mimeTypes = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
};

function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return mimeTypes[ext] || 'application/octet-stream';
}

function sendResponse(res, statusCode, data, contentType, headers = {}) {
  res.writeHead(statusCode, { 'Content-Type': contentType, ...headers });
  res.end(data);
}

function sendJson(res, payload, statusCode = 200) {
  sendResponse(res, statusCode, JSON.stringify(payload), 'application/json', {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
}

function serveFile(reqPath, res) {
  let filePath = path.join(BASE_DIR, reqPath);

  if (!filePath.startsWith(BASE_DIR)) {
    sendResponse(res, 403, 'Forbidden', 'text/plain');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err) {
      sendResponse(res, 404, 'Not Found', 'text/plain');
      return;
    }

    if (stats.isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    }

    fs.readFile(filePath, (readErr, content) => {
      if (readErr) {
        sendResponse(res, 404, 'Not Found', 'text/plain');
        return;
      }

      sendResponse(res, 200, content, getContentType(filePath));
    });
  });
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
      if (body.length > 1e6) {
        req.socket.destroy();
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

function loadDatabase() {
  if (!fs.existsSync(DATA_FILE)) {
    return { accounts: {}, carts: {}, orders: [] };
  }
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (error) {
    console.error('Failed to load database:', error);
    return { accounts: {}, carts: {}, orders: [] };
  }
}

function saveDatabase(database) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(database, null, 2));
}

function findAccount({ username, email }) {
  const database = loadDatabase();
  const normalizedEmail = String(email || '').trim().toLowerCase();

  if (username && database.accounts[username]) {
    const account = database.accounts[username];
    if (email && account.email && account.email.toLowerCase() !== normalizedEmail) {
      return null;
    }
    return { username, account, database };
  }

  for (const [name, account] of Object.entries(database.accounts)) {
    if (account.email && account.email.toLowerCase() === normalizedEmail) {
      return { username: name, account, database };
    }
  }

  return null;
}

async function sendOtpEmail(to, name, otp) {
  const mailOptions = {
    from: `${emailConfig.from_name} <${emailConfig.from_email}>`,
    to,
    replyTo: emailConfig.from_email,
    subject: 'Your Elshona Bags Password Reset Code',
    text: `Hello ${name},\n\nYou requested a password reset for your Elshona Bags account.\n\nYour verification code is: ${otp}\n\nThis code will expire in 10 minutes.\n\nIf you did not request this, please ignore this email.\n\nThank you,\nElshona Bags`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
        <h2 style="color: #5d4b2f; text-align: center;">Elshona Bags Password Reset</h2>
        <p>Hello <strong>${name}</strong>,</p>
        <p>You requested a password reset for your Elshona Bags account.</p>
        <p>Your verification code is:</p>
        <div style="text-align: center; margin: 20px 0;">
          <span style="font-size: 24px; font-weight: bold; color: #5d4b2f; background: #f9f9f9; padding: 10px 20px; border-radius: 5px; display: inline-block;">${otp}</span>
        </div>
        <p>This code will expire in 10 minutes for security reasons.</p>
        <p>If you did not request this password reset, please ignore this email. Your account remains secure.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="font-size: 12px; color: #666; text-align: center;">
          This is an automated message from Elshona Bags. Please do not reply to this email.
        </p>
      </div>
    `,
  };

  const transportConfig = {
    host: emailConfig.smtp_host,
    port: Number(emailConfig.smtp_port) || 465,
    secure: true,
    auth: {
      user: emailConfig.smtp_user,
      pass: emailConfig.smtp_pass,
    },
    tls: {
      rejectUnauthorized: false,
    },
    logger: true,
    debug: true,
  };

  const transporter = nodemailer.createTransport(transportConfig);

  try {
    const info = await transporter.sendMail(mailOptions);
    return info;
  } catch (error) {
    console.error('Email send error:', error);
    throw new Error(`Email send failed: ${error.message}`);
  }
}

async function handleSendOtp(req, res) {
  try {
    const body = await parseJsonBody(req);
    const email = String(body.email || body.Email || '').trim();
    const username = String(body.username || '').trim();

    if (!email) {
      return sendJson(res, { success: false, message: 'Email is required.' }, 400);
    }

    const found = findAccount({ username, email });
    if (!found) {
      return sendJson(res, { success: false, message: 'Account not found.' }, 404);
    }

    const { username: foundUsername, account, database } = found;
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    account.otp = otp;
    account.otpExpires = Date.now() + 10 * 60 * 1000;
    database.accounts[foundUsername] = account;
    saveDatabase(database);

    console.log(`[OTP] Generated for ${email}: ${otp}`);

    try {
      await sendOtpEmail(account.email, account.name || foundUsername, otp);
      console.log(`[OTP] Email sent successfully to ${email}`);
      sendJson(res, { success: true, message: 'OTP sent successfully.' });
    } catch (emailError) {
      console.error(`[OTP] Email send failed: ${emailError.message}`);
      sendJson(res, { success: false, message: `Email service error: ${emailError.message}` }, 500);
    }
  } catch (error) {
    console.error('sendOtp error:', error);
    sendJson(res, { success: false, message: error.message || 'Unable to send OTP.' }, 500);
  }
}

function handleVerifyOtp(req, res) {
  parseJsonBody(req)
    .then(body => {
      const email = String(body.email || '').trim();
      const code = String(body.code || '').trim();

      if (!email || !code) {
        return sendJson(res, { success: false, message: 'Email and OTP are required.' }, 400);
      }

      const found = findAccount({ email });
      if (!found) {
        return sendJson(res, { success: false, message: 'Account not found.' }, 404);
      }

      const { account } = found;
      if (!account.otp || !account.otpExpires || Date.now() > account.otpExpires) {
        return sendJson(res, { success: false, message: 'OTP is invalid or expired.' }, 400);
      }
      if (account.otp !== code) {
        return sendJson(res, { success: false, message: 'Invalid OTP code.' }, 400);
      }

      sendJson(res, { success: true, message: 'OTP verified.' });
    })
    .catch(error => {
      console.error('verifyOtp error:', error);
      sendJson(res, { success: false, message: 'Invalid request body.' }, 400);
    });
}

function handleResetPassword(req, res) {
  parseJsonBody(req)
    .then(body => {
      const username = String(body.username || '').trim();
      const email = String(body.email || '').trim();
      const otp = String(body.otp || '').trim();
      const password = String(body.password || '').trim();

      if (!password || !otp || !email) {
        return sendJson(res, { success: false, message: 'Email, OTP, and new password are required.' }, 400);
      }

      const found = findAccount({ username, email });
      if (!found) {
        return sendJson(res, { success: false, message: 'Account not found.' }, 404);
      }

      const { username: foundUsername, account, database } = found;
      if (!account.otp || !account.otpExpires || Date.now() > account.otpExpires) {
        return sendJson(res, { success: false, message: 'OTP is invalid or expired.' }, 400);
      }
      if (account.otp !== otp) {
        return sendJson(res, { success: false, message: 'Invalid OTP code.' }, 400);
      }

      account.password = password;
      delete account.otp;
      delete account.otpExpires;
      database.accounts[foundUsername] = account;
      saveDatabase(database);

      sendJson(res, { success: true, message: 'Password reset successfully.' });
    })
    .catch(error => {
      console.error('resetPassword error:', error);
      sendJson(res, { success: false, message: 'Invalid request body.' }, 400);
    });
}

function handleSignup(req, res) {
  parseJsonBody(req)
    .then(body => {
      const username = String(body.username || '').trim();
      const name = String(body.name || '').trim();
      const email = String(body.email || '').trim();
      const password = String(body.password || '').trim();
      const cart = Array.isArray(body.cart) ? body.cart : [];

      if (!username || !name || !email || !password) {
        return sendJson(res, { success: false, message: 'All signup fields are required.' }, 400);
      }

      const database = loadDatabase();
      database.accounts = database.accounts || {};
      database.carts = database.carts || {};
      database.orders = database.orders || [];

      if (database.accounts[username]) {
        return sendJson(res, { success: false, message: 'Username already exists.' }, 409);
      }

      for (const account of Object.values(database.accounts)) {
        if (account.email && account.email.toLowerCase() === email.toLowerCase()) {
          return sendJson(res, { success: false, message: 'Email already in use.' }, 409);
        }
      }

      database.accounts[username] = {
        name,
        email,
        password,
        createdAt: new Date().toISOString()
      };
      database.carts[username] = cart;
      saveDatabase(database);

      sendJson(res, { success: true, message: 'Account created successfully.' });
    })
    .catch(error => {
      console.error('signup error:', error);
      sendJson(res, { success: false, message: 'Invalid request body.' }, 400);
    });
}

function handleSaveCart(req, res) {
  parseJsonBody(req)
    .then(body => {
      const username = String(body.username || '').trim();
      const cart = Array.isArray(body.cart) ? body.cart : null;

      if (!username || cart === null) {
        return sendJson(res, { success: false, message: 'Username and cart are required.' }, 400);
      }

      const database = loadDatabase();
      database.carts = database.carts || {};
      database.carts[username] = cart;
      saveDatabase(database);

      sendJson(res, { success: true, message: 'Cart saved successfully.' });
    })
    .catch(error => {
      console.error('saveCart error:', error);
      sendJson(res, { success: false, message: 'Invalid request body.' }, 400);
    });
}

const server = http.createServer((req, res) => {
  const requestPath = decodeURIComponent(req.url.split('?')[0]);

  if (req.method === 'OPTIONS' && requestPath.startsWith('/api/')) {
    return sendResponse(res, 200, '', 'text/plain', {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
  }

  if (req.method === 'POST' && requestPath === '/api/signup') {
    return handleSignup(req, res);
  }

  if (req.method === 'POST' && requestPath === '/api/save-cart') {
    return handleSaveCart(req, res);
  }

  if (req.method === 'POST' && requestPath === '/api/send-otp') {
    return handleSendOtp(req, res);
  }

  if (req.method === 'POST' && requestPath === '/api/verify-otp') {
    return handleVerifyOtp(req, res);
  }

  if (req.method === 'POST' && requestPath === '/api/reset-password') {
    return handleResetPassword(req, res);
  }

  let filePath = requestPath === '/' ? '/index.html' : requestPath;
  serveFile(filePath, res);
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
