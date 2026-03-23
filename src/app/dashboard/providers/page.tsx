import { Suspense } from "react";
import ProvidersContent from "./providers-content";

// Loading fallback component
function ProvidersLoading() {
  return (
    <div className="flex h-screen items-center justify-center">
      <p className="text-muted-foreground">Loading providers...</p>
    </div>
  );
}

// Server component wrapper with Suspense boundary
export default function ProvidersPage() {
  return (
    <Suspense fallback={<ProvidersLoading />}>
      <ProvidersContent />
    </Suspense>
  );
}
