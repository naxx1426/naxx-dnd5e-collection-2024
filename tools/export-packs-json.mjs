import { mkdir, rename, rm, writeFile } from "node:fs/promises";
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
  timestamp
} from "./pack-json-utils.mjs";

const write = hasOption("--write");
const requestedPack = readOption("--pack");
const sourceRoot = path.resolve(readOption("--packs") ?? path.join(moduleRoot, "packs"));
const stagedRoot = path.join(moduleRoot, "build", "exported-pack-sources");
const outputRoot = path.resolve(readOption("--output") ?? (write
  ? path.join(moduleRoot, "data", "packs")
  : stagedRoot));
const ClassicLevel = loadClassicLevel();
const packs = (manifest.packs ?? []).filter(pack => !requestedPack || pack.name === requestedPack);
assert(packs.length > 0, requestedPack ? `Unknown pack: ${requestedPack}` : "No packs configured.");
assert(!(write && requestedPack), "--write exports all packs together; omit --pack.");

const workingRoot = write ? stagedRoot : outputRoot;
await rm(workingRoot, { recursive: true, force: true });
await mkdir(workingRoot, { recursive: true });

const summary = [];
for (const pack of packs) {
  const database = new ClassicLevel(path.join(sourceRoot, pack.name), {
    createIfMissing: false,
    errorIfExists: false,
    keyEncoding: "utf8",
    readOnly: true,
    valueEncoding: "utf8"
  });
  const groups = new Map();
  try {
    await database.open();
    for await (const [key, raw] of database.iterator()) {
      let value;
      try {
        value = JSON.parse(raw);
      } catch (error) {
        throw new Error(`${pack.name} contains a non-JSON record at ${key}`, { cause: error });
      }
      const group = groupForKey(key);
      if (!groups.has(group)) groups.set(group, []);
      groups.get(group).push({ key, value });
    }
  } finally {
    await database.close();
  }

  const packDirectory = path.join(workingRoot, pack.name);
  const recordsDirectory = path.join(packDirectory, "records");
  await mkdir(recordsDirectory, { recursive: true });
  const groupIndex = [];
  let recordCount = 0;
  for (const [group, records] of [...groups.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    records.sort((left, right) => left.key.localeCompare(right.key, "en"));
    const file = `records/${group}.json`;
    await writeFile(path.join(packDirectory, file), `${JSON.stringify({
      schemaVersion: 1,
      moduleId: MODULE_ID,
      packId: pack.name,
      group,
      records
    }, null, 2)}\n`, "utf8");
    groupIndex.push({ group, file, count: records.length });
    recordCount += records.length;
  }

  await writeFile(path.join(packDirectory, "pack.json"), `${JSON.stringify({
    schemaVersion: 1,
    moduleId: MODULE_ID,
    pack: {
      id: pack.name,
      label: pack.label,
      type: pack.type,
      system: pack.system ?? null
    },
    recordCount,
    groups: groupIndex
  }, null, 2)}\n`, "utf8");
  summary.push({ pack: pack.name, recordCount, groups: groupIndex.length });
}

if (write) {
  const backupRoot = path.join(moduleRoot, "backups", `pack-json-before-export-${timestamp()}`);
  try {
    await rename(outputRoot, backupRoot);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  await mkdir(path.dirname(outputRoot), { recursive: true });
  await rename(stagedRoot, outputRoot);
}

console.log(JSON.stringify({
  mode: write ? "write" : "preview",
  sourceRoot,
  outputRoot,
  packs: summary
}, null, 2));
