import nodemailer from 'nodemailer';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

class EmailService {
  private isDevelopment = process.env.NODE_ENV === 'development';
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    this.setupTransporter();
  }

  private setupTransporter() {
    const emailUser = process.env.EMAIL_USER;
    const emailPass = process.env.EMAIL_PASS;

    if (emailUser && emailPass) {
      this.transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: emailUser,
          pass: emailPass,
        },
      });
      console.log('📧 Email service configured with Gmail SMTP');
    } else {
      console.log('⚠️  Email credentials not configured - emails will only be logged to console');
      console.log('   To enable email sending, set EMAIL_USER and EMAIL_PASS environment variables');
    }
  }

  async sendEmail(options: EmailOptions): Promise<boolean> {
    if (this.transporter) {
      try {
        await this.transporter.sendMail({
          from: `"GraphDone" <${process.env.EMAIL_USER}>`,
          to: options.to,
          subject: options.subject,
          html: options.html,
          text: options.text,
        });
        console.log(`✅ Email sent to: ${options.to}`);
        return true;
      } catch (error) {
        console.error('❌ Failed to send email:', error);
        console.log('📧 Email content (fallback to console):');
        console.log(`   To: ${options.to}`);
        console.log(`   Subject: ${options.subject}`);
        return false;
      }
    }

    if (this.isDevelopment) {
      console.log('\n📧 ================================');
      console.log('📧 EMAIL WOULD BE SENT');
      console.log('📧 ================================');
      console.log(`📧 To: ${options.to}`);
      console.log(`📧 Subject: ${options.subject}`);
      console.log('📧 --------------------------------');
      console.log(options.html);
      console.log('📧 ================================\n');
      return true;
    }

    return true;
  }

  async sendMagicLink(email: string, token: string): Promise<boolean> {
    const apiUrl = process.env.API_URL || 'http://localhost:4127';
    const magicLinkUrl = `${apiUrl}/auth/magic-link/verify?token=${token}`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .container {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border-radius: 10px;
            padding: 40px;
            text-align: center;
          }
          .content {
            background: white;
            border-radius: 8px;
            padding: 30px;
            margin-top: 20px;
          }
          h1 {
            color: white;
            margin: 0 0 10px 0;
            font-size: 28px;
          }
          p {
            color: white;
            margin: 0 0 20px 0;
          }
          .button {
            display: inline-block;
            padding: 14px 32px;
            background: #10b981;
            color: white !important;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 600;
            font-size: 16px;
            margin: 20px 0;
          }
          .footer {
            margin-top: 30px;
            font-size: 12px;
            color: #9ca3af;
          }
          .link {
            word-break: break-all;
            font-size: 12px;
            color: #6b7280;
            margin-top: 20px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>🔐 Your Magic Link</h1>
          <p>Click the button below to sign in to GraphDone</p>

          <div class="content">
            <p style="color: #333; font-size: 16px;">
              We received a request to sign in to your GraphDone account.
            </p>

            <a href="${magicLinkUrl}" class="button">
              Sign In to GraphDone
            </a>

            <p style="color: #6b7280; font-size: 14px; margin-top: 20px;">
              This link will expire in <strong>15 minutes</strong> and can only be used once.
            </p>

            <div class="link">
              <p style="color: #9ca3af;">Or copy and paste this link:</p>
              <p style="color: #3b82f6;">${magicLinkUrl}</p>
            </div>
          </div>

          <div class="footer">
            <p>If you didn't request this link, you can safely ignore this email.</p>
            <p>GraphDone - Project management for teams who think differently</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
      Sign in to GraphDone

      Click this link to sign in: ${magicLinkUrl}

      This link will expire in 15 minutes and can only be used once.

      If you didn't request this link, you can safely ignore this email.
    `;

    return this.sendEmail({
      to: email,
      subject: '🔐 Your GraphDone Magic Link',
      html,
      text
    });
  }

  async sendPasswordReset(email: string, token: string): Promise<boolean> {
    const apiUrl = process.env.API_URL || 'http://localhost:4127';
    const resetLinkUrl = `${apiUrl}/auth/reset-password?token=${token}`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .container {
            background: linear-gradient(135deg, #14b8a6 0%, #0d9488 50%, #3b82f6 100%);
            border-radius: 10px;
            padding: 40px;
            text-align: center;
          }
          .content {
            background: white;
            border-radius: 8px;
            padding: 30px;
            margin-top: 20px;
          }
          h1 {
            color: white;
            margin: 0 0 10px 0;
            font-size: 28px;
          }
          p {
            color: white;
            margin: 0 0 20px 0;
          }
          .button {
            display: inline-block;
            padding: 14px 32px;
            background: linear-gradient(135deg, #14b8a6 0%, #3b82f6 100%);
            color: white !important;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 600;
            font-size: 16px;
            margin: 20px 0;
          }
          .footer {
            margin-top: 30px;
            font-size: 12px;
            color: #9ca3af;
          }
          .link {
            word-break: break-all;
            font-size: 12px;
            color: #6b7280;
            margin-top: 20px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>🔐 Reset Your Password</h1>
          <p>You requested a password reset for your GraphDone account</p>

          <div class="content">
            <p style="color: #333; font-size: 16px;">
              Click the button below to reset your password.
            </p>

            <a href="${resetLinkUrl}" class="button">
              Reset Password
            </a>

            <p style="color: #6b7280; font-size: 14px; margin-top: 20px;">
              This link will expire in <strong>1 hour</strong> and can only be used once.
            </p>

            <div class="link">
              <p style="color: #9ca3af;">Or copy and paste this link:</p>
              <p style="color: #3b82f6;">${resetLinkUrl}</p>
            </div>
          </div>

          <div class="footer">
            <p>If you didn't request this password reset, you can safely ignore this email.</p>
            <p>GraphDone - Project management for teams who think differently</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
      Reset Your Password

      Click this link to reset your password: ${resetLinkUrl}

      This link will expire in 1 hour and can only be used once.

      If you didn't request this password reset, you can safely ignore this email.
    `;

    return this.sendEmail({
      to: email,
      subject: '🔐 Reset Your GraphDone Password',
      html,
      text
    });
  }
}

export const emailService = new EmailService();
