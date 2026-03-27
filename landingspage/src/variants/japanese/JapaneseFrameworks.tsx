import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface ClientIntegration {
  name: string;
  icon: string;
  description: string;
  conversation: { role: 'agent' | 'human'; text: string }[];
}

const clients: ClientIntegration[] = [
  {
    name: "Claude Code",
    icon: "/icons/claudecode.svg",
    description: "Anthropic's coding agent with built-in skill support. Install the HeySummon skill and Claude will automatically pause and wait for your expert's response.",
    conversation: [
      { role: 'agent', text: "I need to deploy v2.4 to production but the migration has breaking changes. Should I proceed?" },
      { role: 'human', text: "Hold off - run the migration on staging first. I'll review the diff in 10 minutes." },
      { role: 'agent', text: "Understood. Running migration on staging now and will wait for your review." },
    ],
  },
  {
    name: "Codex CLI",
    icon: "/icons/openai.svg",
    description: "OpenAI's command-line coding agent. HeySummon integrates as a native tool call, so Codex can request human input mid-task without breaking its workflow.",
    conversation: [
      { role: 'agent', text: "Found 3 possible fixes for the auth bug. Option A changes the middleware, B patches the token validator, C rewrites the session handler." },
      { role: 'human', text: "Go with option B. The token validator is isolated and easiest to test. Write unit tests first." },
      { role: 'agent', text: "Patching token validator with tests. PR incoming." },
    ],
  },
  {
    name: "Gemini CLI",
    icon: "/icons/gemini.svg",
    description: "Google's command-line AI agent with multimodal capabilities. HeySummon plugs in as a tool, letting Gemini escalate to humans when it needs real-world judgment.",
    conversation: [
      { role: 'agent', text: "The API rate limiter config seems aggressive at 100 req/min. The dashboard shows users hitting limits during peak hours." },
      { role: 'human', text: "Bump it to 500/min for authenticated users, keep 100 for anonymous. Add a X-RateLimit-Remaining header." },
      { role: 'agent', text: "Updated rate limiter with tiered limits and response headers." },
    ],
  },
  {
    name: "OpenClaw",
    icon: "/icons/openclaw.svg",
    description: "Open-source AI agent framework with native HeySummon support. Agents can summon humans via chat, with automatic polling and response handling built in.",
    conversation: [
      { role: 'agent', text: "Customer #4521 is requesting a refund for their annual plan. They've been a user for 2 years. How should I handle this?" },
      { role: 'human', text: "Offer a 3-month credit instead. If they insist, process the prorated refund. Flag the account for follow-up." },
      { role: 'agent', text: "Sending credit offer now. I'll escalate if they decline." },
    ],
  },
];

const clientSoon = [
  { name: "Cursor", icon: "/icons/cursor.svg" },
  { name: "OpenAI", icon: "/icons/openai.svg" },
  { name: "NanoClaw", icon: "/icons/docker.svg" },
  { name: "NemoClaw", icon: "/icons/nvidia.svg" },
];

const providerCurrent = [
  { name: "OpenClaw", icon: "/icons/openclaw.svg" },
  { name: "Telegram", icon: "/icons/telegram.svg" },
  { name: "Slack", icon: "/icons/slack.svg" },
];

const providerSoon = [
  { name: "WhatsApp", icon: "/icons/whatsapp.svg" },
];

const CYCLE_DURATION = 6000;

