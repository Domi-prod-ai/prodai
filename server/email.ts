import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM_EMAIL = "ProdAI <onboarding@resend.dev>";
const APP_URL = process.env.APP_URL || "https://www.perplexity.ai/computer/a/prodai-ai-vezerelt-termelester-6T2M_WGEQDiwHD9y3LnoJQ";
// Az egyetlen email cim amire Resend teszt modban kuldhet (domain nelkul)
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "polyakdom04@gmail.com";

// Üdvözlő email regisztráció után
export async function sendWelcomeEmail(to: string, name: string, companyName: string): Promise<void> {
  if (!resend) {
    console.log(`[EMAIL szimulált] Üdvözlő email -> ${to}`);
    return;
  }
  // Resend teszt modban csak ADMIN_EMAIL-re tud kuldeni domain nelkul
  // Ha verifikalt domain van, a to email-re is kuldhetunk
  const domainVerified = process.env.RESEND_DOMAIN_VERIFIED === "true";
  const recipient = domainVerified ? to : ADMIN_EMAIL;
  const subjectPrefix = domainVerified ? "" : `[ÚJ REGISZTRÁCIÓ: ${to}] `;
  const result = await resend.emails.send({
    from: FROM_EMAIL,
    to: recipient,
    subject: `${subjectPrefix}Üdvözlünk a ProdAI-ban, ${name}!`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        ${!domainVerified ? `<div style="background:#fef3c7;border:1px solid #f59e0b;padding:12px 20px;font-size:13px;color:#92400e;">
          <strong>Admin értesítő:</strong> Új regisztráció érkezett a ProdAI rendszerbe!<br>
          Email: <strong>${to}</strong> | Cég: <strong>${companyName}</strong>
        </div>` : ""}
        <div style="background: hsl(206,70%,40%); padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 28px;">ProdAI</h1>
          <p style="color: #b3d4f0; margin: 8px 0 0;">AI vezérelt termelés tervező</p>
        </div>
        <div style="padding: 30px; background: #f8fafc;">
          <h2 style="color: #1e293b;">Üdvözlünk, ${name}!</h2>
          <p style="color: #475569;">A <strong>${companyName}</strong> fiókja sikeresen létrehozva a ProdAI rendszerben.</p>
          <p style="color: #475569;">Most már bejelentkezhetsz és elkezdheted a termelés tervezést:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${APP_URL}" style="background: hsl(206,70%,40%); color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold;">
              Belépés a ProdAI-ba
            </a>
          </div>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;">
          <p style="color: #94a3b8; font-size: 12px; text-align: center;">
            ProdAI · Polyák Dominik · Széchenyi István Egyetem 2026
          </p>
        </div>
      </div>
    `,
  });
  if ((result as any).error) {
    console.error("[EMAIL HIBA] Welcome email:", (result as any).error);
  } else {
    console.log(`[EMAIL OK] Welcome email elküldve: ${recipient} (eredeti: ${to})`);
  }
}

// Határidő figyelmeztetés email
export async function sendDeadlineWarningEmail(to: string, name: string, orders: Array<{orderNumber: string; dueDate: string; priority: string}>): Promise<void> {
  if (!resend) {
    console.log(`[EMAIL szimulált] Határidő figyelmeztetés -> ${to}, ${orders.length} rendelés`);
    return;
  }
  const orderRows = orders.map(o =>
    `<tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;">${o.orderNumber}</td>
     <td style="padding:8px;border-bottom:1px solid #e2e8f0;">${o.dueDate}</td>
     <td style="padding:8px;border-bottom:1px solid #e2e8f0;color:${o.priority === 'urgent' ? '#dc2626' : '#d97706'}">${o.priority}</td></tr>`
  ).join("");

  await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject: `⚠️ ${orders.length} rendelés határideje közeleg – ProdAI`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: hsl(206,70%,40%); padding: 20px 30px;">
          <h2 style="color: white; margin: 0;">ProdAI – Határidő figyelmeztetés</h2>
        </div>
        <div style="padding: 24px; background: #f8fafc;">
          <p>Kedves <strong>${name}</strong>!</p>
          <p>A következő rendelések határideje <strong>48 órán belül</strong> esedékes:</p>
          <table style="width:100%;border-collapse:collapse;background:white;border-radius:8px;overflow:hidden;">
            <thead><tr style="background:#f1f5f9;">
              <th style="padding:10px;text-align:left;">Rendelésszám</th>
              <th style="padding:10px;text-align:left;">Határidő</th>
              <th style="padding:10px;text-align:left;">Prioritás</th>
            </tr></thead>
            <tbody>${orderRows}</tbody>
          </table>
          <div style="text-align:center;margin-top:24px;">
            <a href="${APP_URL}" style="background:hsl(206,70%,40%);color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">
              Megnyitás a ProdAI-ban
            </a>
          </div>
        </div>
      </div>
    `,
  });
}

// Meghívó email (kollégának)
export async function sendInviteEmail(to: string, inviterName: string, companyName: string, token: string): Promise<void> {
  const inviteUrl = `${APP_URL}#/invite/${token}`;
  if (!resend) {
    console.log(`[EMAIL szimulált] Meghívó -> ${to}, token: ${token}`);
    return;
  }
  await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject: `${inviterName} meghívott a ${companyName} ProdAI fiókjába`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: hsl(206,70%,40%); padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0;">ProdAI</h1>
        </div>
        <div style="padding: 30px; background: #f8fafc;">
          <h2 style="color: #1e293b;">Meghívást kaptál!</h2>
          <p style="color: #475569;"><strong>${inviterName}</strong> meghívott a <strong>${companyName}</strong> ProdAI munkaterületre.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${inviteUrl}" style="background: hsl(206,70%,40%); color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold;">
              Meghívó elfogadása
            </a>
          </div>
          <p style="color: #94a3b8; font-size: 12px;">Ez a link 48 óráig érvényes.</p>
        </div>
      </div>
    `,
  });
}
