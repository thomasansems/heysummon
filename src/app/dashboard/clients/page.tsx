import { Suspense } from "react";
import ClientsContent from "./clients-content";

// Loading fallback component
function ClientsLoading() {
  return (
    <div className="flex h-screen items-center justify-center">
      <p className="text-muted-foreground">Loading clients...</p>
    </div>
  );
}

// Server component wrapper with Suspense boundary
export default function ClientsPage() {
  return (
    <Suspense fallback={<ClientsLoading />}>
      <ClientsContent />
    </Suspense>
  );
}
