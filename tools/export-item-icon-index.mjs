import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MODULE_ID = "naxx-dnd5e-collection-2024";
const ICON_PREFIX = `modules/${MODULE_ID}/assets/icons/`;
const DEFAULT_FOUNDRY_APP = "C:\\Software\\Foundry Virtual Tabletop\\resources\\app";
const moduleRoot = fileURLToPath(new URL("..", import.meta.url));
const packPath = path.resolve(readOption("--pack") ?? path.join(moduleRoot, "packs", "naxx-homerule-item"));
const outputPath = path.resolve(readOption("--output") ?? path.join(moduleRoot, "data", "item-icons.json"));
const foundryApp = readOption("--foundry-app") ?? process.env.FOUNDRY_APP_PATH ?? DEFAULT_FOUNDRY_APP;
const requireFromFoundry = createRequire(path.join(foundryApp, "package.json"));
const { ClassicLevel } = requireFromFoundry("classic-level");
const database = new ClassicLevel(packPath, {
  createIfMissing: false,
  errorIfExists: false,
  keyEncoding: "utf8",
  readOnly: true,
  valueEncoding: "utf8",
});
const items = [];

try {
  await database.open();
  for await (const [, raw] of database.iterator()) {
    let document;
    try {
      document = JSON.parse(raw);
    } catch {
      continue;
    }
    if (typeof document?.img !== "string" || !document.img.startsWith(ICON_PREFIX)) continue;
    items.push({ id: document._id, name: document.name, img: document.img });
  }
} finally {
  await database.close();
}

items.sort((left, right) => left.id.localeCompare(right.id, "en"));
await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify({
  schemaVersion: 1,
  moduleId: MODULE_ID,
  pack: "naxx-homerule-item",
  iconPrefix: ICON_PREFIX,
  count: items.length,
  items,
}, null, 2)}\n`, "utf8");
console.log(`Wrote ${items.length} item icons to ${outputPath}.`);

function readOption(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return null;
  const value = process.argv[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${name} requires a value.`);
  return value;
}
