import { escapeHtml } from '../../../../../shared/external/email/email-html.util';
import type { RetellCallReadModel } from '../../../domain/repositories/retell-call-repository.interface';
import type { RetellCallCompanyInfo } from '../../../domain/ports/outbound/company-data-lookup.port.interface';

const BRAND = '#28a745';

/** `(XXX) XXX-XXXX`, mirroring the blade phone formatter. */
function formatPhone(raw: string | null): string {
  if (!raw) return 'N/A';
  const digits = raw.replace(/[^0-9]/g, '');
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return raw;
}

function formatDuration(ms: number | null): string {
  if (ms == null || !Number.isFinite(ms)) return 'N/A';
  return `${Math.round(ms / 1000)} seconds`;
}

function formatDateTime(date: Date | null): string {
  if (!date) return 'N/A';
  return date.toISOString().replace('T', ' ').slice(0, 19);
}

function socialIcons(company: RetellCallCompanyInfo | null): string {
  if (!company) return '';
  const links: Array<[string | null, string, string]> = [
    [
      company.facebookLink,
      'https://cdn-icons-png.flaticon.com/512/124/124010.png',
      'Facebook',
    ],
    [
      company.instagramLink,
      'https://cdn-icons-png.flaticon.com/512/174/174855.png',
      'Instagram',
    ],
    [
      company.linkedinLink,
      'https://cdn-icons-png.flaticon.com/512/174/174857.png',
      'LinkedIn',
    ],
    [
      company.twitterLink,
      'https://cdn-icons-png.flaticon.com/512/733/733579.png',
      'Twitter',
    ],
  ];
  const icons = links
    .filter(([href]) => Boolean(href))
    .map(
      ([href, icon, alt]) =>
        `<a href="${escapeHtml(href ?? '')}" target="_blank" style="margin:0 8px;display:inline-block;"><img src="${icon}" width="28" alt="${alt}"></a>`,
    )
    .join('');
  return icons
    ? `<div style="margin:20px 0;text-align:center;">${icons}</div>`
    : '';
}

export interface NewCallTemplateData {
  call: RetellCallReadModel;
  company: RetellCallCompanyInfo | null;
}

/**
 * Port of `docs/emails/new-call.blade.php` — "New Call Recorded" admin alert,
 * including the "Listen to Recording" button (audio playback in the browser).
 */
export function renderNewCallEmail(data: NewCallTemplateData): {
  subject: string;
  html: string;
} {
  const { call, company } = data;
  const companyName = escapeHtml(
    company?.companyName ?? 'Aquashield Restoration',
  );
  const year = new Date().getFullYear();

  const row = (icon: string, label: string, value: string): string =>
    `<tr><td style="padding:5px 0;vertical-align:top;"><span style="color:${BRAND};">${icon}</span> <strong style="display:inline-block;width:140px;">${label}</strong></td><td style="padding:5px 0;">${value}</td></tr>`;

  const summaryRow = call.callSummary
    ? row('📝', 'Summary:', escapeHtml(call.callSummary))
    : '';

  const recordingButton = call.recordingUrl
    ? `<div style="text-align:center;margin-top:20px;">
         <a href="${escapeHtml(call.recordingUrl)}" style="display:inline-block;background-color:${BRAND};color:#ffffff;padding:10px 20px;text-decoration:none;border-radius:5px;font-weight:bold;">▶️ Listen to Recording</a>
       </div>`
    : '';

  const addressLine =
    company && company.address
      ? `<p style="font-size:10px;color:#999;">${escapeHtml(company.address)}</p>`
      : '';

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>New Call Recorded - ${companyName}</title></head>
<body style="font-family:Arial,sans-serif;margin:0;padding:20px;background-color:#f5f5f5;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;padding:30px;border-radius:10px;">
    <h2 style="color:${BRAND};text-align:center;border-bottom:2px solid ${BRAND};padding-bottom:10px;">🎉 New Call Recorded! 🔔</h2>
    <div style="background:#e6f9e9;padding:15px;border-radius:8px;margin:20px 0;text-align:center;">
      A <span style="color:${BRAND};font-weight:bold;">new call</span> has been recorded for <strong>${companyName}</strong>!
    </div>
    <h3 style="margin-top:25px;margin-bottom:15px;color:#333;">Call Details:</h3>
    <table style="width:100%;margin:0 0 20px 0;border-collapse:collapse;color:#333;line-height:1.6;">
      ${row('📞', 'From Number:', escapeHtml(formatPhone(call.fromNumber)))}
      ${row('📞', 'To Number:', escapeHtml(formatPhone(call.toNumber)))}
      ${row('⏱️', 'Duration:', escapeHtml(formatDuration(call.durationMs)))}
      ${row('📅', 'Date/Time:', escapeHtml(formatDateTime(call.startedAt)))}
      ${row('📊', 'Status:', escapeHtml(call.callStatus ?? 'N/A'))}
      ${row('😊', 'Sentiment:', escapeHtml(call.userSentiment ?? 'N/A'))}
      ${summaryRow}
    </table>
    ${recordingButton}
    <div style="padding:15px;border-radius:8px;margin-top:25px;text-align:center;color:#333;">
      <p>You can view more details about this call in the admin dashboard.</p>
    </div>
    ${socialIcons(company)}
    <div style="margin-top:25px;text-align:center;color:#666;font-size:14px;">
      <p style="margin-top:10px;font-size:12px;">© ${year} ${companyName}. All rights reserved.</p>
      ${addressLine}
    </div>
  </div>
</body>
</html>`;

  return { subject: '🎉 New Call Recorded! 🔔', html };
}
