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

  async sendEmail(to: string, subject: string, html: string, templateName?: string, variables?: any, text?: string) {
    let finalSubject = subject;
    let finalHtml = html;
    let finalText = text;

    if (templateName) {
      const template = await this.templateService.findByName(templateName);
      if (template) {
        finalSubject = this.replaceVariables(template.subject, variables);
        finalHtml = this.replaceVariables(template.content, variables);
        finalText = this.stripHtml(finalHtml);
      }
    }

    try {
      const { data, error } = await this.resend.emails.send({
        from: this.defaultFrom,
        to,
        subject: finalSubject,
        html: finalHtml,
        text: finalText,
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

  private stripHtml(html: string): string {
    if (!html) return '';
    return html.replace(/<[^>]*>?/gm, '').trim();
  }

  public brandWrapper(title: string, content: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;800&display=swap');
          
          body { margin: 0; padding: 0; background-color: #fff9f0; font-family: 'Outfit', 'Inter', -apple-system, sans-serif; }
          .email-wrapper { background-color: #fff9f0; padding: 40px 15px; }
          .container { 
            background-color: #ffffff; 
            max-width: 580px; 
            margin: 0 auto; 
            border-radius: 40px; 
            padding: 48px 40px; 
            box-shadow: 0 20px 50px rgba(251, 191, 36, 0.08); 
            border: 1px solid #fef3c7;
            background-image: radial-gradient(at 0% 0%, rgba(251, 191, 36, 0.03) 0px, transparent 50%),
                              radial-gradient(at 100% 100%, rgba(3, 57, 88, 0.02) 0px, transparent 50%);
          }
          .logo { text-align: center; margin-bottom: 40px; }
          .logo img { height: 48px; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.05)); }
          
          .header { text-align: center; margin-bottom: 32px; }
          .title-pill {
            display: inline-block;
            padding: 8px 16px;
            background: #fffbeb;
            border-radius: 100px;
            margin-bottom: 16px;
          }
          .title-pill span {
            color: #d97706;
            font-size: 10px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.1em;
          }
          .title { color: #033958; font-size: 28px; font-weight: 800; margin: 0; letter-spacing: -0.03em; line-height: 1.2; }
          
          .content { font-size: 16px; line-height: 1.7; color: #475569; margin-bottom: 40px; }
          .content p { margin-bottom: 20px; }
          .content strong { color: #1e293b; font-weight: 600; }
          
          .action-area { text-align: center; margin: 40px 0; }
          .btn { 
            display: inline-block; 
            padding: 16px 36px; 
            background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
            color: #ffffff !important; 
            text-decoration: none; 
            border-radius: 20px; 
            font-weight: 700; 
            font-size: 15px; 
            box-shadow: 0 12px 24px -6px rgba(245, 158, 11, 0.4);
            border: 1px solid rgba(255,255,255,0.2);
          }
          
          .otp-card { 
            background: linear-gradient(to right, #f8fafc, #f1f5f9); 
            border-radius: 24px; 
            padding: 32px; 
            text-align: center; 
            margin: 32px 0; 
            border: 2px dashed #e2e8f0; 
          }
          .otp-label { font-size: 12px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.15em; margin-bottom: 12px; display: block; }
          .otp-code { font-size: 42px; font-weight: 800; letter-spacing: 12px; color: #033958; font-family: 'Outfit', monospace; text-shadow: 0 2px 4px rgba(0,0,0,0.05); }
          
          .footer { 
            text-align: center; 
            padding: 32px 0 0;
            border-top: 1px solid #f1f5f9;
            margin-top: 40px;
          }
          .footer-text { font-size: 13px; color: #94a3b8; line-height: 1.6; }
          .footer-brand { font-weight: 700; color: #033958; margin-bottom: 8px; font-size: 14px; }
          
          .social-links { margin: 20px 0; }
          .social-links a { margin: 0 8px; color: #cbd5e1; text-decoration: none; }
        </style>
      </head>
      <body>
        <div class="email-wrapper">
          <div class="container">
            <div class="logo">
              <img src="https://www.wisekings.ng/_nuxt/logo.BUsl8DaR.jpg" alt="WiseKings">
            </div>
            <div class="header">
              <div class="title-pill"><span>System Notification</span></div>
              <h1 class="title">${title}</h1>
            </div>
            <div class="content">
              ${content}
            </div>
            <div class="footer">
              <div class="footer-brand">WiseKings Ventures</div>
              <div class="footer-text">
                &copy; ${new Date().getFullYear()} • Premium Experience. Trusted Quality.<br>
                Lagos, Nigeria.
              </div>
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
    const templateName = 'PARTNER_APP_RECEIVED';
    const variables = { name };
    const fallbackSubject = 'Application Received - WiseKings Partnership';
    const fallbackHtml = `
      <p>Hi ${name},</p>
      <p>Thank you for applying to be a WiseKings Partner. We have received your application and our team is currently reviewing it carefully.</p>
      <p>You will receive a follow-up email once our verification team has completed their review.</p>
    `;

    const template = await this.templateService.findByName(templateName);
    if (template) {
      return this.sendEmail(email, template.subject, template.content, templateName, variables);
    }

    return this.sendEmail(email, fallbackSubject, this.brandWrapper('Application Received', fallbackHtml));
  }

  async sendPartnerApplicationApproved(email: string, name: string) {
    const templateName = 'PARTNER_APP_APPROVED';
    const loginUrl = `${this.configService.get('PARTNER_URL')}/login`;
    const variables = { name, loginUrl };
    const fallbackSubject = 'Application Approved - Action Required';
    const fallbackHtml = `
      <p>Hi ${name},</p>
      <p>Your application to become a WiseKings Partner has been <strong>approved</strong>.</p>
      <p>To finalize your onboarding and start financing invoices, please log in to your dashboard to review and digitally sign the agreement.</p>
      <div class="action-area">
        <a href="${loginUrl}" class="btn">Log In to Sign Agreement</a>
      </div>
    `;

    const template = await this.templateService.findByName(templateName);
    if (template) {
      return this.sendEmail(email, template.subject, template.content, templateName, variables);
    }

    return this.sendEmail(email, fallbackSubject, this.brandWrapper('Congratulations!', fallbackHtml));
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
    const templateName = 'WELCOME_OTP';
    const variables = { name, otpCode };
    const fallbackSubject = 'Your Verification Code';
    const fallbackHtml = `
      <p>Hi ${name || 'there'},</p>
      <p>Please use the following security code to verify your identity. This code is confidential and valid for 15 minutes.</p>
      <div class="otp-card">
        <span class="otp-label">Security Code</span>
        <span class="otp-code">${otpCode}</span>
      </div>
      <p style="font-size: 13px; color: #94a3b8; text-align: center;">If you did not request this code, please secure your account immediately or contact support.</p>
    `;

    const template = await this.templateService.findByName(templateName);
    if (template) {
      return this.sendEmail(email, template.subject, template.content, templateName, variables);
    }

    return this.sendEmail(email, fallbackSubject, this.brandWrapper('Verify Your Email', fallbackHtml));
  }

  async sendAdminInvitationEmail(email: string, name: string, otpCode: string) {
    const templateName = 'ADMIN_INVITATION';
    const adminUrl = this.configService.get('ADMIN_URL') || 'https://wisekings-backend-hq.onrender.com'; // Metadata says 3000
    const invitationLink = `${adminUrl}/join?email=${encodeURIComponent(email)}`;
    const variables = { name, otpCode, invitationLink };
    const fallbackSubject = 'Invitation to join WiseKings Admin';
    const fallbackHtml = `
      <p>Hi ${name},</p>
      <p>You have been invited to join the WiseKings Administrative team. Please use the following temporary verification code to complete your registration and set your secure password.</p>
      <div class="otp-card">
        <span class="otp-label">Activation Code</span>
        <span class="otp-code">${otpCode}</span>
      </div>
      <p>This invitation is valid for 24 hours.</p>
      <div class="action-area">
        <a href="${invitationLink}" class="btn">Complete Activation</a>
      </div>
    `;

    const template = await this.templateService.findByName(templateName);
    if (template) {
      return this.sendEmail(email, template.subject, template.content, templateName, variables);
    }

    return this.sendEmail(email, fallbackSubject, this.brandWrapper('Join the Team', fallbackHtml));
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
    const templateName = isApproved ? 'KYC_APPROVED' : 'KYC_REJECTED';
    const reasonText = reason || 'Documents provided were unclear or invalid.';
    const dashboardUrl = this.configService.get('USER_URL') || '#';
    const variables = { name, reason: reasonText, dashboardUrl };

    const template = await this.templateService.findByName(templateName);
    if (template) {
      return this.sendEmail(email, template.subject, template.content, templateName, variables);
    }

    const title = isApproved ? 'KYC Verified' : 'KYC Action Required';
    const subject = `KYC Verification ${isApproved ? 'Successful' : 'Rejected'}`;

    const fallbackHtml = isApproved
      ? `
        <p>Hi ${name},</p>
        <p>Great news! Your KYC (Know Your Customer) documents have been verified successfully. Your account is now fully active with increased trust limits.</p>
        <div class="action-area">
          <a href="${dashboardUrl}" class="btn">Explore Dashboard</a>
        </div>
      `
      : `
        <p>Hi ${name},</p>
        <p>Unfortunately, your KYC verification was not successful for the following reason:</p>
        <div style="background-color: #fee2e2; border-left: 4px solid #ef4444; padding: 16px; margin: 24px 0; color: #991b1b; font-weight: 500; border-radius: 12px;">
          ${reasonText}
        </div>
        <p>Please log in to your dashboard to re-submit valid documents.</p>
        <div class="action-area">
          <a href="${dashboardUrl}/kyc" class="btn">Re-submit Documents</a>
        </div>
      `;

    return this.sendEmail(email, subject, this.brandWrapper(title, fallbackHtml));
  }

  async sendInvestmentConfirmation(email: string, name: string, investment: any) {
    const templateName = 'INVESTMENT_CONFIRMED';
    const amount = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(investment.invoiceValue);
    const dueDate = new Date(investment.dueDate).toLocaleDateString();
    const variables = { name, customer: investment.customer, invoiceNo: investment.invoiceNo, amount, dueDate };

    const template = await this.templateService.findByName(templateName);
    if (template) {
      return this.sendEmail(email, template.subject, template.content, templateName, variables);
    }

    const fallbackSubject = 'Investment Confirmed - WiseKings Portfolio';
    const fallbackHtml = `
      <p>Hi ${name},</p>
      <p>Your investment for <strong>${investment.customer}</strong> (Invoice: ${investment.invoiceNo}) has been successfully recorded.</p>
      <p>Amount: <strong>${amount}</strong><br>
      Due Date: ${dueDate}</p>
      <p>You can track the progress of this investment and your returns on your dashboard.</p>
    `;
    return this.sendEmail(email, fallbackSubject, this.brandWrapper('Investment Received', fallbackHtml));
  }

  async sendInvestmentUpdate(email: string, name: string, investment: any) {
    const templateName = 'INVESTMENT_SETTLED';
    const returnAmount = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(investment.realizedReturn);
    const variables = { name, invoiceNo: investment.invoiceNo, returnAmount };

    const template = await this.templateService.findByName(templateName);
    if (template) {
      return this.sendEmail(email, template.subject, template.content, templateName, variables);
    }

    const fallbackSubject = 'Investment Update - Payment Received';
    const fallbackHtml = `
      <p>Hi ${name},</p>
      <p>Good news! The payment for your investment (Invoice: ${investment.invoiceNo}) has been received and settled.</p>
      <p>Realized Return: <strong>${returnAmount}</strong></p>
      <p>The funds have been credited to your wallet. Thank you for partnering with WiseKings.</p>
    `;
    return this.sendEmail(email, fallbackSubject, this.brandWrapper('Payment Settled', fallbackHtml));
  }
}
