import { Bell } from "lucide-react";

export function NotificationBadge({ className }: { className?: string }) {
  return (
    <span
      className={
        "inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground" +
        (className ? ` ${className}` : "")
      }
    >
      <Bell className="h-3 w-3" />
      Notification
    </span>
  );
}
