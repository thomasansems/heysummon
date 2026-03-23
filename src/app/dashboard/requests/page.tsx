import { Suspense } from "react";
import RequestsContent from "./requests-content";

function RequestsLoading() {
  return (
    <div className="flex h-screen items-center justify-center">
      <p className="text-muted-foreground">Loading...</p>
    </div>
  );
}

export default function RequestsPage() {
  return (
    <Suspense fallback={<RequestsLoading />}>
      <RequestsContent />
    </Suspense>
  );
}
