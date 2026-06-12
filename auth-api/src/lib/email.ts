import { Resend } from 'resend';

let _resend: Resend | null = null;
function getResend(): Resend {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY ?? 'dummy');
  return _resend;
}
const FROM = process.env.EMAIL_FROM ?? 'Radar Arboviroses <noreply@radar-arboviroses.com>';

export async function sendAlertEmail(opts: {
  to: string;
  nome: string;
  municipio: string;
  uf: string;
  doenca: string;
  nivel: number;
  casosEst: number;
  se: number;
}) {
  const nivelLabel = ['Sem dados', 'Verde', 'Amarelo', 'Laranja', 'Vermelho'][opts.nivel] ?? 'Desconhecido';
  const nivelCor   = ['#475569', '#22c55e', '#eab308', '#f97316', '#ef4444'][opts.nivel] ?? '#475569';
  const doencaLabel = opts.doenca === 'dengue' ? 'Dengue' : 'Chikungunya';

  const html = `
<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"/><title>Alerta</title></head>
<body style="margin:0;padding:0;background:#070d1a;font-family:Inter,sans-serif;color:#e4eaf6">
<table width="100%" cellpadding="0" cellspacing="0">
<tr><td align="center" style="padding:40px 16px">
<table width="540" style="background:#0c1526;border:1px solid #1c2b46;border-radius:16px;overflow:hidden">
  <tr><td style="padding:28px 32px 20px;border-bottom:1px solid #131e34">
    <span style="font-size:1.1rem;font-weight:800;letter-spacing:-0.01em">
      🦟 Radar de <span style="color:#38bdf8">Arboviroses</span>
    </span>
  </td></tr>
  <tr><td style="padding:28px 32px">
    <p style="margin:0 0 8px;color:#9aa8c0;font-size:0.85rem">Alerta de saúde para</p>
    <h1 style="margin:0 0 20px;font-size:1.8rem;font-weight:800;letter-spacing:-0.03em">
      ${opts.municipio} <span style="color:#7080a0;font-size:1rem;font-weight:500">${opts.uf}</span>
    </h1>
    <div style="display:inline-block;padding:8px 18px;border-radius:999px;background:${nivelCor}1a;border:1px solid ${nivelCor}44;color:${nivelCor};font-weight:700;font-size:0.9rem;letter-spacing:0.03em;margin-bottom:24px">
      ${nivelLabel} — ${doencaLabel}
    </div>
    <table width="100%" style="background:#111d33;border-radius:10px;margin-bottom:24px">
      <tr>
        <td style="padding:16px 20px;border-bottom:1px solid #131e34">
          <div style="color:#7080a0;font-size:0.78rem;font-weight:600;text-transform:uppercase;letter-spacing:0.05em">Casos estimados</div>
          <div style="font-size:1.6rem;font-weight:800;margin-top:4px">${Math.round(opts.casosEst).toLocaleString('pt-BR')}</div>
        </td>
        <td style="padding:16px 20px">
          <div style="color:#7080a0;font-size:0.78rem;font-weight:600;text-transform:uppercase;letter-spacing:0.05em">Semana Epi.</div>
          <div style="font-size:1.6rem;font-weight:800;margin-top:4px">SE ${String(opts.se).slice(4)}/${String(opts.se).slice(0,4)}</div>
        </td>
      </tr>
    </table>
    <p style="color:#9aa8c0;font-size:0.875rem;line-height:1.6;margin:0 0 24px">
      Olá, ${opts.nome}! Este município atingiu o nível de alerta <strong style="color:#e4eaf6">${nivelLabel}</strong>
      na vigilância de ${doencaLabel}. Acesse o dashboard para mais detalhes e série histórica completa.
    </p>
    <a href="${process.env.DASHBOARD_URL ?? 'http://localhost:4200'}"
       style="display:inline-block;padding:12px 28px;background:#38bdf8;color:#03090f;font-weight:700;border-radius:8px;text-decoration:none;font-size:0.9rem">
      Ver no Dashboard →
    </a>
  </td></tr>
  <tr><td style="padding:18px 32px;border-top:1px solid #131e34;color:#3d5070;font-size:0.75rem">
    Você recebeu este e-mail pois assinou alertas no Radar de Arboviroses. Dados do InfoDengue (Fiocruz/FGV).
  </td></tr>
</table>
</td></tr>
</table>
</body></html>`;

  return getResend().emails.send({
    from: FROM,
    to:   opts.to,
    subject: `⚠️ Alerta ${nivelLabel} de ${doencaLabel} — ${opts.municipio}/${opts.uf}`,
    html,
  });
}

export async function sendWelcomeEmail(to: string, name: string) {
  return getResend().emails.send({
    from: FROM,
    to,
    subject: 'Bem-vindo ao Radar de Arboviroses',
    html: `<p>Olá, ${name}! Sua conta foi criada com sucesso. Acesse <a href="${process.env.DASHBOARD_URL}">o dashboard</a>.</p>`,
  });
}
