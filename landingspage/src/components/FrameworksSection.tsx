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

const expertCurrent = [
  { name: "OpenClaw", icon: "/icons/openclaw.svg" },
  { name: "Telegram", icon: "/icons/telegram.svg" },
  { name: "Slack", icon: "/icons/slack.svg" },
];

const expertSoon = [
  { name: "WhatsApp", icon: "/icons/whatsapp.svg" },
];

const CYCLE_DURATION = 6000;

export function FrameworksSection() {
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
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 1, ease: "easeOut" }}
          className="mb-12 max-w-xl"
        >
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-text-muted mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
            Integrations
          </div>
          <h2 className="font-serif text-4xl md:text-5xl mb-6">Works where you work.</h2>
          <p className="text-lg text-text-body">
            Connect your AI agents and human experts through the channels they already use. Install once, work everywhere.
          </p>
        </motion.div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {/* Left: Conversation example per client */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 1, delay: 0.2, ease: "easeOut" }}
            className="md:col-span-3 relative rounded-2xl overflow-hidden border border-white/10 min-h-[400px] md:min-h-[520px]"
          >
            <img
              src="https://images.pexels.com/photos/5890532/pexels-photo-5890532.jpeg?auto=compress&cs=tinysrgb&w=1200"
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-bg-deep via-bg-deep/70 to-bg-deep/30" />

            {/* Conversation overlay */}
            <div className="absolute bottom-0 left-0 right-0 p-6">
              <div className="bg-bg-deep/85 backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden shadow-2xl">
                <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/10 bg-white/5">
                  <img src={active.icon} alt={active.name} className="h-4 w-4 rounded" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  <span className="text-xs font-mono text-text-muted">{active.name} session</span>
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
                          msg.role === 'agent' ? 'bg-primary/20 text-primary' : 'bg-green-check/20 text-green-check'
                        }`}>
                          {msg.role === 'agent' ? 'AI' : 'H'}
                        </div>
                        <div className={`max-w-[80%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed ${
                          msg.role === 'agent'
                            ? 'bg-white/5 text-text-body'
                            : 'bg-green-check/10 text-text-heading'
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

          {/* Right: Client selector with loader */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 1, delay: 0.4, ease: "easeOut" }}
            className="md:col-span-2 bg-bg-card border border-white/10 rounded-2xl p-8 flex flex-col"
          >
            <h3 className="font-serif text-2xl mb-2 text-text-heading">Client Side</h3>
            <p className="text-sm text-text-body mb-6">
              Your AI agents connect through any supported client.
            </p>

            {/* Active clients with loader */}
            <div className="space-y-1 mb-6">
              {clients.map((client, i) => (
                <button
                  key={client.name}
                  onClick={() => { setActiveIndex(i); setProgress(0); }}
                  className="w-full text-left"
                >
                  {/* Progress loader bar */}
                  {i === activeIndex && (
                    <div className="h-0.5 bg-white/5 rounded-full mx-3 mt-1">
                      <motion.div
                        className="h-full bg-white/30 rounded-full"
                        style={{ width: `${progress}%` }}
                        transition={{ duration: 0.05 }}
                      />
                    </div>
                  )}
                  <div className={`flex items-center gap-3 px-3 py-3 rounded-lg transition-colors ${
                    i === activeIndex ? 'bg-white/5' : 'hover:bg-white/[0.03]'
                  }`}>
                    <img
                      src={client.icon}
                      alt={client.name}
                      className="h-6 w-6 rounded flex-shrink-0"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                    <div className="flex-1 min-w-0">
                      <span className={`text-sm font-medium block ${i === activeIndex ? 'text-text-heading' : 'text-text-body'}`}>
                        {client.name}
                      </span>
                      <AnimatePresence mode="wait">
                        {i === activeIndex && (
                          <motion.p
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.3 }}
                            className="text-xs text-text-muted leading-relaxed mt-1 overflow-hidden"
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

            {/* Coming soon - compact with "soon" badge */}
            <div className="flex flex-wrap gap-2 mb-6">
              {clientSoon.map(item => (
                <div key={item.name} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/5 opacity-50">
                  <img src={item.icon} alt={item.name} className="h-4 w-4 rounded" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  <span className="text-xs text-text-body">{item.name}</span>
                  <span className="text-[9px] font-mono uppercase tracking-wider text-text-muted bg-white/5 px-1.5 py-0.5 rounded">soon</span>
                </div>
              ))}
            </div>

            {/* Expert section */}
            <div className="border-t border-white/10 pt-6 mt-auto">
              <h4 className="font-serif text-2xl mb-2 text-text-heading">Expert Side</h4>
              <p className="text-xs text-text-body mb-4">Human experts respond through their preferred channel.</p>
              <div className="flex items-center gap-4">
                {expertCurrent.map(item => (
                  <img key={item.name} src={item.icon} alt={item.name} className="h-8 w-8 rounded" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                ))}
                {expertSoon.map(item => (
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
