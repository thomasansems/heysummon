import { Suspense } from "react";
import ExpertsContent from "./experts-content";

// Loading fallback component
function ExpertsLoading() {
  return (
    <div className="flex h-screen items-center justify-center">
      <p className="text-muted-foreground">Loading experts...</p>
    </div>
  );
}

// Server component wrapper with Suspense boundary
export default function ExpertsPage() {
  return (
    <Suspense fallback={<ExpertsLoading />}>
      <ExpertsContent />
    </Suspense>
  );
}
