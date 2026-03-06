import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = process.env.EMAIL_FROM || "nolink.ai <noreply@nolink.ai>";

function baseLayout(content: string) {
  return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 20px">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1)">
        <tr><td style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:32px 40px;text-align:center">
          <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;letter-spacing:-0.5px">nolink.ai</h1>
        </td></tr>
        <tr><td style="padding:40px">
          ${content}
        </td></tr>
        <tr><td style="padding:20px 40px 30px;text-align:center;border-top:1px solid #e5e7eb">
          <p style="margin:0;color:#9ca3af;font-size:12px">
            &copy; ${new Date().getFullYear()} nolink.ai &mdash; AI Workflow Marketplace
          </p>
          <p style="margin:8px 0 0;color:#9ca3af;font-size:11px">
            You can manage your email preferences in your <a href="${process.env.NEXTAUTH_URL || "https://nolink.ai"}/dashboard?tab=settings" style="color:#6366f1;text-decoration:underline">dashboard settings</a>.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function welcomeEmailHtml(name: string) {
  return baseLayout(`
    <h2 style="margin:0 0 16px;color:#111827;font-size:22px;font-weight:600">Welcome to nolink.ai${name ? `, ${name}` : ""}!</h2>
    <p style="margin:0 0 16px;color:#4b5563;font-size:15px;line-height:1.6">
      Your account is ready. You start with <strong>50 free Nolinks</strong> to explore AI workflows built by the community.
    </p>
    <p style="margin:0 0 24px;color:#4b5563;font-size:15px;line-height:1.6">
      Here's what you can do:
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px">
      <tr><td style="padding:8px 0;color:#4b5563;font-size:14px">&#x26A1; <strong>Run workflows</strong> &mdash; Browse the marketplace and run any AI workflow</td></tr>
      <tr><td style="padding:8px 0;color:#4b5563;font-size:14px">&#x1F3D7; <strong>Build workflows</strong> &mdash; Chain AI models with our visual editor</td></tr>
      <tr><td style="padding:8px 0;color:#4b5563;font-size:14px">&#x1F4B0; <strong>Earn money</strong> &mdash; Publish workflows and earn 70% commission</td></tr>
    </table>
    <table cellpadding="0" cellspacing="0" style="margin-bottom:24px">
      <tr><td style="background:#6366f1;border-radius:8px;padding:12px 28px">
        <a href="${process.env.NEXTAUTH_URL || "https://nolink.ai"}/marketplace" style="color:#ffffff;text-decoration:none;font-size:15px;font-weight:600">Explore the Marketplace</a>
      </td></tr>
    </table>
    <p style="margin:0;color:#9ca3af;font-size:13px">
      If you have questions, just reply to this email or visit our support page.
    </p>
  `);
}

function payoutEmailHtml(params: {
  name: string;
  amountNL: number;
  amountDisplay: string;
  method: string;
  currency: string;
}) {
  return baseLayout(`
    <h2 style="margin:0 0 16px;color:#111827;font-size:22px;font-weight:600">Payout Initiated</h2>
    <p style="margin:0 0 16px;color:#4b5563;font-size:15px;line-height:1.6">
      Hi${params.name ? ` ${params.name}` : ""}, your payout has been successfully initiated.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:20px;margin-bottom:24px">
      <tr><td>
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding:6px 0;color:#6b7280;font-size:13px">Amount</td>
            <td style="padding:6px 0;color:#111827;font-size:15px;font-weight:600;text-align:right">${params.amountNL} NL &rarr; ${params.amountDisplay} ${params.currency}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#6b7280;font-size:13px">Method</td>
            <td style="padding:6px 0;color:#111827;font-size:15px;font-weight:600;text-align:right">${params.method}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#6b7280;font-size:13px">Status</td>
            <td style="padding:6px 0;color:#059669;font-size:15px;font-weight:600;text-align:right">Processing</td>
          </tr>
        </table>
      </td></tr>
    </table>
    <p style="margin:0 0 16px;color:#4b5563;font-size:14px;line-height:1.6">
      Funds typically arrive in your bank account within 1&ndash;2 business days. You can track your payout status in your dashboard.
    </p>
    <table cellpadding="0" cellspacing="0">
      <tr><td style="background:#6366f1;border-radius:8px;padding:12px 28px">
        <a href="${process.env.NEXTAUTH_URL || "https://nolink.ai"}/dashboard?tab=earnings" style="color:#ffffff;text-decoration:none;font-size:15px;font-weight:600">View Payout Status</a>
      </td></tr>
    </table>
  `);
}

function marketingEmailHtml(params: {
  name: string;
  subject: string;
  body: string;
  ctaText?: string;
  ctaUrl?: string;
}) {
  return baseLayout(`
    <h2 style="margin:0 0 16px;color:#111827;font-size:22px;font-weight:600">${params.subject}</h2>
    <p style="margin:0 0 24px;color:#4b5563;font-size:15px;line-height:1.6">
      Hi${params.name ? ` ${params.name}` : ""},
    </p>
    <div style="margin:0 0 24px;color:#4b5563;font-size:15px;line-height:1.6">
      ${params.body}
    </div>
    ${params.ctaText && params.ctaUrl ? `
    <table cellpadding="0" cellspacing="0" style="margin-bottom:24px">
      <tr><td style="background:#6366f1;border-radius:8px;padding:12px 28px">
        <a href="${params.ctaUrl}" style="color:#ffffff;text-decoration:none;font-size:15px;font-weight:600">${params.ctaText}</a>
      </td></tr>
    </table>
    ` : ""}
  `);
}

export async function sendWelcomeEmail(email: string, name: string | null) {
  if (!process.env.RESEND_API_KEY) return;

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: "Welcome to nolink.ai — Your account is ready!",
      html: welcomeEmailHtml(name || ""),
    });
  } catch (error) {
    console.error("Failed to send welcome email:", error);
  }
}

export async function sendPayoutEmail(
  email: string,
  name: string | null,
  params: { amountNL: number; amountDisplay: string; method: string; currency: string }
) {
  if (!process.env.RESEND_API_KEY) return;

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: `Payout of ${params.amountDisplay} ${params.currency} initiated — nolink.ai`,
      html: payoutEmailHtml({ name: name || "", ...params }),
    });
  } catch (error) {
    console.error("Failed to send payout email:", error);
  }
}

export async function sendMarketingEmail(
  email: string,
  name: string | null,
  params: { subject: string; body: string; ctaText?: string; ctaUrl?: string }
) {
  if (!process.env.RESEND_API_KEY) return;

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: params.subject,
      html: marketingEmailHtml({ name: name || "", ...params }),
    });
  } catch (error) {
    console.error("Failed to send marketing email:", error);
  }
}
