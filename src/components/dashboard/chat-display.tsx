import { AlertTriangle, Lock } from "lucide-react";

interface LegacyMessage {
  role: "user" | "assistant";
  content: string;
}

interface E2EMessage {
  id: string;
  from: "consumer" | "expert";
  messageId: string;
  createdAt: string;
  plaintext: string;
  decryptError?: boolean;
}

type ChatDisplayProps =
  | { messages: LegacyMessage[]; variant: "legacy" }
  | { messages: E2EMessage[]; variant: "e2e" };

export function ChatDisplay(props: ChatDisplayProps) {
  if (props.variant === "legacy") {
    return <LegacyChatDisplay messages={props.messages} />;
  }
  return <E2EChatDisplay messages={props.messages} />;
}

function LegacyChatDisplay({ messages }: { messages: LegacyMessage[] }) {
  return (
    <div className="space-y-3">
      {messages.map((msg, i) => (
        <div
          key={i}
          className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
        >
          <div
            className={`max-w-[80%] rounded-2xl px-4 py-3 ${
              msg.role === "user"
                ? "rounded-br-md bg-orange-600/30 text-orange-100"
                : "rounded-bl-md bg-muted text-foreground"
            }`}
          >
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider opacity-60">
              {msg.role === "user" ? "User" : "AI Assistant"}
            </p>
            <p className="whitespace-pre-wrap text-sm leading-relaxed">
              {msg.content}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

function E2EChatDisplay({ messages }: { messages: E2EMessage[] }) {
  return (
    <div className="space-y-3">
      {messages.map((msg) => {
        const isConsumer = msg.from === "consumer";
        return (
          <div
            key={msg.id}
            className={`flex ${isConsumer ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                isConsumer
                  ? "rounded-br-md bg-orange-600/30 text-orange-100"
                  : "rounded-bl-md bg-muted text-foreground"
              }`}
            >
              <div className="mb-1 flex items-center gap-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-wider opacity-60">
                  {isConsumer ? "Consumer" : "You"}
                </p>
                {msg.decryptError ? (
                  <AlertTriangle className="h-2.5 w-2.5 text-red-400" />
                ) : (
                  <Lock className="h-2.5 w-2.5 text-green-500 opacity-60" />
                )}
              </div>
              <p className="whitespace-pre-wrap text-sm leading-relaxed">
                {msg.decryptError
                  ? "Message could not be decrypted — it may have been sent before key exchange completed."
                  : msg.plaintext}
              </p>
              <p className="mt-1 text-[10px] opacity-40">
                {new Date(msg.createdAt).toLocaleTimeString()}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
