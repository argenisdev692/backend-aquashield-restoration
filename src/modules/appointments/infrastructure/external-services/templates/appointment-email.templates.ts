import { escapeHtml } from '../../../../../shared/external/email/email-html.util';
import type { AppointmentCompanyInfo } from '../../../domain/ports/outbound/company-data-lookup.port.interface';
import type { AppointmentEmailData } from '../../../domain/ports/outbound/email.port.interface';

/**
 * Blade-faithful HTML for the appointment lifecycle emails. Ported from
 * `docs/emails/appointment-*.blade.php`, with branding sourced from the
 * CompanyData singleton instead of the hardcoded V General Contractors logo.
 *
 * All user/company-controlled values are HTML-escaped at render time
 * (OWASP #3 Injection). Dates are formatted in UTC to mirror the
 * `@db.Date` / `@db.Time` columns without timezone drift.
 */

const FALLBACK_COMPANY_NAME = 'Aquashield Restoration LLC';
const INSPECTION_DURATION_HOURS = 2;
/** Blade renders the end-of-visit hint at +3h (date math), label says 2h. */
const SCHEDULE_BLOCK_HOURS = 3;

const ES_DATE_FMT = new Intl.DateTimeFormat('es-ES', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});
const ES_TIME_FMT = new Intl.DateTimeFormat('es-ES', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: true,
  timeZone: 'UTC',
});

function ucfirst(value: string): string {
  return value.length > 0
    ? value.charAt(0).toUpperCase() + value.slice(1)
    : value;
}

function combineDateAndTime(date: Date | null, time: Date | null): Date | null {
  if (!date) return null;
  const combined = new Date(date);
  if (time) {
    combined.setUTCHours(time.getUTCHours(), time.getUTCMinutes(), 0, 0);
  }
  return combined;
}

export interface ScheduleLabel {
  /** e.g. "Lunes 5 de enero de 2026 a las 10:00 a. m." */
  full: string;
  /** End-of-visit hint, e.g. "01:00 p. m." */
  end: string;
}

/** Spanish long-form schedule label, or `null` when no date is set. */
export function formatScheduleEs(
  date: Date | null,
  time: Date | null,
): ScheduleLabel | null {
  const start = combineDateAndTime(date, time);
  if (!start) return null;

  const end = new Date(start);
  end.setUTCHours(end.getUTCHours() + SCHEDULE_BLOCK_HOURS);

  return {
    full: `${ucfirst(ES_DATE_FMT.format(start))} a las ${ES_TIME_FMT.format(start)}`,
    end: ES_TIME_FMT.format(end),
  };
}

/** US phone formatter mirroring the blade `(XXX) XXX-XXXX` logic. */
export function formatUsPhone(phone: string | null): string {
  if (!phone) return '';
  const digits = phone.replace(/[^0-9]/g, '');
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return phone;
}

function companyName(company: AppointmentCompanyInfo | null): string {
  return escapeHtml(company?.companyName ?? FALLBACK_COMPANY_NAME);
}

function renderAddressBlock(a: AppointmentEmailData): string {
  const line2 = a.address2 ? `<br>${escapeHtml(a.address2)}` : '';
  return `
    ${escapeHtml(a.address)}${line2}
    <br>${escapeHtml(a.city)}, ${escapeHtml(a.state)} ${escapeHtml(a.zipcode)}
    <br>${escapeHtml(a.country)}
  `;
}

function renderSocialIcons(company: AppointmentCompanyInfo | null): string {
  if (!company) return '';
  const icon = (link: string | null, src: string, alt: string): string =>
    link
      ? `<a href="${escapeHtml(link)}" target="_blank" style="margin:0 10px;display:inline-block;"><img src="${src}" width="30" alt="${alt}"></a>`
      : '';
  const icons = [
    icon(
      company.facebookLink,
      'https://cdn-icons-png.flaticon.com/512/124/124010.png',
      'Facebook',
    ),
    icon(
      company.instagramLink,
      'https://cdn-icons-png.flaticon.com/512/174/174855.png',
      'Instagram',
    ),
    icon(
      company.linkedinLink,
      'https://cdn-icons-png.flaticon.com/512/174/174857.png',
      'LinkedIn',
    ),
    icon(
      company.twitterLink,
      'https://cdn-icons-png.flaticon.com/512/733/733579.png',
      'Twitter',
    ),
  ].join('');
  return `<div style="margin:20px 0;text-align:center;">${icons}</div>`;
}

