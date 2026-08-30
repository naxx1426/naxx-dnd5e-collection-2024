import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const MODULE_ID = "naxx-dnd5e-collection-2024";
export const DEFAULT_FOUNDRY_APP = "C:\\Software\\Foundry Virtual Tabletop\\resources\\app";
export const moduleRoot = fileURLToPath(new URL("..", import.meta.url));
export const manifest = JSON.parse(await readFile(path.join(moduleRoot, "module.json"), "utf8"));

export function readOption(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return null;
  const value = process.argv[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${name} requires a value.`);
  return value;
}

export function hasOption(name) {
  return process.argv.includes(name);
}

export function loadClassicLevel() {
  const foundryApp = readOption("--foundry-app")
    ?? process.env.FOUNDRY_APP_PATH
    ?? DEFAULT_FOUNDRY_APP;
  const requireFromFoundry = createRequire(path.join(foundryApp, "package.json"));
  try {
    return requireFromFoundry("classic-level").ClassicLevel;
  } catch (error) {
    throw new Error(
      `Unable to load classic-level from Foundry at ${foundryApp}. `
      + "Set FOUNDRY_APP_PATH or pass --foundry-app.",
      { cause: error }
    );
  }
}

export function groupForKey(key) {
  return String(key).match(/^!([^!]+)!/)?.[1] ?? "metadata";
}

export function sourceDirectoryForPack(packName, root = path.join(moduleRoot, "data", "packs")) {
  return path.join(root, packName);
}

export function assert(condition, message) {
  if (!condition) throw new Error(message);
}

export function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}
