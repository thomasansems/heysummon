import Link from "next/link";

export default function VerifyPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#fafafa] px-4">
      <div className="w-full max-w-sm text-center">
        <Link
          href="/"
          className="mb-4 inline-flex items-center gap-2 text-lg font-bold text-black"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-600 text-sm text-white">
            H
          </span>
          HITLaaS
        </Link>

        <div className="mt-6 rounded-lg border border-[#eaeaea] bg-white p-8 shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-violet-50 text-2xl">
            ✉️
          </div>
          <h1 className="text-xl font-semibold text-black">Check your email</h1>
          <p className="mt-3 text-sm text-[#666]">
            A magic link has been sent to your email address. Click the link to sign in to your dashboard.
          </p>
          <p className="mt-4 text-xs text-[#999]">
            Didn&apos;t receive it? Check your spam folder or{" "}
            <Link href="/auth/login" className="text-violet-600 hover:text-violet-500">
              try again
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
