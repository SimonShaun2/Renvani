/** Shared Renvani-branded email layout (plain HTML + plain-text fallback). Values copied from apps/web tokens. */

export const RENVANI_EMAIL_BRAND = {
  name: "Renvani",
  tagline: "Grow your shop. Renvani runs the rest.",
  siteUrl: "https://getrenvani.com",
  termsUrl: "https://getrenvani.com/terms",
  privacyUrl: "https://getrenvani.com/privacy",
  legalLine: "Renvani is a brand of TrayLoop Technologies LLC.",
  /** apps/web/src/styles/tokens.css */
  colors: {
    primary: "#102163",
    accent: "#257afa",
    accentLight: "#deebff",
    text: "#131521",
    muted: "#7f8897",
    border: "#edeff2",
    background: "#f6f7f9"
  },
  /** apps/web/app/layout.tsx uses Inter (next/font); email clients fall back to system sans. */
  fontStack: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
} as const;

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export type RenvaniLayoutInput = {
  bodyHtml: string;
  bodyText: string;
  preheader?: string;
  /** Absolute logo image URL; when empty the BrandMark is rendered as an HTML text mark ("R" tile + wordmark). */
  logoUrl?: string;
};

function logoHtml(logoUrl: string | undefined): string {
  const b = RENVANI_EMAIL_BRAND;
  if (logoUrl && /^https:\/\//.test(logoUrl)) {
    return `<img src="${escapeHtml(logoUrl)}" width="140" alt="Renvani" style="display:block;border:0;height:auto;" />`;
  }
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td width="40" height="40" align="center" valign="middle" style="width:40px;height:40px;background:${b.colors.accent};border-radius:12px;color:#ffffff;font-family:${b.fontStack};font-size:18px;font-weight:600;">R</td>
<td style="padding-left:12px;font-family:${b.fontStack};"><div style="font-size:18px;font-weight:600;color:${b.colors.text};letter-spacing:-0.01em;">Renvani</div><div style="font-size:12px;color:${b.colors.muted};">${b.tagline}</div></td>
</tr></table>`;
}

export function renderRenvaniLayout(input: RenvaniLayoutInput): { html: string; text: string } {
  const b = RENVANI_EMAIL_BRAND;
  const preheader = input.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(input.preheader)}</div>`
    : "";

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>Renvani</title></head>
<body style="margin:0;padding:0;background:${b.colors.background};">
${preheader}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${b.colors.background};">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border:1px solid ${b.colors.border};border-radius:16px;">
<tr><td style="padding:28px 32px 8px 32px;">${logoHtml(input.logoUrl)}</td></tr>
<tr><td style="padding:16px 32px 32px 32px;font-family:${b.fontStack};font-size:15px;line-height:1.6;color:${b.colors.text};">
${input.bodyHtml}
</td></tr>
</table>
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">
<tr><td align="center" style="padding:20px 32px;font-family:${b.fontStack};font-size:12px;line-height:1.6;color:${b.colors.muted};">
<a href="${b.siteUrl}" style="color:${b.colors.primary};font-weight:600;text-decoration:none;">Renvani</a>
&nbsp;·&nbsp;<a href="${b.siteUrl}" style="color:${b.colors.muted};">getrenvani.com</a>
&nbsp;·&nbsp;<a href="${b.termsUrl}" style="color:${b.colors.muted};">Terms</a>
&nbsp;·&nbsp;<a href="${b.privacyUrl}" style="color:${b.colors.muted};">Privacy</a>
<div style="font-size:11px;color:${b.colors.muted};padding-top:6px;">${b.legalLine}</div>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  const text = `${input.bodyText.trim()}

--
Renvani · ${b.siteUrl}
Terms: ${b.termsUrl}
Privacy: ${b.privacyUrl}
${b.legalLine}
`;

  return { html, text };
}

/** Rough HTML → text for template bodies (links become "label (url)"). */
export function htmlToText(html: string): string {
  return html
    .replace(/<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (_m, href: string, label: string) => `${label.replace(/<[^>]+>/g, "").trim()} (${href})`)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .trim();
}
