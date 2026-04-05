import Link from "next/link";

export default function VerifyPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm text-center">
        <Link
          href="/"
          className="mb-4 inline-flex items-center gap-2 text-lg font-bold text-foreground"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-600 text-sm text-white">
            H
          </span>
          HeySummon
        </Link>

        <div className="mt-6 rounded-lg border border-border bg-card p-8 shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted text-2xl">
            ✉️
          </div>
          <h1 className="text-xl font-semibold text-foreground">Check your email</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            A magic link has been sent to your email address. Click the link to sign in to your dashboard.
          </p>
          <p className="mt-4 text-xs text-muted-foreground">
            Didn&apos;t receive it? Check your spam folder or{" "}
            <Link href="/auth/login" className="text-orange-600 hover:text-orange-500">
              try again
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
