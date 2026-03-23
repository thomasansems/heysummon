import fs from 'fs';
import path from 'path';
import http from 'http';

const HEYSUMMON_PREFIX = '📩 Nieuw antwoord van provider';

const handler = async (event: any) => {
  if (event.type !== 'message' || event.action !== 'sent') return;

  const content: string = event.context?.content ?? '';

  // Only react to HeySummon provider response notifications
  if (!content.startsWith(HEYSUMMON_PREFIX)) return;

  console.log('[heysummon-responder] Provider response detected, waking agent...');

  // Read gateway config
  const configPath = path.join(process.env.HOME!, '.openclaw/openclaw.json');
  let hooksToken = '';
  let port = 18789;

  try {
    const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    hooksToken = cfg?.hooks?.token ?? '';
    port = cfg?.gateway?.port ?? 18789;
  } catch (e) {
    console.error('[heysummon-responder] Could not read openclaw.json:', e);
    return;
  }

  if (!hooksToken) {
    console.error('[heysummon-responder] No hooks.token in openclaw.json — cannot wake agent');
    return;
  }

  // Read agent ID from skill .env
  let agentId = 'tertiary';
  try {
    const skillDir = path.join(
      process.env.npm_config_prefix ?? path.join(process.env.HOME!, '.npm-global'),
      'lib/node_modules/openclaw/skills/heysummon'
    );
    const envFile = path.join(skillDir, '.env');
    if (fs.existsSync(envFile)) {
      const envContent = fs.readFileSync(envFile, 'utf8');
      const match = envContent.match(/^HEYSUMMON_AGENT_ID=(.+)$/m);
      if (match) agentId = match[1].trim();
    }
  } catch (e) {
    // fallback to default
  }

  const message =
    `HeySummon provider antwoord ontvangen:\n\n${content}\n\n` +
    `Lees de HeySummon skill instructies en reageer direct op dit antwoord.`;

  const payload = JSON.stringify({
    message,
    agentId,
    name: 'HeySummon',
    deliver: true,
    channel: 'last',
    wakeMode: 'now',
  });

  await new Promise<void>((resolve) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: '/hooks/agent',
        method: 'POST',
        headers: {
          Authorization: `Bearer ${hooksToken}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          console.log(`[heysummon-responder] /hooks/agent → ${res.statusCode}: ${body}`);
          resolve();
        });
      }
    );
    req.on('error', (e) => {
      console.error('[heysummon-responder] Error calling /hooks/agent:', e.message);
      resolve();
    });
    req.write(payload);
    req.end();
  });
};

export default handler;
