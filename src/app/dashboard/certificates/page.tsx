"use client";

import { useState, useEffect, useCallback } from "react";

interface Certificate {
  id: string;
  name: string;
  fingerprint: string;
  serialNumber: string;
  notBefore: string;
  notAfter: string;
  revoked: boolean;
  revokedAt: string | null;
  createdAt: string;
}

interface GeneratedCert {
  id: string;
  name: string;
  fingerprint: string;
  certificate: string;
  privateKey: string;
}

export default function CertificatesPage() {
  const [certs, setCerts] = useState<Certificate[]>([]);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [generated, setGenerated] = useState<GeneratedCert | null>(null);
  const [error, setError] = useState("");

  const fetchCerts = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/certificates");
      if (res.ok) {
        const data = await res.json();
        setCerts(data.certificates || []);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchCerts(); }, [fetchCerts]);

  const create = async () => {
    if (!name.trim()) return;
    setCreating(true);
    setError("");
    try {
      const res = await fetch("/api/v1/certificates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to create certificate");
        return;
      }
      const data = await res.json();
      setGenerated(data);
      setName("");
      fetchCerts();
    } catch { setError("Network error"); } finally { setCreating(false); }
  };

  const revoke = async (id: string) => {
    if (!confirm("Revoke this certificate? This cannot be undone.")) return;
    try {
      const res = await fetch(`/api/v1/certificates/${id}`, { method: "DELETE" });
      if (res.ok) fetchCerts();
    } catch { /* ignore */ }
  };

  const download = (filename: string, content: string) => {
    const blob = new Blob([content], { type: "application/x-pem-file" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const isExpired = (notAfter: string) => new Date(notAfter) < new Date();

  return (
    <div>
      <h1 className="text-2xl font-bold text-black mb-1">mTLS Certificates</h1>
      <p className="text-sm text-[#666] mb-6">
        Manage client certificates for mutual TLS authentication. Cloud-only feature.
      </p>

      <div className="rounded-lg border border-[#eaeaea] bg-white p-5 mb-6">
        <h2 className="text-sm font-semibold text-black mb-3">Generate New Certificate</h2>
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="Certificate name (e.g. Production API)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="flex-1 rounded-md border border-[#eaeaea] px-3 py-2 text-sm focus:border-black focus:outline-none"
            onKeyDown={(e) => e.key === "Enter" && create()}
          />
          <button
            onClick={create}
            disabled={creating || !name.trim()}
            className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#333] disabled:opacity-50"
          >
            {creating ? "Generating..." : "Generate"}
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </div>

      {generated && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-5 mb-6">
          <h3 className="text-sm font-semibold text-green-900 mb-2">
            Certificate Generated: {generated.name}
          </h3>
          <p className="text-xs text-green-700 mb-1">
            Fingerprint: <code className="font-mono">{generated.fingerprint}</code>
          </p>
          <p className="text-xs text-green-700 mb-3">
            Download both files now — the private key will not be shown again.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => download(`${generated.name}.crt`, generated.certificate)}
              className="rounded-md border border-green-300 bg-white px-3 py-1.5 text-xs font-medium text-green-800 hover:bg-green-100"
            >
              Download Certificate (.crt)
            </button>
            <button
              onClick={() => download(`${generated.name}.key`, generated.privateKey)}
              className="rounded-md border border-green-300 bg-white px-3 py-1.5 text-xs font-medium text-green-800 hover:bg-green-100"
            >
              Download Private Key (.key)
            </button>
            <button onClick={() => setGenerated(null)} className="ml-auto text-xs text-green-600 hover:text-green-800">
              Dismiss
            </button>
          </div>
        </div>
      )}

      <div className="rounded-lg border border-[#eaeaea] bg-white">
        <div className="border-b border-[#eaeaea] px-5 py-3">
          <h2 className="text-sm font-semibold text-black">Your Certificates</h2>
        </div>
        {certs.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-[#999]">No certificates yet. Generate one above.</div>
        ) : (
          <div className="divide-y divide-[#eaeaea]">
            {certs.map((cert) => (
              <div key={cert.id} className="flex items-center justify-between px-5 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-black truncate">{cert.name}</span>
                    {cert.revoked && (
                      <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700">REVOKED</span>
                    )}
                    {!cert.revoked && isExpired(cert.notAfter) && (
                      <span className="rounded bg-yellow-100 px-1.5 py-0.5 text-[10px] font-medium text-yellow-700">EXPIRED</span>
                    )}
                    {!cert.revoked && !isExpired(cert.notAfter) && (
                      <span className="rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-700">ACTIVE</span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-[#999] font-mono truncate">{cert.fingerprint}</p>
                  <p className="text-xs text-[#999]">Expires {new Date(cert.notAfter).toLocaleDateString()}</p>
                </div>
                {!cert.revoked && (
                  <button
                    onClick={() => revoke(cert.id)}
                    className="ml-4 rounded-md border border-red-200 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                  >
                    Revoke
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
