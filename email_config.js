module.exports = {
  smtp_host: process.env.GMAIL_HOST || 'smtp.gmail.com',
  smtp_port: process.env.GMAIL_PORT || 465,
  smtp_user: process.env.GMAIL_USER || 'janaholin02@gmail.com',
  smtp_pass: process.env.GMAIL_PASS || 'JanahMaganda321',
  from_email: process.env.GMAIL_USER || 'janaholin02@gmail.com',
  from_name: process.env.GMAIL_FROM_NAME || 'Janah Olin',
};
