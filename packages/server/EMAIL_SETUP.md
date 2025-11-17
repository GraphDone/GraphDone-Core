# Email Setup for Magic Links

## Quick Setup (Gmail)

To enable actual email sending in development, follow these steps:

### 1. Generate a Gmail App Password

1. Go to your Google Account: https://myaccount.google.com/
2. Click on "Security" in the left sidebar
3. Enable 2-Step Verification if not already enabled
4. Search for "App passwords" or go to: https://myaccount.google.com/apppasswords
5. Select app: "Mail"
6. Select device: "Other" and name it "GraphDone"
7. Click "Generate"
8. Copy the 16-character password (it will look like: `abcd efgh ijkl mnop`)

### 2. Update Your .env File

Edit `/packages/server/.env` and replace these values:

```bash
EMAIL_USER=your-email@gmail.com        # Your Gmail address
EMAIL_PASS=abcd efgh ijkl mnop        # The 16-character app password from step 1
```

**Important:** Use the App Password, NOT your regular Gmail password!

### 3. Restart the Server

```bash
# Stop the current server (Ctrl+C)
# Then restart
npm run dev
```

You should see this message when the server starts:
```
📧 Email service configured with Gmail SMTP
```

### 4. Test Email Sending

Send a magic link request:

```bash
curl -X POST http://localhost:4127/auth/magic-link/request \
  -H "Content-Type: application/json" \
  -d '{"email":"your-email@gmail.com"}'
```

Check your inbox! You should receive an email from GraphDone with your magic link.

## Troubleshooting

### "Invalid login" error
- Make sure you're using an App Password, not your regular password
- Verify 2-Step Verification is enabled on your Google Account

### "Less secure app access" error
- Use App Passwords instead (newer Google accounts don't support less secure apps)

### Still seeing "EMAIL WOULD BE SENT" in console
- Check that EMAIL_USER and EMAIL_PASS are set in .env
- Restart the server after updating .env
- Check for typos in environment variable names

## Alternative: Other Email Services

### SendGrid
```bash
EMAIL_SERVICE=sendgrid
SENDGRID_API_KEY=your-sendgrid-api-key
```

### Mailgun
```bash
EMAIL_SERVICE=mailgun
MAILGUN_API_KEY=your-mailgun-api-key
MAILGUN_DOMAIN=your-domain.mailgun.org
```

(These require additional configuration in email-service.ts)
