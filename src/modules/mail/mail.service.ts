import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { EmailTemplatesService } from '../email-templates/email-templates.service';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private resend: Resend;
  private readonly defaultFrom: string;

  constructor(
    private configService: ConfigService,
    private templateService: EmailTemplatesService,
  ) {
    const apiKey = this.configService.get<string>('RESEND_API_KEY');
    if (!apiKey) {
      this.logger.warn('RESEND_API_KEY is not defined. Email sending will be disabled.');
    }
    this.resend = new Resend(apiKey);
    this.defaultFrom = this.configService.get<string>('EMAIL_FROM') || 'WiseKings <noreply@wisekings.ng>';
  }

  async sendEmail(to: string, subject: string, html: string, templateName?: string, variables?: any) {
    let finalSubject = subject;
    let finalHtml = html;

    if (templateName) {
      const template = await this.templateService.findByName(templateName);
      if (template) {
        finalSubject = this.replaceVariables(template.subject, variables);
        finalHtml = this.replaceVariables(template.content, variables);
      }
    }

    try {
      const { data, error } = await this.resend.emails.send({
        from: this.defaultFrom,
        to,
        subject: finalSubject,
        html: finalHtml,
      });

      if (error) {
        console.error('Mail Error:', error);
        return null;
      }

      return data;
    } catch (err) {
      console.error('Mail Exception:', err);
      return null;
    }
  }

  private replaceVariables(text: string, variables: any): string {
    if (!variables) return text;
    return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key) => {
      return variables[key] !== undefined ? variables[key] : match;
    });
  }

  private brandWrapper(title: string, content: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          .email-wrapper { font-family: 'Inter', system-ui, -apple-system, sans-serif; line-height: 1.6; color: #1f2937; max-width: 600px; margin: 0 auto; padding: 40px 20px; background-color: #f9fafb; }
          .container { background-color: #ffffff; border-radius: 24px; padding: 48px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); border: 1px solid #f3f4f6; }
          .logo { text-align: center; margin-bottom: 32px; }
          .header { text-align: center; margin-bottom: 32px; }
          .title { color: #033958; font-size: 24px; font-weight: 800; margin: 0; letter-spacing: -0.025em; }
          .content { font-size: 16px; margin-bottom: 32px; color: #4b5563; }
          .footer { text-align: center; font-size: 12px; color: #9ca3af; margin-top: 32px; }
          .btn { display: inline-block; padding: 14px 32px; background-color: #033958; color: #ffffff !important; text-decoration: none; border-radius: 14px; font-weight: 700; font-size: 14px; transition: all 0.2s; box-shadow: 0 10px 15px -3px rgba(3, 57, 88, 0.2); }
          .otp-card { background-color: #f3f4f6; border-radius: 16px; padding: 24px; text-align: center; margin: 32px 0; border: 1px solid #e5e7eb; }
          .otp-code { font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #033958; font-family: monospace; }
        </style>
      </head>
      <body>
        <div class="email-wrapper">
          <div class="container">
            <div class="logo">
              <img src="https://wisekings.ng/logo-dark.png" alt="WiseKings" style="height: 40px;">
            </div>
            <div class="header">
              <h1 class="title">${title}</h1>
            </div>
            <div class="content">
              ${content}
            </div>
            <div class="footer">
              &copy; ${new Date().getFullYear()} WiseKings Africa. All rights reserved.<br>
              Premium Experience. Trusted Quality.
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  // --- Pre-defined Email Templates --- //

  // --- Pre-defined Email Templates --- //

  async sendPartnerApplicationReceived(email: string, name: string) {
    const subject = 'Application Received - WiseKings Partnership';
    const html = this.brandWrapper(
      'Application Received',
      `
      <p>Hi ${name},</p>
      <p>Thank you for applying to be a WiseKings Partner. We have received your application and our team is currently reviewing it carefully.</p>
      <p>You will receive a follow-up email once our verification team has completed their review.</p>
      `
    );
    return this.sendEmail(email, subject, html);
  }

  async sendPartnerApplicationApproved(email: string, name: string) {
    const subject = 'Application Approved - Action Required';
    const html = this.brandWrapper(
      'Congratulations!',
      `
      <p>Hi ${name},</p>
      <p>Your application to become a WiseKings Partner has been <strong>approved</strong>.</p>
      <p>To finalize your onboarding and start financing invoices, please log in to your dashboard to review and digitally sign the agreement.</p>
      <div style="text-align: center; margin-top: 32px;">
        <a href="${this.configService.get('PARTNER_URL')}/login" class="btn">Log In to Sign Agreement</a>
      </div>
      `
    );
    return this.sendEmail(email, subject, html);
  }

  async sendAdminNewPartnerAlert(adminEmail: string, partnerName: string) {
    const subject = 'New Partner Application';
    const html = this.brandWrapper(
      'New Application Alert',
      `
      <p>A new applicant, <strong>${partnerName}</strong>, has submitted a partnership application.</p>
      <p>Please log in to the admin dashboard to review their profile and conduct the necessary verification steps.</p>
      <div style="text-align: center; margin-top: 32px;">
        <a href="${this.configService.get('ADMIN_URL')}/partners" class="btn">Review Application</a>
      </div>
      `
    );
    return this.sendEmail(adminEmail, subject, html);
  }

  async sendOtpEmail(email: string, name: string, otpCode: string) {
    const subject = 'Your Verification Code';
    const html = this.brandWrapper(
      'Verify Your Email',
      `
      <p>Hi ${name || 'there'},</p>
      <p>Please use the following security code to verify your identity. This code is confidential and valid for 15 minutes.</p>
      <div class="otp-card">
        <span class="otp-code">${otpCode}</span>
      </div>
      <p style="font-size: 13px; color: #6b7280;">If you did not request this code, please secure your account immediately or contact support.</p>
      `
    );
    return this.sendEmail(email, subject, html);
  }

  async sendAdminInvitationEmail(email: string, name: string, otpCode: string) {
    const subject = 'Invitation to join WiseKings Admin';
    const html = this.brandWrapper(
      'Join the Team',
      `
      <p>Hi ${name},</p>
      <p>You have been invited to join the WiseKings Administrative team. Please use the following temporary verification code to complete your registration and set your secure password.</p>
      <div class="otp-card">
        <span class="otp-code">${otpCode}</span>
      </div>
      <p>This invitation is valid for 24 hours.</p>
      `
    );
    return this.sendEmail(email, subject, html);
  }

  async sendKycSubmittedEmail(email: string, name: string) {
    const subject = 'KYC Documents Received';
    const html = this.brandWrapper(
      'Documents Received',
      `
      <p>Hi ${name},</p>
      <p>We have successfully received your KYC verification documents. Our team is currently reviewing them.</p>
      <p>This process usually takes 24-48 hours. We will notify you via email as soon as the review is complete.</p>
      <p>Thank you for partnering with WiseKings.</p>
      `
    );
    return this.sendEmail(email, subject, html);
  }

  async sendKycStatusUpdate(email: string, name: string, status: 'approved' | 'rejected', reason?: string) {
    const isApproved = status === 'approved';
    const title = isApproved ? 'KYC Verified' : 'KYC Action Required';
    const subject = `KYC Verification ${isApproved ? 'Successful' : 'Rejected'}`;

    const content = isApproved
      ? `
        <p>Hi ${name},</p>
        <p>Great news! Your KYC (Know Your Customer) documents have been verified successfully. Your account is now fully active with increased trust limits.</p>
        <div style="text-align: center; margin-top: 32px;">
          <a href="${this.configService.get('USER_URL') || '#'}" class="btn">Explore Dashboard</a>
        </div>
      `
      : `
        <p>Hi ${name},</p>
        <p>Unfortunately, your KYC verification was not successful for the following reason:</p>
        <div style="background-color: #fee2e2; border-left: 4px solid #ef4444; padding: 16px; margin: 24px 0; color: #991b1b; font-weight: 500;">
          ${reason || 'Documents provided were unclear or invalid.'}
        </div>
        <p>Please log in to your dashboard to re-submit valid documents.</p>
        <div style="text-align: center; margin-top: 32px;">
          <a href="${this.configService.get('USER_URL') || '#'}/kyc" class="btn">Re-submit Documents</a>
        </div>
      `;

    return this.sendEmail(email, subject, this.brandWrapper(title, content));
  }

  async sendInvestmentConfirmation(email: string, name: string, investment: any) {
    const subject = 'Investment Confirmed - WiseKings Portfolio';
    const html = this.brandWrapper(
      'Investment Received',
      `
      <p>Hi ${name},</p>
      <p>Your investment for <strong>${investment.customer}</strong> (Invoice: ${investment.invoiceNo}) has been successfully recorded.</p>
      <p>Amount: <strong>₦${new Intl.NumberFormat('en-NG').format(investment.invoiceValue)}</strong><br>
      Due Date: ${new Date(investment.dueDate).toLocaleDateString()}</p>
      <p>You can track the progress of this investment and your returns on your dashboard.</p>
      `
    );
    return this.sendEmail(email, subject, html);
  }

  async sendInvestmentUpdate(email: string, name: string, investment: any) {
    const subject = 'Investment Update - Payment Received';
    const html = this.brandWrapper(
      'Payment Settled',
      `
      <p>Hi ${name},</p>
      <p>Good news! The payment for your investment (Invoice: ${investment.invoiceNo}) has been received and settled.</p>
      <p>Realized Return: <strong>₦${new Intl.NumberFormat('en-NG').format(investment.realizedReturn)}</strong></p>
      <p>The funds have been credited to your wallet. Thank you for partnering with WiseKings.</p>
      `
    );
    return this.sendEmail(email, subject, html);
  }
}
