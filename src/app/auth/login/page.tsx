"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

// Direct signIn call without SessionProvider dependency
async function doSignIn(provider: string, options: Record<string, unknown>): Promise<{ error?: string; url?: string } | undefined> {
  const { signIn } = await import("next-auth/react");
  return signIn(provider, options) as Promise<{ error?: string; url?: string } | undefined>;
}

type AuthFlags = {
  formLogin: boolean;
  magicLink: boolean;
  google: boolean;
  github: boolean;
};

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-[#fafafa]">
        <div className="text-[#999]">Loading...</div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";
  const errorParam = searchParams.get("error");

  const [flags, setFlags] = useState<AuthFlags | null>(null);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [magicSent, setMagicSent] = useState(false);
  const flagsFetched = useRef(false);

  useEffect(() => {
    if (flagsFetched.current) return;
    flagsFetched.current = true;
    fetch("/api/auth/flags")
      .then((r) => r.json())
      .then(setFlags)
      .catch(() => setFlags({ formLogin: true, magicLink: false, google: false, github: false }));
  }, []);

  useEffect(() => {
    if (errorParam === "CredentialsSignin") {
      setError("Invalid email or password.");
    }
  }, [errorParam]);

  async function handleFormLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await doSignIn("credentials", {
      email,
      password,
      callbackUrl,
      redirect: false,
    });

    if (res?.error) {
      setError("Invalid email or password.");
      setLoading(false);
    } else if (res?.url) {
      window.location.href = res.url;
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Registration failed");
        setLoading(false);
        return;
      }

      // Auto-login after registration
      const loginRes = await doSignIn("credentials", {
        email,
        password,
        callbackUrl,
        redirect: false,
      });

      if (loginRes?.url) {
        window.location.href = loginRes.url;
      } else {
        setSuccess("Account created! You can now sign in.");
        setMode("login");
        setLoading(false);
      }
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    await doSignIn("email", { email, callbackUrl, redirect: false });
    setMagicSent(true);
    setLoading(false);
  }

  if (!flags) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#fafafa]">
        <div className="text-[#999]">Loading...</div>
      </div>
    );
  }

  const hasOAuth = flags.github || flags.google;
  const hasDivider = flags.formLogin && (hasOAuth || flags.magicLink);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#fafafa] px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Link
            href="/"
            className="mb-4 inline-flex items-center gap-2 text-lg font-bold text-black"
          >
            <img src="/lobster-icon.png" alt="HeySummon" className="h-8 w-8 rounded-lg" />
            HeySummon
          </Link>
          <h1 className="mt-6 text-2xl font-semibold text-black">
            {mode === "login" ? "Welcome back" : "Create your account"}
          </h1>
          <p className="mt-1 text-sm text-[#666]">
            {mode === "login"
              ? "Sign in to your provider dashboard"
              : "Get started with HeySummon"}
          </p>
        </div>

        <div className="rounded-lg border border-[#eaeaea] bg-white p-6 shadow-sm">
          {error && (
            <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-4 rounded-md bg-green-50 px-3 py-2 text-sm text-green-600">
              {success}
            </div>
          )}

          {/* Magic Link sent state */}
          {magicSent && (
            <div className="text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-50 text-xl">
                ✉️
              </div>
              <h2 className="text-lg font-semibold text-black">Check your email</h2>
              <p className="mt-2 text-sm text-[#666]">
                We sent a magic link to <strong className="text-black">{email}</strong>.
              </p>
              <button
                onClick={() => { setMagicSent(false); setEmail(""); }}
                className="mt-4 text-sm text-violet-600 hover:text-violet-500"
              >
                Use a different email
              </button>
            </div>
          )}

          {!magicSent && (
            <>
              {/* Form Login / Register */}
              {flags.formLogin && (
                <form onSubmit={mode === "login" ? handleFormLogin : handleRegister} className="mb-0">
                  {mode === "register" && (
                    <>
                      <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-[#333]">
                        Name
                      </label>
                      <input
                        id="name"
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Your name (optional)"
                        className="mb-3 w-full rounded-md border border-[#eaeaea] bg-white px-3.5 py-2.5 text-sm text-black placeholder-[#999] outline-none transition-colors focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
                      />
                    </>
                  )}

                  <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-[#333]">
                    Email address
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="you@example.com"
                    className="mb-3 w-full rounded-md border border-[#eaeaea] bg-white px-3.5 py-2.5 text-sm text-black placeholder-[#999] outline-none transition-colors focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
                  />

                  <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-[#333]">
                    Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    placeholder={mode === "register" ? "Min. 8 characters" : "••••••••"}
                    className="mb-4 w-full rounded-md border border-[#eaeaea] bg-white px-3.5 py-2.5 text-sm text-black placeholder-[#999] outline-none transition-colors focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
                  />

                  <button
                    type="submit"
                    disabled={loading || !email || !password}
                    className="w-full rounded-md bg-violet-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-violet-500 disabled:opacity-50"
                  >
                    {loading
                      ? mode === "login" ? "Signing in..." : "Creating account..."
                      : mode === "login" ? "Sign in" : "Create account"}
                  </button>

                  <p className="mt-3 text-center text-sm text-[#666]">
                    {mode === "login" ? (
                      <>
                        Don&apos;t have an account?{" "}
                        <button
                          type="button"
                          onClick={() => { setMode("register"); setError(""); setSuccess(""); }}
                          className="text-violet-600 hover:text-violet-500"
                        >
                          Sign up
                        </button>
                      </>
                    ) : (
                      <>
                        Already have an account?{" "}
                        <button
                          type="button"
                          onClick={() => { setMode("login"); setError(""); setSuccess(""); }}
                          className="text-violet-600 hover:text-violet-500"
                        >
                          Sign in
                        </button>
                      </>
                    )}
                  </p>
                </form>
              )}

              {/* Divider */}
              {hasDivider && (
                <div className="relative my-5">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-[#eaeaea]" />
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="bg-white px-2 text-[#999]">or continue with</span>
                  </div>
                </div>
              )}

              {/* Magic Link */}
              {flags.magicLink && !flags.formLogin && (
                <form onSubmit={handleMagicLink} className="mb-5">
                  <label htmlFor="magic-email" className="mb-1.5 block text-sm font-medium text-[#333]">
                    Email address
                  </label>
                  <input
                    id="magic-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="you@example.com"
                    className="mb-3 w-full rounded-md border border-[#eaeaea] bg-white px-3.5 py-2.5 text-sm text-black placeholder-[#999] outline-none transition-colors focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
                  />
                  <button
                    type="submit"
                    disabled={loading || !email}
                    className="w-full rounded-md bg-violet-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-violet-500 disabled:opacity-50"
                  >
                    {loading ? "Sending..." : "Send Magic Link"}
                  </button>
                </form>
              )}

              {flags.magicLink && flags.formLogin && (
                <button
                  onClick={() => {
                    if (email) {
                      doSignIn("email", { email, callbackUrl, redirect: false });
                      setMagicSent(true);
                    }
                  }}
                  disabled={!email}
                  className="mb-3 flex w-full items-center justify-center gap-2 rounded-md border border-[#eaeaea] bg-white px-4 py-2.5 text-sm font-medium text-black transition-colors hover:bg-[#fafafa] disabled:opacity-50"
                >
                  ✉️ Send Magic Link instead
                </button>
              )}

              {/* OAuth buttons */}
              {hasOAuth && (
                <div className="flex flex-col gap-3">
                  {flags.github && (
                    <button
                      onClick={() => doSignIn("github", { callbackUrl })}
                      className="flex w-full items-center justify-center gap-2 rounded-md bg-black px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-black/90"
                    >
                      <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                      </svg>
                      GitHub
                    </button>
                  )}
                  {flags.google && (
                    <button
                      onClick={() => doSignIn("google", { callbackUrl })}
                      className="flex w-full items-center justify-center gap-2 rounded-md border border-[#eaeaea] bg-white px-4 py-2.5 text-sm font-medium text-black transition-colors hover:bg-[#fafafa]"
                    >
                      <svg className="h-5 w-5" viewBox="0 0 24 24">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                      </svg>
                      Google
                    </button>
                  )}
                </div>
              )}

              {/* No login methods available */}
              {!flags.formLogin && !flags.magicLink && !hasOAuth && (
                <p className="text-center text-sm text-[#666]">
                  No login methods are configured. Set <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">ENABLE_FORM_LOGIN=true</code> in your environment.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
