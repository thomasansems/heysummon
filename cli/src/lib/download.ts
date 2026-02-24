import * as https from "https";
import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";
import { getAppDir, ensureDir } from "./config";

const GITHUB_API = "https://api.github.com";
const REPO = "thomasansems/heysummon";

interface GithubRelease {
  tag_name: string;
  assets: Array<{
    name: string;
    browser_download_url: string;
  }>;
  tarball_url: string;
}

function httpsGet(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const options = {
      headers: { "User-Agent": "heysummon-cli" },
    };
    https
      .get(url, options, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          const location = res.headers.location;
          if (location) {
            httpsGet(location).then(resolve, reject);
            return;
          }
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} for ${url}`));
          return;
        }
        let data = "";
        res.on("data", (chunk: Buffer) => (data += chunk.toString()));
        res.on("end", () => resolve(data));
      })
      .on("error", reject);
  });
}

function httpsDownload(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const options = {
      headers: { "User-Agent": "heysummon-cli" },
    };
    https
      .get(url, options, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          const location = res.headers.location;
          if (location) {
            httpsDownload(location, dest).then(resolve, reject);
            return;
          }
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} for ${url}`));
          return;
        }
        const file = fs.createWriteStream(dest);
        res.pipe(file);
        file.on("finish", () => {
          file.close();
          resolve();
        });
      })
      .on("error", reject);
  });
}

export async function getLatestRelease(): Promise<GithubRelease> {
  const data = await httpsGet(
    `${GITHUB_API}/repos/${REPO}/releases/latest`
  );
  return JSON.parse(data) as GithubRelease;
}

export async function downloadAndExtract(): Promise<string> {
  const release = await getLatestRelease();
  const version = release.tag_name;

  console.log(`  Downloading HeySummon ${version}...`);

  // Look for a tarball asset first, fall back to source tarball
  const tarballAsset = release.assets.find((a) => a.name.endsWith(".tar.gz"));
  const downloadUrl = tarballAsset
    ? tarballAsset.browser_download_url
    : release.tarball_url;

  const appDir = getAppDir();
  const tmpFile = path.join(path.dirname(appDir), `heysummon-${version}.tar.gz`);

  await httpsDownload(downloadUrl, tmpFile);

  // Clean existing app dir and extract
  if (fs.existsSync(appDir)) {
    fs.rmSync(appDir, { recursive: true });
  }
  ensureDir(appDir);

  console.log("  Extracting...");
  execSync(`tar -xzf "${tmpFile}" -C "${appDir}" --strip-components=1`, {
    stdio: "pipe",
  });

  // Clean up tarball
  fs.unlinkSync(tmpFile);

  return version;
}
