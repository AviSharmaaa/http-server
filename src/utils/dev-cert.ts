import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import selfsigned from "selfsigned";

const CERT_DIR = path.join(process.cwd(), ".certs");
const KEY_PATH = path.join(CERT_DIR, "localhost-key.pem");
const CERT_PATH = path.join(CERT_DIR, "localhost-cert.pem");

function ensureDir(p: string) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function tryTrustOnMac(certPath: string) {
  try {
    // login keychain (no sudo)
    const systemKC = "/Library/Keychains/System.keychain";
    const absCert = path.resolve(certPath);
    execFileSync(
      "sudo",
      [
        "security",
        "add-trusted-cert",
        "-d",
        "-r",
        "trustRoot",
        "-k",
        systemKC,
        absCert,
      ],
      { stdio: "inherit" }
    );
    console.log("🔐 macOS: Dev cert trusted in system keychain.");
    return;
  } catch {}
  console.warn(
    "⚠️  macOS: Could not auto-trust in system keychain.\n" +
      "Try running the command manually:\n" +
      `  sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain ${certPath}`
  );
}

function tryTrustOnWindows(certPath: string) {
  try {
    execFileSync("certutil", ["-addstore", "-f", "Root", certPath], {
      stdio: "ignore",
    });
    console.log(
      "🔐 Windows: Dev cert added to Trusted Root Certification Authorities."
    );
  } catch {
    console.warn(
      "⚠️  Windows: Could not auto-trust dev cert.\n" +
        "Run PowerShell as Administrator:\n" +
        `  certutil -addstore -f Root "${certPath}"`
    );
  }
}

function hintTrustOnLinux(certPath: string) {
  console.warn(
    "ℹ️  Linux trust varies by distro/desktop.\n" +
      "Debian/Ubuntu (system-wide):\n" +
      `  sudo cp "${certPath}" /usr/local/share/ca-certificates/localhost-dev.crt && sudo update-ca-certificates\n\n` +
      "For NSS-based apps (Firefox):\n" +
      "  certutil -A -n 'localhost-dev' -t 'C,,' -i .certs/localhost-cert.pem -d sql:$HOME/.pki/nssdb"
  );
}

function autoTrustCert(certPath: string) {
  switch (process.platform) {
    case "darwin":
      return tryTrustOnMac(certPath);
    case "win32":
      return tryTrustOnWindows(certPath);
    default:
      return hintTrustOnLinux(certPath);
  }
}

export function getDevCert(): { key: Buffer; cert: Buffer } {
  ensureDir(CERT_DIR);

  if (fs.existsSync(KEY_PATH) && fs.existsSync(CERT_PATH)) {
    return { key: fs.readFileSync(KEY_PATH), cert: fs.readFileSync(CERT_PATH) };
  }

  console.log("🔐 Generating new self-signed dev certificate for localhost...");

  const attrs = [{ name: "commonName", value: "localhost" }];
  const pems = selfsigned.generate(attrs, {
    days: 365,
    keySize: 2048,
    algorithm: "sha256",
    extensions: [
      { name: "basicConstraints", cA: true },
      {
        name: "keyUsage",
        keyCertSign: true,
        digitalSignature: true,
        keyEncipherment: true,
      },
      { name: "extKeyUsage", serverAuth: true },
      {
        name: "subjectAltName",
        altNames: [
          { type: 2, value: "localhost" }, // DNS
          { type: 7, ip: "127.0.0.1" }, // IPv4
          { type: 7, ip: "::1" }, // IPv6
        ],
      },
    ],
  });

  fs.writeFileSync(KEY_PATH, pems.private);
  fs.writeFileSync(CERT_PATH, pems.cert);

  console.log(`✅ Dev cert created at .certs/ (valid 1 year)`);
  autoTrustCert(CERT_PATH);

  return { key: Buffer.from(pems.private), cert: Buffer.from(pems.cert) };
}