function renderFooter(
  company: AppointmentCompanyInfo | null,
  businessHours: string,
): string {
  const name = companyName(company);
  const year = new Date().getFullYear();
  const phone = company?.phone ?? null;
  const email = company?.email ?? null;
  const address = company?.address
    ? `<p style="font-size:10px;color:#999;">${escapeHtml(company.address)}</p>`
    : '';

  const phoneSpan = phone
    ? `<a href="tel:${phone.replace(/[^0-9]/g, '')}" style="color:#666;text-decoration:none;">${escapeHtml(formatUsPhone(phone))}</a>`
    : '';
  const sep = phone && email ? '<span style="margin:0 5px;">|</span>' : '';
  const emailLink = email
    ? `<a href="mailto:${escapeHtml(email)}" style="color:#666;text-decoration:none;">${escapeHtml(email)}</a>`
    : '';

  return `
    <div class="footer" style="margin-top:25px;text-align:center;color:#666;font-size:14px;">
      <p>${escapeHtml(businessHours)}</p>
      <p style="margin-top:10px;font-size:12px;">© ${year} ${name}. All rights reserved.</p>
      ${address}
      <div style="margin-top:5px;font-size:12px;color:#777;">
        <p style="margin:3px 0;">${phoneSpan}${sep}${emailLink}</p>
      </div>
    </div>
  `;
}

function shell(bodyHtml: string): string {
  return `
    <div style="font-family:Arial,sans-serif;background:#f5f5f5;padding:20px;">
      <div style="max-width:600px;margin:0 auto;background:#fff;padding:30px;border-radius:10px;">
        ${bodyHtml}
      </div>
    </div>
  `;
}

function statusTag(label: string, color: string): string {
  return `<span style="display:inline-block;padding:6px 12px;border-radius:20px;font-size:0.9em;font-weight:bold;background-color:${color};color:#fff;">${escapeHtml(label)}</span>`;
}

function yesNo(value: boolean): string {
  return value ? 'Yes' : 'No';
}

// ───────────────────────── Client emails (Spanish) ─────────────────────────

/** `appointment-confirmed.blade.php` — client (ES). */
export function renderAppointmentConfirmedClientHtml(
  a: AppointmentEmailData,
  company: AppointmentCompanyInfo | null,
): string {
  const name = companyName(company);
  const schedule = formatScheduleEs(a.inspectionDate, a.inspectionTime);
  const scheduleRow = schedule
    ? `<tr><td><strong>Fecha y hora:</strong></td><td>${escapeHtml(schedule.full)}<br><small>Duración: ${INSPECTION_DURATION_HOURS} horas (hasta ${escapeHtml(schedule.end)})</small></td></tr>`
    : '';
  const notesRow = a.notes
    ? `<tr><td><strong>Notas:</strong></td><td>${escapeHtml(a.notes)}</td></tr>`
    : '';

  return shell(`
    <h2 style="color:#10b981;text-align:center;border-bottom:2px solid #10b981;padding-bottom:10px;">✅ ¡Su cita ha sido confirmada!</h2>
    <div style="background:#e6f9e9;padding:20px;border-radius:8px;margin:20px 0;text-align:center;">
      <strong>Hemos confirmado su cita exitosamente.</strong>
    </div>
    <p>Hola <strong>${escapeHtml(a.firstName)} ${escapeHtml(a.lastName)}</strong>,</p>
    <p>Nos complace confirmar su cita con <strong>${name}</strong>. Hemos recibido y aprobado su solicitud, ¡estamos esperando para atenderle!</p>
    <div style="background:#f8f9fa;padding:20px;border-radius:8px;margin:20px 0;">
      <h3 style="color:#2d3748;margin-top:0;">Detalles de la Cita:</h3>
      <table style="width:100%;">
        <tr><td><strong>Estado:</strong></td><td>${statusTag('Confirmada', '#10b981')}</td></tr>
        ${scheduleRow}
        <tr><td><strong>Duración:</strong></td><td>${INSPECTION_DURATION_HOURS} horas</td></tr>
        <tr><td><strong>Dirección:</strong></td><td>${renderAddressBlock(a)}</td></tr>
        ${notesRow}
      </table>
    </div>
    <div style="background:#f8f9fa;padding:15px;border-radius:8px;margin:20px 0;">
      <h4 style="margin-top:0;color:#2d3748;">¿Qué debe hacer ahora?</h4>
      <ul style="margin:0;padding-left:20px;">
        <li>Guarde esta información en su calendario</li>
        <li>Si necesita reprogramar o cancelar, contáctenos lo antes posible</li>
        <li>Por favor, tenga a mano su <strong>póliza de cobertura de seguro</strong> el día de la inspección</li>
      </ul>
    </div>
    ${renderSocialIcons(company)}
    ${renderFooter(company, 'Horario de atención: Lunes a Viernes 9:00 AM - 5:00 PM')}
  `);
}

