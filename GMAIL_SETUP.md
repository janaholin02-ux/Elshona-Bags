## Gmail OTP Setup Guide

### Problem
Gmail rejected authentication with error:
```
Invalid login: 535-5.7.8 Username and Password not accepted
```

### Solution
Gmail requires an **App Password** (16-character password) for app-based email sending.

### Steps to Generate Gmail App Password

1. **Enable 2-Factor Authentication (if not already enabled)**:
   - Go to https://myaccount.google.com/security
   - Look for "2-Step Verification"
   - Follow the setup if not enabled

2. **Generate App Password**:
   - Go to https://myaccount.google.com/apppasswords
   - Select: **Mail** → **Windows Computer**
   - Google will display a 16-character password like: `jbhb suxp wvsy kmkp`

3. **Update `.env` File**:
   - Open `.env` in the project root
   - Replace `GMAIL_PASS=` value with your 16-character password (remove spaces)
   - Example:
     ```
     GMAIL_USER=janaholin02@gmail.com
     GMAIL_PASS=jbhbsuxpwvsykmkp
     GMAIL_FROM_NAME=Janah Olin
     ```

4. **Restart Server**:
   ```bash
   npm start
   ```

### Testing OTP Send
1. Go to forgot password form
2. Enter email: `janaholin02@gmail.com`
3. Click "Send OTP"
4. Check email for the OTP code

### If Still Failing
- Check server logs for detailed error messages
- Verify `.env` file is in the project root (same level as `server.js`)
- Ensure no extra spaces in `GMAIL_PASS` value
