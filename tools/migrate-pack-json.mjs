import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  MODULE_ID,
  hasOption,
  loadClassicLevel,
  manifest,
  moduleRoot,
  readOption,
  sourceDirectoryForPack
} from "./pack-json-utils.mjs";

const SOURCE_BOOK = "NoveilHomeRule";
const TARGET_PREFIX = `modules/${MODULE_ID}/assets/`;
const SOURCE_MODULES = [
  "dnd-dungeon-masters-guide",
  "dnd-monster-manual",
  "dnd-players-handbook"
];
const SOURCE_PREFIXES = Object.fromEntries(SOURCE_MODULES.map(sourceModule => [
  sourceModule,
  `modules/${sourceModule}/assets/`
]));
const write = hasOption("--write");
const sourceRoot = path.join(moduleRoot, "data", "packs");
const originRoot = readOption("--origin-packs");
const originRecords = originRoot ? await loadOriginRecords(path.resolve(originRoot)) : new Map();
const previousOrigins = await loadPreviousOrigins();
const report = {
  schemaVersion: 1,
  moduleId: MODULE_ID,
  sourceBook: SOURCE_BOOK,
  mode: write ? "write" : "preview",
  sourceDocuments: 0,
  sourceDocumentsChanged: 0,
  assetReferences: 0,
  assetReferencesMigrated: 0,
  assetReferencesMissing: 0,
  inferredPlayerHandbook: 0,
  sourceBreakdown: Object.fromEntries(SOURCE_MODULES.map(sourceModule => [sourceModule, 0])),
  packs: [],
  missingAssets: []
};

for (const pack of manifest.packs ?? []) {
  const directory = sourceDirectoryForPack(pack.name, sourceRoot);
  const index = JSON.parse(await readFile(path.join(directory, "pack.json"), "utf8"));
  const packReport = {
    pack: pack.name,
    sourceDocuments: 0,
    sourceDocumentsChanged: 0,
    assetReferences: 0,
    assetReferencesMigrated: 0,
    assetReferencesMissing: 0,
    inferredPlayerHandbook: 0,
    sourceBreakdown: Object.fromEntries(SOURCE_MODULES.map(sourceModule => [sourceModule, 0]))
  };

  for (const group of index.groups) {
    const filePath = path.join(directory, group.file);
    const source = JSON.parse(await readFile(filePath, "utf8"));
    let fileChanged = false;
    for (const record of source.records) {
      const sourceData = record.value?.system?.source;
      if (sourceData && typeof sourceData === "object" && !Array.isArray(sourceData)) {
        packReport.sourceDocuments += 1;
        const desired = {
          book: SOURCE_BOOK,
          page: "",
          custom: "",
          license: "",
          rules: "2024",
          revision: 1
        };
        if (JSON.stringify(sourceData) !== JSON.stringify(desired)) {
          record.value.system.source = desired;
          packReport.sourceDocumentsChanged += 1;
          fileChanged = true;
        }
      }

      const assetResult = await migrateAssets(
        record.value,
        originRecords.get(pack.name)?.get(record.key),
        {
        pack: pack.name,
        key: record.key,
        path: [],
        write
        }
      );
      packReport.assetReferences += assetResult.references;
      packReport.assetReferencesMigrated += assetResult.migrated;
      packReport.assetReferencesMissing += assetResult.missing;
      packReport.inferredPlayerHandbook += assetResult.inferredPlayerHandbook;
      for (const sourceModule of SOURCE_MODULES) {
        packReport.sourceBreakdown[sourceModule] += assetResult.sourceBreakdown[sourceModule];
      }
      fileChanged ||= assetResult.changed;
    }
    if (write && fileChanged) {
      await writeFile(filePath, `${JSON.stringify(source, null, 2)}\n`, "utf8");
    }
  }

  report.packs.push(packReport);
  for (const key of [
    "sourceDocuments",
    "sourceDocumentsChanged",
    "assetReferences",
    "assetReferencesMigrated",
    "assetReferencesMissing",
    "inferredPlayerHandbook"
  ]) report[key] += packReport[key];
  for (const sourceModule of SOURCE_MODULES) {
    report.sourceBreakdown[sourceModule] += packReport.sourceBreakdown[sourceModule];
  }
}

report.missingAssets.sort((left, right) => (
  left.expected.localeCompare(right.expected, "en")
  || left.pack.localeCompare(right.pack, "en")
  || left.key.localeCompare(right.key, "en")
));
const reportPath = path.join(moduleRoot, "data", "asset-reference-report.json");
if (write) {
  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}