export function JapaneseFrameworks() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          setActiveIndex((i) => (i + 1) % clients.length);
          return 0;
        }
        return prev + (100 / (CYCLE_DURATION / 50));
      });
    }, 50);
    return () => clearInterval(interval);
  }, []);

  const active = clients[activeIndex];

  return (
    <section id="frameworks" className="py-32 px-8">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 1, ease: "easeOut" }}
          className="mb-12 max-w-xl"
        >
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-[#8a7d6e] mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-[#dc2626]"></span>
            Integrations
          </div>
          <h2 className="text-4xl md:text-5xl mb-6">Works where you work.</h2>
          <p className="text-lg text-[#c4b5a0]">
            Connect your AI agents and human experts through the channels they already use. Install once, work everywhere.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {/* Left: Conversation example per client */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 1, delay: 0.2, ease: "easeOut" }}
            className="md:col-span-3 relative rounded-2xl overflow-hidden border border-[#f59e0b]/20 min-h-[400px] md:min-h-[520px]"
          >
            {/* Ink-wash background placeholder */}
            <div className="absolute inset-0 bg-gradient-to-br from-[#16213e] via-[#1a1a2e] to-[#0f0f23]" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#1a1a2e] via-[#1a1a2e]/70 to-[#1a1a2e]/30" />

            <div className="absolute bottom-0 left-0 right-0 p-6">
              <div className="bg-[#0d0d0d]/85 backdrop-blur-xl border border-[#f59e0b]/20 rounded-xl overflow-hidden shadow-2xl">
                <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[#f59e0b]/10 bg-[#252540]/50">
                  <img src={active.icon} alt={active.name} className="h-4 w-4 rounded" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  <span className="text-xs font-mono text-[#8a7d6e]">{active.name} session</span>
                </div>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeIndex}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                    className="p-5 space-y-4"
                  >
                    {active.conversation.map((msg, i) => (
                      <div key={i} className={`flex gap-3 ${msg.role === 'human' ? 'flex-row-reverse' : ''}`}>
                        <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-mono font-bold ${
                          msg.role === 'agent' ? 'bg-[#dc2626]/20 text-[#dc2626]' : 'bg-[#34d399]/20 text-[#34d399]'
                        }`}>
                          {msg.role === 'agent' ? 'AI' : 'H'}
                        </div>
                        <div className={`max-w-[80%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed ${
                          msg.role === 'agent'
                            ? 'bg-[#252540]/50 text-[#c4b5a0]'
                            : 'bg-[#34d399]/10 text-[#faf5ef]'
                        }`}>
                          {msg.text}
                        </div>
                      </div>
                    ))}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </motion.div>

          {/* Right: Client selector */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 1, delay: 0.4, ease: "easeOut" }}
            className="md:col-span-2 wooden-plaque rounded-2xl p-8 flex flex-col"
          >
            <h3 className="text-2xl mb-2">Client Side</h3>
            <p className="text-sm text-[#c4b5a0] mb-6">
              Your AI agents connect through any supported client.
            </p>

            <div className="space-y-1 mb-6">
              {clients.map((client, i) => (
                <button
                  key={client.name}
                  onClick={() => { setActiveIndex(i); setProgress(0); }}
                  className="w-full text-left"
                >
                  {i === activeIndex && (
                    <div className="h-0.5 bg-[#252540] rounded-full mx-3 mt-1">
                      <motion.div
                        className="h-full bg-[#f59e0b]/50 rounded-full"
                        style={{ width: `${progress}%` }}
                        transition={{ duration: 0.05 }}
                      />
                    </div>
                  )}
                  <div className={`flex items-center gap-3 px-3 py-3 rounded-lg transition-colors ${
                    i === activeIndex ? 'bg-[#f59e0b]/10' : 'hover:bg-[#f59e0b]/5'
                  }`}>
                    <img
                      src={client.icon}
                      alt={client.name}
                      className="h-6 w-6 rounded flex-shrink-0"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                    <div className="flex-1 min-w-0">
                      <span className={`text-sm font-medium block ${i === activeIndex ? 'text-[#faf5ef]' : 'text-[#c4b5a0]'}`}>
                        {client.name}
                      </span>
                      <AnimatePresence mode="wait">
                        {i === activeIndex && (
                          <motion.p
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.3 }}
                            className="text-xs text-[#8a7d6e] leading-relaxed mt-1 overflow-hidden"
                          >
                            {client.description}
                          </motion.p>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            <div className="flex flex-wrap gap-2 mb-6">
              {clientSoon.map(item => (
                <div key={item.name} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1a1a2e]/30 border border-[#f59e0b]/10 opacity-50">
                  <img src={item.icon} alt={item.name} className="h-4 w-4 rounded" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  <span className="text-xs text-[#c4b5a0]">{item.name}</span>
                  <span className="text-[9px] font-mono uppercase tracking-wider text-[#8a7d6e] bg-[#f59e0b]/10 px-1.5 py-0.5 rounded">soon</span>
                </div>
              ))}
            </div>

            <div className="border-t border-[#f59e0b]/20 pt-6 mt-auto">
              <h4 className="text-2xl mb-2">Provider Side</h4>
              <p className="text-xs text-[#c4b5a0] mb-4">Human experts respond through their preferred channel.</p>
              <div className="flex items-center gap-4">
                {providerCurrent.map(item => (
                  <img key={item.name} src={item.icon} alt={item.name} className="h-8 w-8 rounded" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                ))}
                {providerSoon.map(item => (
                  <img key={item.name} src={item.icon} alt={item.name} className="h-8 w-8 rounded opacity-40" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
