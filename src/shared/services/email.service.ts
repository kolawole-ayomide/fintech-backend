import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const fromEmail = process.env.EMAIL_FROM || 'no-reply@fintech.com';

export class EmailService {
  public static async sendAuthOtp(toEmail: string, otpCode: string): Promise<void> {
    await resend.emails.send({
      from: fromEmail,
      to: toEmail,
      subject: 'Your Authentication Verification Code',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
          <h2>Authentication Verification</h2>
          <p>Your one-time verification code is below. It expires in 10 minutes.</p>
          <h1 style="background: #f4f4f4; padding: 10px; width: fit-content; letter-spacing: 4px;">${otpCode}</h1>
          <p>If you didn't request this, please ignore this email.</p>
        </div>
      `,
    });
  }

  public static async sendTransactionNotification(
    toEmail: string, 
    type: 'CREDIT' | 'DEBIT', 
    amount: number, 
    reference: string
  ): Promise<void> {
    const isCredit = type === 'CREDIT';
    const actionText = isCredit ? 'received' : 'sent';
    const color = isCredit ? '#22c55e' : '#ef4444';

    await resend.emails.send({
      from: fromEmail,
      to: toEmail,
      subject: `Transaction Alert: Funds ${actionText}`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
          <h2>Transaction Notification</h2>
          <p>You have successfully ${actionText} <strong>₦${amount.toLocaleString()}</strong>.</p>
          <p><strong>Reference:</strong> ${reference}</p>
          <p><strong>Status:</strong> <span style="color: ${color}; font-weight: bold;">SUCCESSFUL</span></p>
        </div>
      `,
    });
  }


  public static async sendNewLoginAlert(toEmail: string, ipAddress?: string, userAgent?: string): Promise<void> {
    await resend.emails.send({
      from: fromEmail,
      to: toEmail,
      subject: 'Security Alert: New Login to Your Account',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
          <h2 style="color: #f59e0b;">New Login Detected</h2>
          <p>We noticed a successful login to your account from a new session or device.</p>
          <p><strong>IP Address:</strong> ${ipAddress || 'Unknown'}</p>
          <p><strong>Device/Browser:</strong> ${userAgent || 'Standard Web Client'}</p>
          <p style="margin-top: 20px; font-size: 12px; color: #666;">If this was you, you can safely ignore this email. If you did not log in, please secure your account immediately.</p>
        </div>
      `,
    });
  }

  public static async sendNewDeviceAlert(toEmail: string, deviceDetails: string): Promise<void> {
    await resend.emails.send({
      from: fromEmail,
      to: toEmail,
      subject: 'Security Alert: New Device Recognized',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
          <h2 style="color: #ef4444;">New Device Connected</h2>
          <p>Your account was accessed from a brand-new device:</p>
          <blockquote style="background: #f4f4f4; padding: 10px; border-left: 4px solid #ef4444;">
            ${deviceDetails}
          </blockquote>
          <p>If you authorized this device, no further action is needed.</p>
        </div>
      `,
    });
  }


  public static async sendLoanNotice(toEmail: string, amount: number, reference: string, status: string): Promise<void> {
    await resend.emails.send({
      from: fromEmail,
      to: toEmail,
      subject: `Loan Facility Update: ${status}`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
          <h2>Loan Application & Disbursement Notice</h2>
          <p>Your credit facility request for <strong>₦${amount.toLocaleString()}</strong> has been processed.</p>
          <p><strong>Reference:</strong> ${reference}</p>
          <p><strong>Status:</strong> <span style="color: #22c55e; font-weight: bold;">${status}</span></p>
          <p>Funds have been successfully credited to your customer wallet.</p>
        </div>
      `,
    });
  }

  public static async sendGsiMandateNotice(toEmail: string, bvnMasked: string): Promise<void> {
    await resend.emails.send({
      from: fromEmail,
      to: toEmail,
      subject: 'Compliance Notice: GSI Mandate Successfully Registered',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
          <h2>Global Standing Instruction (GSI) Active</h2>
          <p>A CBN GSI mandate has been successfully linked to your profile using BVN ending in <strong>${bvnMasked}</strong>.</p>
          <p>This mandate authorizes automated default recovery across linked banking accounts if credit facilities become overdue.</p>
        </div>
      `,
    });
  }


  public static async sendKycStatusNotice(toEmail: string, tierLevel: string, status: 'VERIFIED' | 'REJECTED', reason?: string): Promise<void> {
    const isSuccess = status === 'VERIFIED';
    const subject = `KYC Compliance Update: ${tierLevel} ${isSuccess ? 'Approved' : 'Rejected'}`;
    
    await resend.emails.send({
      from: fromEmail,
      to: toEmail,
      subject,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
          <h2 style="color: ${isSuccess ? '#22c55e' : '#ef4444'};">KYC Verification ${isSuccess ? 'Successful' : 'Failed'}</h2>
          <p>Your submission for <strong>${tierLevel}</strong> has been reviewed.</p>
          <p><strong>Status:</strong> <span style="font-weight: bold; color: ${isSuccess ? '#22c55e' : '#ef4444'};">${status}</span></p>
          ${reason ? `<p><strong>Reason for failure:</strong> ${reason}</p>` : ''}
          <p style="margin-top: 20px; font-size: 12px; color: #666;">If you have any questions, please contact support.</p>
        </div>
      `,
    });
  }


  public static async sendMonthlyStatement(toEmail: string, month: string, year: number, summary: { totalInflows: number; totalOutflows: number; closingBalance: number; currency: string }): Promise<void> {
    await resend.emails.send({
      from: fromEmail,
      to: toEmail,
      subject: `Your Monthly Account Statement - ${month} ${year}`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 600px; margin: auto; border: 1px solid #e5e7eb; border-radius: 8px;">
          <h2 style="color: #2563eb; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;">Monthly Financial Statement</h2>
          <p>Here is your account activity summary for <strong>${month} ${year}</strong>:</p>
          <div style="background: #f9fafb; padding: 15px; border-radius: 6px; margin: 20px 0;">
            <p style="margin: 8px 0;"><strong>Total Inflows (Credits):</strong> <span style="color: #16a34a; font-weight: bold;">${summary.currency} ${summary.totalInflows.toLocaleString()}</span></p>
            <p style="margin: 8px 0;"><strong>Total Outflows (Debits):</strong> <span style="color: #dc2626; font-weight: bold;">${summary.currency} ${summary.totalOutflows.toLocaleString()}</span></p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 12px 0;" />
            <p style="margin: 8px 0; font-size: 16px;"><strong>Closing Balance:</strong> <span style="color: #2563eb; font-weight: bold;">${summary.currency} ${summary.closingBalance.toLocaleString()}</span></p>
          </div>
          <p style="font-size: 13px; color: #666;">Log in to your dashboard anytime to download your full ledger audit trail and transaction history.</p>
        </div>
      `,
    });
  }
}

