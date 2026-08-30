import { createRequire } from "node:module";
import path from "node:path";

const MODULE_ID = "naxx-dnd5e-collection-2024";
const OLD_PREFIX = "modules/dnd-players-handbook/assets/icons/";
const NEW_PREFIX = `modules/${MODULE_ID}/assets/dnd-players-handbook/icons/`;
const DEFAULT_PACK = path.resolve("packs", "naxx-homerule-item");
const DEFAULT_FOUNDRY_APP = "C:\\Software\\Foundry Virtual Tabletop\\resources\\app";

const write = process.argv.includes("--write");
const verbose = process.argv.includes("--verbose");
const packArg = readOption("--pack") ?? DEFAULT_PACK;
const foundryApp = readOption("--foundry-app") ?? process.env.FOUNDRY_APP_PATH ?? DEFAULT_FOUNDRY_APP;
const packPath = path.resolve(packArg);

const requireFromFoundry = createRequire(path.join(foundryApp, "package.json"));
const { ClassicLevel } = requireFromFoundry("classic-level");
const database = new ClassicLevel(packPath, {
  createIfMissing: false,
  errorIfExists: false,
  keyEncoding: "utf8",
  readOnly: !write,
  valueEncoding: "utf8",
});

const matches = [];
let newPrefixMatched = 0;

try {
  await database.open();

  for await (const [key, rawValue] of database.iterator()) {
    let document;
    try {
      document = JSON.parse(rawValue);
    } catch {
      continue;
    }

    if (!document || typeof document !== "object") continue;
    if (typeof document.img !== "string") continue;
    if (document.img.startsWith(NEW_PREFIX)) newPrefixMatched += 1;
    if (!document.img.startsWith(OLD_PREFIX)) continue;

    const originalSerialization = JSON.stringify(document);
    if (originalSerialization !== rawValue) {
      throw new Error(`Refusing to rewrite ${key}: its JSON serialization is not byte-stable.`);
    }

    const nextImage = `${NEW_PREFIX}${document.img.slice(OLD_PREFIX.length)}`;
    document.img = nextImage;
    matches.push({
      key,
      id: document._id ?? null,
      name: document.name ?? null,
      before: `${OLD_PREFIX}${nextImage.slice(NEW_PREFIX.length)}`,
      after: nextImage,
      value: JSON.stringify(document),
    });
  }

  if (write && matches.length) {
    await database.batch(matches.map(({ key, value }) => ({ type: "put", key, value })));
  }
  if (write) {
    await database.compactRange("\u0000", "\uffff");
  }
} finally {
  await database.close();
}

console.log(JSON.stringify({
  mode: write ? "write" : "check",
  pack: packPath,
  oldPrefix: OLD_PREFIX,
  newPrefix: NEW_PREFIX,
  matched: matches.length,
  alreadyMigrated: newPrefixMatched,
  items: verbose ? matches.map(({ value: _value, ...item }) => item) : undefined,
}, null, 2));

function readOption(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return null;
  const value = process.argv[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${name} requires a value.`);
  return value;
}
