#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const PROFILES_PATH = path.join(ROOT, "config", "brx-codex.profiles.json");

function readJsonSafe(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    const raw = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function parseArgs(argv) {
  const args = [...argv];
  const command = args.shift() || "help";
  const options = { profile: "semi", prompt: "", task: "", model: "", dryRun: false };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if ((arg === "--profile" || arg === "-p") && args[i + 1]) options.profile = args[++i];
    else if ((arg === "--task" || arg === "-t") && args[i + 1]) options.task = args[++i];
    else if ((arg === "--prompt" || arg === "-m") && args[i + 1]) options.prompt = args[++i];
    else if (arg === "--model" && args[i + 1]) options.model = args[++i];
    else if (arg === "--dry-run") options.dryRun = true;
  }

  return { command, options };
}

function printHelp() {
  console.log(`\nbrx-codex CLI\n\nUso:\n  brx-codex doctor\n  brx-codex run --task "corrigir bug no auth" --profile semi\n\nOpcoes:\n  --profile, -p   manual | semi | auto\n  --task, -t      objetivo da tarefa\n  --prompt, -m    prompt adicional\n  --model         modelo alvo no Codex (opcional)\n  --dry-run       nao executa codex, apenas mostra comando\n`);
}

function detectCodexBinary() {
  const candidates = process.platform === "win32" ? ["codex.cmd", "codex"] : ["codex"];
  for (const binary of candidates) {
    const probe = spawnSync(binary, ["--help"], { stdio: "ignore", shell: true });
    if (probe.status === 0) return binary;
  }
  return null;
}

function buildPrompt(profile, task, extraPrompt) {
  const objective = task || "Executar tarefa de engenharia de software com foco em qualidade e eficiencia";
  return [
    profile.systemPrompt,
    `Perfil: ${profile.autonomy}. Estrategia de tokens: ${profile.tokenStrategy}. Limite de tokens alvo: ${profile.maxTokens}.`,
    `Objetivo: ${objective}.`,
    extraPrompt ? `Contexto adicional: ${extraPrompt}.` : "",
    "Entregue resultado objetivo, com plano curto, execucao e verificacao final.",
  ].filter(Boolean).join("\n");
}

function runDoctor() {
  const codexBinary = detectCodexBinary();
  const profilesExists = fs.existsSync(PROFILES_PATH);

  console.log("[BRX-CODEX] Doctor");
  console.log(`OS: ${os.platform()} ${os.release()}`);
  console.log(`Codex CLI: ${codexBinary ? `OK (${codexBinary})` : "NAO ENCONTRADO"}`);
  console.log(`Perfis BRX: ${profilesExists ? "OK" : "FALTANDO"}`);

  if (!codexBinary) console.log("Instale com: npm install -g @openai/codex");
}

function runTask(options, profiles) {
  const profile = profiles[options.profile] || profiles.semi || profiles.manual || profiles.auto;
  if (!profile) {
    console.error("[BRX-CODEX] Nenhum perfil valido encontrado em config/brx-codex.profiles.json");
    process.exit(1);
  }

  const codexBinary = detectCodexBinary();
  if (!codexBinary) {
    console.error("[BRX-CODEX] Codex CLI nao encontrado no PATH.");
    process.exit(1);
  }

  const prompt = buildPrompt(profile, options.task, options.prompt);
  const args = ["exec", prompt];
  if (options.model) args.push("--model", options.model);

  console.log(`[BRX-CODEX] Perfil: ${options.profile}`);
  console.log(`[BRX-CODEX] Token budget alvo: ${profile.maxTokens}`);

  if (options.dryRun) {
    console.log("[BRX-CODEX] Dry run ativado. Comando preparado:");
    console.log(`${codexBinary} ${args.map((a) => JSON.stringify(a)).join(" ")}`);
    return;
  }

  const result = spawnSync(codexBinary, args, { stdio: "inherit", shell: true });
  process.exit(result.status ?? 0);
}

function main() {
  const { command, options } = parseArgs(process.argv.slice(2));
  const profiles = readJsonSafe(PROFILES_PATH, {});

  if (command === "doctor") runDoctor();
  else if (command === "run") runTask(options, profiles);
  else printHelp();
}

main();
