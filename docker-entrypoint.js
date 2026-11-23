#!/usr/bin/env bun

const { spawn } = require("node:child_process");

const command = process.argv.slice(2);
const children = [];

function start(program, args) {
  const child = spawn(program, args, { stdio: "inherit" });
  children.push(child);
  child.on("error", (error) => {
    console.error(error);
    stop();
    process.exitCode = 1;
  });
  return child;
}

function stop(signal = "SIGTERM") {
  for (const child of children) {
    child.kill(signal);
  }
}

process.on("SIGTERM", () => stop());
process.on("SIGINT", () => stop("SIGINT"));

if (command.join(" ") === "bun run start") {
  if (process.env.SCHEDULER_ENABLED === "true") {
    start(process.execPath, ["src/scheduler/index.ts"]);
  }
  if (process.env.ARCHIVAL_ENABLED === "true") {
    start(process.execPath, ["src/archiver/index.ts"]);
  }
  // Start Next directly so signals reach the web server.
  start(process.execPath, ["./node_modules/next/dist/bin/next", "start"]).on(
    "exit",
    onExit,
  );
} else {
  start(command[0], command.slice(1)).on("exit", onExit);
}

function onExit(code, signal) {
  stop();
  process.exitCode = code ?? (signal === "SIGTERM" ? 0 : 1);
}
