import { mkdir, readFile, rename, rm } from "node:fs/promises";
import path from "node:path";

import {
  MODULE_ID,
  assert,
  groupForKey,
  hasOption,
  loadClassicLevel,
  manifest,
  moduleRoot,
  readOption,
  sourceDirectoryForPack,
  timestamp
} from "./pack-json-utils.mjs";

const write = hasOption("--write");
const requestedPack = readOption("--pack");
const sourceRoot = path.resolve(readOption("--source") ?? path.join(moduleRoot, "data", "packs"));
const stagedRoot = path.resolve(readOption("--output") ?? path.join(moduleRoot, "build", "generated-packs"));
const targetRoot = path.resolve(readOption("--packs") ?? path.join(moduleRoot, "packs"));
const ClassicLevel = loadClassicLevel();
const packs = (manifest.packs ?? []).filter(pack => !requestedPack || pack.name === requestedPack);
assert(packs.length > 0, requestedPack ? `Unknown pack: ${requestedPack}` : "No packs configured.");

await rm(stagedRoot, { recursive: true, force: true });
await mkdir(stagedRoot, { recursive: true });
const summary = [];

for (const pack of packs) {
  const sourceDirectory = sourceDirectoryForPack(pack.name, sourceRoot);
  const packIndex = JSON.parse(await readFile(path.join(sourceDirectory, "pack.json"), "utf8"));
  assert(packIndex.schemaVersion === 1, `${pack.name} has an unsupported schemaVersion.`);
  assert(packIndex.moduleId === MODULE_ID, `${pack.name} belongs to another module.`);
  assert(packIndex.pack.id === pack.name, `${pack.name} pack id mismatch.`);

  const operations = [];
  const keys = new Set();
  for (const groupEntry of packIndex.groups) {
    const groupSource = JSON.parse(await readFile(path.join(sourceDirectory, groupEntry.file), "utf8"));
    assert(groupSource.schemaVersion === 1, `${pack.name}/${groupEntry.file} schema mismatch.`);
    assert(groupSource.packId === pack.name, `${pack.name}/${groupEntry.file} pack mismatch.`);
    assert(groupSource.group === groupEntry.group, `${pack.name}/${groupEntry.file} group mismatch.`);
    assert(groupSource.records.length === groupEntry.count, `${pack.name}/${groupEntry.file} count is stale.`);
    for (const record of groupSource.records) {
      assert(groupForKey(record.key) === groupEntry.group, `${record.key} is stored in the wrong group.`);
      assert(!keys.has(record.key), `${pack.name} contains duplicate key ${record.key}.`);
      keys.add(record.key);
      operations.push({ type: "put", key: record.key, value: JSON.stringify(record.value) });
    }
  }
  assert(operations.length === packIndex.recordCount, `${pack.name} recordCount is stale.`);

  const packPath = path.join(stagedRoot, pack.name);
  const database = new ClassicLevel(packPath, {
    createIfMissing: true,
    errorIfExists: false,
    keyEncoding: "utf8",
    valueEncoding: "utf8"
  });
  try {
    await database.open();
    if (operations.length) await database.batch(operations);
    await database.compactRange("\u0000", "\uffff");
  } finally {
    await database.close();
  }
  summary.push({ pack: pack.name, records: operations.length });
}

if (write) {
  assert(!requestedPack, "--write currently rebuilds all packs together; omit --pack.");
  const backupRoot = path.join(moduleRoot, "backups", `packs-before-json-build-${timestamp()}`);
  await mkdir(path.dirname(backupRoot), { recursive: true });
  await rename(targetRoot, backupRoot);
  try {
    await rename(stagedRoot, targetRoot);
  } catch (error) {
    await rename(backupRoot, targetRoot);
    throw error;
  }
}

console.log(JSON.stringify({
  mode: write ? "write" : "preview",
  sourceRoot,
  outputRoot: write ? targetRoot : stagedRoot,
  packs: summary
}, null, 2));