/** `appointment-rescheduled.blade.php` — client (ES). */
export function renderAppointmentRescheduledClientHtml(
  a: AppointmentEmailData,
  company: AppointmentCompanyInfo | null,
  previousDate: Date | null,
  previousTime: Date | null,
): string {
  const name = companyName(company);
  const next = formatScheduleEs(a.inspectionDate, a.inspectionTime);
  const prev = formatScheduleEs(previousDate, previousTime);

  return shell(`
    <h2 style="color:#8b5cf6;text-align:center;border-bottom:2px solid #8b5cf6;padding-bottom:10px;">🔄 Su cita ha sido reprogramada</h2>
    <div style="background:#f5f3ff;padding:20px;border-radius:8px;margin:20px 0;text-align:center;">
      <strong>Hemos reprogramado su cita con éxito.</strong>
    </div>
    <p>Hola <strong>${escapeHtml(a.firstName)} ${escapeHtml(a.lastName)}</strong>,</p>
    <p>Le informamos que su cita con <strong>${name}</strong> ha sido reprogramada. A continuación encontrará los nuevos detalles.</p>
    <div style="background:#f5f3ff;padding:15px;border-radius:8px;margin:15px 0;border-left:4px solid #8b5cf6;">
      <h4 style="margin-top:0;color:#2d3748;">Cambio de Horario:</h4>
      <p style="margin:5px 0;"><strong>Fecha y hora anterior:</strong><br>
        <span style="color:#ef4444;">${prev ? escapeHtml(prev.full) : 'N/A'}</span></p>
      <p style="margin:5px 0;"><strong>Nueva fecha y hora:</strong></p>
      <p style="margin:5px 0;color:#10b981;">${next ? escapeHtml(next.full) : 'N/A'}${next ? `<br><small>Duración: ${INSPECTION_DURATION_HOURS} horas (hasta ${escapeHtml(next.end)})</small>` : ''}</p>
    </div>
    <div style="background:#f8f9fa;padding:20px;border-radius:8px;margin:20px 0;">
      <h3 style="color:#2d3748;margin-top:0;">Detalles de la Cita:</h3>
      <table style="width:100%;">
        <tr><td><strong>Estado:</strong></td><td>${statusTag('Reprogramada', '#8b5cf6')}</td></tr>
        <tr><td><strong>Duración:</strong></td><td>${INSPECTION_DURATION_HOURS} horas</td></tr>
        <tr><td><strong>Dirección:</strong></td><td>${renderAddressBlock(a)}</td></tr>
      </table>
    </div>
    <div style="background:#f8f9fa;padding:15px;border-radius:8px;margin:20px 0;">
      <h4 style="margin-top:0;color:#2d3748;">Importante:</h4>
      <ul style="margin:0;padding-left:20px;">
        <li>Por favor, confirme que la nueva fecha y hora le convienen</li>
        <li>Si necesita hacer algún ajuste adicional, contáctenos lo antes posible</li>
        <li>Tenga a mano su <strong>póliza de cobertura de seguro</strong> el día de la inspección</li>
      </ul>
    </div>
    ${renderSocialIcons(company)}
    ${renderFooter(company, 'Horario de atención: Lunes a Viernes 9:00 AM - 5:00 PM')}
  `);
}

