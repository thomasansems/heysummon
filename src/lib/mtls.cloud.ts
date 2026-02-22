/**
 * mTLS certificate management — cloud-only feature.
 * Licensed under LICENSE_CLOUD.md — requires HeySummon Cloud License.
 */

import forge from "node-forge";
import crypto from "crypto";

const CA_COMMON_NAME = "HeySummon Cloud CA";
const CERT_VALIDITY_DAYS = 365;

interface GeneratedCertificate {
  certificate: string;
  privateKey: string;
  fingerprint: string;
  serialNumber: string;
  notBefore: Date;
  notAfter: Date;
}

export function generateClientCertificate(
  commonName: string,
  validityDays: number = CERT_VALIDITY_DAYS
): GeneratedCertificate {
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  const serial = crypto.randomBytes(16).toString("hex");
  cert.serialNumber = serial;
  const now = new Date();
  const notAfter = new Date(now.getTime() + validityDays * 24 * 60 * 60 * 1000);
  cert.validity.notBefore = now;
  cert.validity.notAfter = notAfter;
  const attrs = [
    { name: "commonName", value: commonName },
    { name: "organizationName", value: "HeySummon Cloud" },
  ];
  cert.setSubject(attrs);
  cert.setIssuer([
    { name: "commonName", value: CA_COMMON_NAME },
    { name: "organizationName", value: "HeySummon Cloud" },
  ]);
  cert.setExtensions([
    { name: "basicConstraints", cA: false },
    { name: "keyUsage", digitalSignature: true, keyEncipherment: true },
    { name: "extKeyUsage", clientAuth: true },
  ]);
  cert.sign(keys.privateKey, forge.md.sha256.create());
  const certPem = forge.pki.certificateToPem(cert);
  const keyPem = forge.pki.privateKeyToPem(keys.privateKey);
  const fingerprint = computeFingerprint(certPem);
  return { certificate: certPem, privateKey: keyPem, fingerprint, serialNumber: serial, notBefore: now, notAfter };
}

export function computeFingerprint(certPem: string): string {
  const cert = forge.pki.certificateFromPem(certPem);
  const der = forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes();
  return crypto.createHash("sha256").update(Buffer.from(der, "binary")).digest("hex");
}

export function verifyFingerprint(certPem: string, expectedFingerprint: string): boolean {
  const actual = computeFingerprint(certPem);
  return crypto.timingSafeEqual(Buffer.from(actual, "hex"), Buffer.from(expectedFingerprint, "hex"));
}
