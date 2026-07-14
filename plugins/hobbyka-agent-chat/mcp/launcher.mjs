import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const platform = process.platform === "darwin" ? "darwin" : process.platform === "win32" ? "windows" : null;
const architecture = process.arch === "arm64" ? "arm64" : process.arch === "x64" ? "amd64" : null;

if (!platform || !architecture) {
  process.stderr.write("hobbyka-agent-chat: unsupported operating system or architecture\n");
  process.exit(1);
}

const pluginRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const executable = path.join(pluginRoot, "bin", `${platform}-${architecture}`, platform === "windows" ? "hchat.exe" : "hchat");
const child = spawn(executable, ["mcp"], { stdio: "inherit", windowsHide: true });

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}

child.once("error", (error) => {
  process.stderr.write(`hobbyka-agent-chat: ${error.message}\n`);
  process.exitCode = 1;
});
child.once("exit", (code) => {
  process.exitCode = code ?? 1;
});