/** `appointment-cancelled.blade.php` — client (ES). */
export function renderAppointmentCancelledClientHtml(
  a: AppointmentEmailData,
  company: AppointmentCompanyInfo | null,
): string {
  const name = companyName(company);
  const schedule = formatScheduleEs(a.inspectionDate, a.inspectionTime);
  const scheduleRow = schedule
    ? `<tr><td><strong>Fecha y hora:</strong></td><td>${escapeHtml(schedule.full)}<br><small>Duración: ${INSPECTION_DURATION_HOURS} horas (hasta ${escapeHtml(schedule.end)})</small></td></tr>`
    : '';

  return shell(`
    <h2 style="color:#ef4444;text-align:center;border-bottom:2px solid #ef4444;padding-bottom:10px;">❌ Su cita ha sido cancelada</h2>
    <div style="background:#fee2e2;padding:20px;border-radius:8px;margin:20px 0;text-align:center;">
      <strong>Lamentamos informarle que su cita ha sido cancelada.</strong>
    </div>
    <p>Hola <strong>${escapeHtml(a.firstName)} ${escapeHtml(a.lastName)}</strong>,</p>
    <p>Le informamos que su cita con <strong>${name}</strong> ha sido cancelada. Si desea reprogramar, puede hacerlo a través de los siguientes medios.</p>
    <div style="background:#f8f9fa;padding:20px;border-radius:8px;margin:20px 0;">
      <h3 style="color:#2d3748;margin-top:0;">Detalles de la Cita Cancelada:</h3>
      <table style="width:100%;">
        <tr><td><strong>Estado:</strong></td><td>${statusTag('Cancelada', '#ef4444')}</td></tr>
        ${scheduleRow}
        <tr><td><strong>Dirección:</strong></td><td>${renderAddressBlock(a)}</td></tr>
      </table>
    </div>
    <div style="background:#f8f9fa;padding:15px;border-radius:8px;margin:20px 0;">
      <h4 style="margin-top:0;color:#2d3748;">¿Desea reprogramar su cita?</h4>
      <p style="margin:0;">Puede agendar una nueva cita llamándonos o escribiéndonos por correo electrónico.</p>
    </div>
    ${renderSocialIcons(company)}
    ${renderFooter(company, 'Horario de atención: Lunes a Viernes 9:00 AM - 5:00 PM')}
  `);
}

// ───────────────────────── Internal emails (English) ────────────────────────

function renderInternalClientTable(a: AppointmentEmailData): string {
  const schedule = formatScheduleEs(a.inspectionDate, a.inspectionTime);
  const scheduleRow = schedule
    ? `<tr><td><strong>🕒 Date and Time:</strong></td><td>${escapeHtml(schedule.full)}<br><small>Duration: ${INSPECTION_DURATION_HOURS} hours (until ${escapeHtml(schedule.end)})</small></td></tr>`
    : '';
  const phone = formatUsPhone(a.phone);
  const emailLink = a.email
    ? `<a href="mailto:${escapeHtml(a.email)}">${escapeHtml(a.email)}</a>`
    : 'N/A';
  const messageRow = a.message
    ? `<tr><td><strong>💬 Message:</strong></td><td>${escapeHtml(a.message)}</td></tr>`
    : '';
  const leadSourceRow = `<tr><td><strong>🔍 Lead Source:</strong></td><td>${a.leadSource ? escapeHtml(a.leadSource) : 'N/A'}</td></tr>`;

  return `
    <tr><td><strong>👤 Client Name:</strong></td><td>${escapeHtml(a.firstName)} ${escapeHtml(a.lastName)}</td></tr>
    <tr><td><strong>📧 Email:</strong></td><td>${emailLink}</td></tr>
    <tr><td><strong>📞 Phone:</strong></td><td>${escapeHtml(phone)}</td></tr>
    <tr><td><strong>📍 Address:</strong></td><td>${renderAddressBlock(a)}</td></tr>
    ${scheduleRow}
    <tr><td><strong>🛡️ Has Insurance:</strong></td><td>${yesNo(a.insuranceProperty)}</td></tr>
    <tr><td><strong>💬 SMS Consent:</strong></td><td>${yesNo(a.smsConsent)}</td></tr>
    ${messageRow}
    ${leadSourceRow}
  `;
}

/** `appointment-confirmed-internal.blade.php` — admins (EN). */
export function renderAppointmentScheduledInternalHtml(
  a: AppointmentEmailData,
  company: AppointmentCompanyInfo | null,
): string {
  return shell(`
    <h2 style="color:#1e90ff;text-align:center;border-bottom:2px solid #1e90ff;padding-bottom:10px;">📅 New Appointment Confirmed</h2>
    <div style="background:#e6f4ff;padding:20px;border-radius:8px;margin:20px 0;text-align:center;">
      <strong>A new appointment has been confirmed in the system.</strong>
    </div>
    <div style="background:#f8f9fa;padding:20px;border-radius:8px;margin:20px 0;">
      <h3 style="color:#2d3748;margin-top:0;">Appointment Details:</h3>
      <table style="width:100%;">
        <tr><td><strong>Status:</strong></td><td>${statusTag('Confirmed', '#10b981')}</td></tr>
        ${renderInternalClientTable(a)}
      </table>
    </div>
    <div style="background:#f8f9fa;padding:15px;border-radius:8px;margin:20px 0;">
      <h4 style="margin-top:0;color:#2d3748;">Required Actions:</h4>
      <ul style="margin:0;padding-left:20px;">
        <li>Verify team availability for the scheduled date and time</li>
        <li>Prepare necessary documentation for the inspection</li>
        <li>Confirm route and travel time to the location</li>
      </ul>
    </div>
    ${renderSocialIcons(company)}
    ${renderFooter(company, 'Business Hours: Monday to Friday 9:00 AM - 5:00 PM')}
  `);
}

