#!/usr/bin/env node
/**
 * Install AptWatch launcher as a macOS LaunchAgent (runs on login).
 * Uninstall: launchctl bootout gui/$UID ~/Library/LaunchAgents/com.aptwatch.launcher.plist
 */
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

if (process.platform !== "darwin") {
  console.error("launcher:install is only supported on macOS.");
  process.exit(1);
}

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const launcher = join(root, "scripts", "launcher.mjs");
const node = process.execPath;
const agentsDir = join(homedir(), "Library", "LaunchAgents");
const plistPath = join(agentsDir, "com.aptwatch.launcher.plist");
const logDir = join(homedir(), "Library", "Logs", "AptWatch");

mkdirSync(agentsDir, { recursive: true });
mkdirSync(logDir, { recursive: true });

const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.aptwatch.launcher</string>
  <key>ProgramArguments</key>
  <array>
    <string>${node}</string>
    <string>${launcher}</string>
  </array>
  <key>WorkingDirectory</key>
  <string>${root}</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string>
  </dict>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${join(logDir, "launcher.log")}</string>
  <key>StandardErrorPath</key>
  <string>${join(logDir, "launcher-error.log")}</string>
</dict>
</plist>
`;

writeFileSync(plistPath, plist, "utf8");

try {
  execSync(`launchctl bootout gui/${process.getuid()} "${plistPath}"`, { stdio: "ignore" });
} catch {
  // Not loaded yet.
}

execSync(`launchctl bootstrap gui/${process.getuid()} "${plistPath}"`);
console.log("AptWatch launcher installed.");
console.log(`  Plist: ${plistPath}`);
console.log(`  Logs:  ${logDir}`);
console.log("The extension can now start the backend when you open it.");
