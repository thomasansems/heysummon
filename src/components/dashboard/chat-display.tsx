interface Message {
  role: "user" | "assistant";
  content: string;
}

export function ChatDisplay({ messages }: { messages: Message[] }) {
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
                ? "rounded-br-md bg-violet-600/30 text-violet-100"
                : "rounded-bl-md bg-zinc-800 text-zinc-200"
            }`}
          >
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider opacity-60">
              {msg.role === "user" ? "User" : "AI Assistant"}
            </p>
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