/** `appointment-rescheduled-internal.blade.php` — admins (EN). */
export function renderAppointmentRescheduledInternalHtml(
  a: AppointmentEmailData,
  company: AppointmentCompanyInfo | null,
  previousDate: Date | null,
  previousTime: Date | null,
): string {
  const name = companyName(company);
  const next = formatScheduleEs(a.inspectionDate, a.inspectionTime);
  const prev = formatScheduleEs(previousDate, previousTime);

  return shell(`
    <h2 style="color:#8b5cf6;text-align:center;border-bottom:2px solid #8b5cf6;padding-bottom:10px;">🔄 Appointment Rescheduled Alert! 🔔</h2>
    <div style="background:#f3e8ff;padding:20px;border-radius:8px;margin:20px 0;text-align:center;">
      An appointment has been <strong style="color:#8b5cf6;">Rescheduled</strong> for <strong>${name}</strong>!
    </div>
    <h3 style="color:#333;">Client Details:</h3>
    <table style="width:100%;margin:0 0 20px 0;">
      <tr><td><strong>👤 Client Name:</strong></td><td>${escapeHtml(a.firstName)} ${escapeHtml(a.lastName)}</td></tr>
      <tr><td><strong>📧 Email:</strong></td><td>${a.email ? escapeHtml(a.email) : 'N/A'}</td></tr>
      <tr><td><strong>📞 Phone:</strong></td><td>${escapeHtml(formatUsPhone(a.phone))}</td></tr>
      <tr><td><strong>📍 Address:</strong></td><td>${renderAddressBlock(a)}</td></tr>
    </table>
    <div style="background:#f3e8ff;padding:15px;border-radius:8px;margin:15px 0;">
      <h3 style="margin-top:0;color:#333;">Schedule Change:</h3>
      <table style="width:100%;">
        <tr><td><strong>Previous Time:</strong></td><td style="color:#ef4444;">${prev ? escapeHtml(prev.full) : 'N/A'}</td></tr>
        <tr><td><strong>🕒 New Appointment Time:</strong></td><td style="color:#10b981;">${next ? escapeHtml(next.full) : 'N/A'}${next ? `<br><small>Duration: ${INSPECTION_DURATION_HOURS} hours (until ${escapeHtml(next.end)})</small>` : ''}</td></tr>
      </table>
    </div>
    <div style="padding:15px;text-align:center;">
      <p>Please update your schedule accordingly. The client has been notified of this change.</p>
    </div>
    ${renderSocialIcons(company)}
    ${renderFooter(company, 'Business Hours: Monday to Friday 9:00 AM - 5:00 PM')}
  `);
}

/** `appointment-cancelled-internal.blade.php` — admins (EN). */
export function renderAppointmentCancelledInternalHtml(
  a: AppointmentEmailData,
  company: AppointmentCompanyInfo | null,
): string {
  const name = companyName(company);

  return shell(`
    <h2 style="color:#ef4444;text-align:center;border-bottom:2px solid #ef4444;padding-bottom:10px;">❌ Appointment Cancelled Alert! 🔔</h2>
    <div style="background:#fee2e2;padding:20px;border-radius:8px;margin:20px 0;text-align:center;">
      An appointment has been <strong style="color:#ef4444;">Cancelled</strong> for <strong>${name}</strong>!
    </div>
    <h3 style="color:#333;">Cancelled Appointment Details:</h3>
    <table style="width:100%;margin:0 0 20px 0;">
      ${renderInternalClientTable(a)}
    </table>
    <div style="padding:15px;text-align:center;">
      <p>This appointment has been cancelled. The time slot is now available for other clients.</p>
    </div>
    ${renderSocialIcons(company)}
    ${renderFooter(company, 'Business Hours: Monday to Friday 9:00 AM - 5:00 PM')}
  `);
}
