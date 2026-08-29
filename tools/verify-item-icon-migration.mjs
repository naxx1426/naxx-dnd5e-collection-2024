import { createRequire } from "node:module";
import path from "node:path";

const MODULE_ID = "naxx-dnd5e-collection-2024";
const OLD_PREFIX = "modules/dnd-players-handbook/assets/icons/";
const NEW_PREFIX = `modules/${MODULE_ID}/assets/icons/`;
const DEFAULT_FOUNDRY_APP = "C:\\Software\\Foundry Virtual Tabletop\\resources\\app";

const beforePath = requiredOption("--before");
const afterPath = requiredOption("--after");
const foundryApp = readOption("--foundry-app") ?? process.env.FOUNDRY_APP_PATH ?? DEFAULT_FOUNDRY_APP;
const requireFromFoundry = createRequire(path.join(foundryApp, "package.json"));
const { ClassicLevel } = requireFromFoundry("classic-level");

const before = await readDocuments(beforePath);
const after = await readDocuments(afterPath);
const allKeys = new Set([...before.keys(), ...after.keys()]);
const migrated = [];

for (const key of allKeys) {
  if (!before.has(key) || !after.has(key)) {
    throw new Error(`Pack key set changed at ${key}.`);
  }

  const original = before.get(key);
  const current = after.get(key);
  if (original.raw === current.raw) continue;
  if (!original.document || !current.document) {
    throw new Error(`Non-JSON record changed at ${key}.`);
  }

  const expectedImage = typeof original.document.img === "string" && original.document.img.startsWith(OLD_PREFIX)
    ? `${NEW_PREFIX}${original.document.img.slice(OLD_PREFIX.length)}`
    : original.document.img;
  const expected = { ...original.document, img: expectedImage };
  if (JSON.stringify(expected) !== JSON.stringify(current.document)) {
    throw new Error(`Unexpected field change at ${key}.`);
  }
  if (expectedImage === original.document.img) {
    throw new Error(`Unexpected rewritten record without an old item image at ${key}.`);
  }

  migrated.push({
    key,
    id: original.document._id ?? null,
    name: original.document.name ?? null,
    before: original.document.img,
    after: current.document.img,
  });
}

console.log(JSON.stringify({
  before: path.resolve(beforePath),
  after: path.resolve(afterPath),
  records: allKeys.size,
  migrated: migrated.length,
  unchanged: allKeys.size - migrated.length,
}, null, 2));

async function readDocuments(packPath) {
  const database = new ClassicLevel(path.resolve(packPath), {
    createIfMissing: false,
    errorIfExists: false,
    keyEncoding: "utf8",
    readOnly: true,
    valueEncoding: "utf8",
  });
  const documents = new Map();
  try {
    await database.open();
    for await (const [key, raw] of database.iterator()) {
      let document = null;
      try {
        document = JSON.parse(raw);
      } catch {
        // Foundry pack databases may include non-document metadata records.
      }
      documents.set(key, { raw, document });
    }
  } finally {
    await database.close();
  }
  return documents;
}

function readOption(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return null;
  const value = process.argv[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${name} requires a value.`);
  return value;
}

function requiredOption(name) {
  const value = readOption(name);
  if (!value) throw new Error(`${name} is required.`);
  return value;
}
