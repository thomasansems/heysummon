const statusStyles: Record<string, string> = {
  pending: "border-yellow-500/30 bg-yellow-500/10 text-yellow-400",
  reviewing: "border-blue-500/30 bg-blue-500/10 text-blue-400",
  responded: "border-green-500/30 bg-green-500/10 text-green-400",
  expired: "border-red-500/30 bg-red-500/10 text-red-400",
};

export function StatusBadge({ status }: { status: string }) {
  const style = statusStyles[status] || statusStyles.pending;

  return (
    <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${style}`}>
      {status}
    </span>
  );
}