console.log(JSON.stringify({ ...report, missingAssets: undefined, reportPath }, null, 2));

async function migrateAssets(value, originValue, context) {
  const result = {
    references: 0,
    migrated: 0,
    missing: 0,
    changed: false,
    inferredPlayerHandbook: 0,
    sourceBreakdown: Object.fromEntries(SOURCE_MODULES.map(sourceModule => [sourceModule, 0]))
  };
  if (typeof value === "string") return result;
  if (!value || typeof value !== "object") return result;

  for (const [key, child] of Object.entries(value)) {
    const childPath = [...context.path, key];
    if (typeof child === "string") {
      const location = locationKey(context.pack, context.key, childPath);
      const resolved = resolveAssetReference(
        child,
        originValue?.[key],
        previousOrigins.get(location)
      );
      if (!resolved) continue;
      result.references += 1;
      result.sourceBreakdown[resolved.sourceModule] += 1;
      if (resolved.inferred) result.inferredPlayerHandbook += 1;
      const expected = `${TARGET_PREFIX}${resolved.sourceModule}/${resolved.suffix}`;
      const assetExists = await exists(path.join(
        moduleRoot,
        "assets",
        resolved.sourceModule,
        resolved.suffix
      ));
      if (!assetExists) {
        result.missing += 1;
        report.missingAssets.push({
          pack: context.pack,
          key: context.key,
          path: childPath.join("."),
          current: child,
          expected
        });
      }
      if (child !== expected) {
        result.migrated += 1;
        if (context.write) {
          value[key] = expected;
          result.changed = true;
        }
      }
      continue;
    }
    const nested = await migrateAssets(child, originValue?.[key], { ...context, path: childPath });
    result.references += nested.references;
    result.migrated += nested.migrated;
    result.missing += nested.missing;
    result.inferredPlayerHandbook += nested.inferredPlayerHandbook;
    for (const sourceModule of SOURCE_MODULES) {
      result.sourceBreakdown[sourceModule] += nested.sourceBreakdown[sourceModule];
    }
    result.changed ||= nested.changed;
  }
  return result;
}

function resolveAssetReference(current, origin, reportedOrigin) {
  for (const [sourceModule, prefix] of Object.entries(SOURCE_PREFIXES)) {
    if (current.startsWith(prefix)) {
      return { sourceModule, suffix: current.slice(prefix.length), inferred: false };
    }
  }
  if (!current.startsWith(TARGET_PREFIX)) return null;

  const remainder = current.slice(TARGET_PREFIX.length);
  const scopedModule = SOURCE_MODULES.find(sourceModule => remainder.startsWith(`${sourceModule}/`));
  if (scopedModule) {
    return {
      sourceModule: scopedModule,
      suffix: remainder.slice(scopedModule.length + 1),
      inferred: false
    };
  }

  for (const candidate of [origin, reportedOrigin]) {
    if (typeof candidate !== "string") continue;
    for (const [sourceModule, prefix] of Object.entries(SOURCE_PREFIXES)) {
      if (candidate.startsWith(prefix)) {
        return { sourceModule, suffix: remainder, inferred: false };
      }
    }
  }

  return {
    sourceModule: "dnd-players-handbook",
    suffix: remainder,
    inferred: true
  };
}

function locationKey(pack, key, fieldPath) {
  return `${pack}\u0000${key}\u0000${fieldPath.join(".")}`;
}

async function loadPreviousOrigins() {
  const reportPath = path.join(moduleRoot, "data", "asset-reference-report.json");
  try {
    const previous = JSON.parse(await readFile(reportPath, "utf8"));
    return new Map((previous.missingAssets ?? []).map(entry => [
      locationKey(entry.pack, entry.key, String(entry.path).split(".")),
      entry.current
    ]));
  } catch (error) {
    if (error?.code === "ENOENT") return new Map();
    throw error;
  }
}

async function loadOriginRecords(packsRoot) {
  const ClassicLevel = loadClassicLevel();
  const result = new Map();
  for (const pack of manifest.packs ?? []) {
    const records = new Map();
    const database = new ClassicLevel(path.join(packsRoot, pack.name), {
      createIfMissing: false,
      errorIfExists: false,
      keyEncoding: "utf8",
      readOnly: true,
      valueEncoding: "utf8"
    });
    try {
      await database.open();
      for await (const [key, raw] of database.iterator()) records.set(key, JSON.parse(raw));
    } finally {
      await database.close();
    }
    result.set(pack.name, records);
  }
  return result;
}

async function exists(filePath) {
  try {
    return (await stat(filePath)).isFile();
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}
