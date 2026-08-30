import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const manifest = JSON.parse(await readFile(path.join(root, "module.json"), "utf8"));
const report = JSON.parse(await readFile(path.join(root, "data", "asset-reference-report.json"), "utf8"));
const sourceBook = "NoveilHomeRule";
const oldPrefixes = [
  "modules/dnd-dungeon-masters-guide/assets/",
  "modules/dnd-monster-manual/assets/",
  "modules/dnd-players-handbook/assets/"
];
const localAssetPrefix = `modules/${manifest.id}/assets/`;
const expectedSourceBreakdown = {
  "dnd-dungeon-masters-guide": 617,
  "dnd-monster-manual": 1136,
  "dnd-players-handbook": 667
};

test("NoveilHomeRule 会由 D&D5e 原生来源注册机制载入", () => {
  assert.equal(manifest.flags.dnd5e.sourceBooks[sourceBook], sourceBook);
  for (const pack of manifest.packs) {
    assert.equal(pack.flags.dnd5e.sourceBook, sourceBook, pack.name);
  }
});

test("每个合集都具有可重建的分组 JSON 源数据", async () => {
  for (const pack of manifest.packs) {
    const directory = path.join(root, "data", "packs", pack.name);
    const packIndex = JSON.parse(await readFile(path.join(directory, "pack.json"), "utf8"));
    assert.equal(packIndex.schemaVersion, 1);
    assert.equal(packIndex.moduleId, manifest.id);
    assert.equal(packIndex.pack.id, pack.name);

    const keys = new Set();
    let count = 0;
    for (const group of packIndex.groups) {
      const source = JSON.parse(await readFile(path.join(directory, group.file), "utf8"));
      assert.equal(source.packId, pack.name);
      assert.equal(source.group, group.group);
      assert.equal(source.records.length, group.count);
      for (const record of source.records) {
        assert.equal(keys.has(record.key), false, `${pack.name}: ${record.key}`);
        keys.add(record.key);
        count += 1;
      }
    }
    assert.equal(count, packIndex.recordCount, pack.name);
  }
});

test("所有具有来源字段的规则内容统一使用 NoveilHomeRule 与 2024 规则", async () => {
  let sourceDocuments = 0;
  for await (const { pack, source } of packSources()) {
    for (const record of source.records) {
      const sourceData = record.value?.system?.source;
      if (!sourceData) continue;
      sourceDocuments += 1;
      assert.deepEqual(sourceData, {
        book: sourceBook,
        page: "",
        custom: "",
        license: "",
        rules: "2024",
        revision: 1
      }, `${pack}: ${record.key}`);
    }
  }
  assert.equal(sourceDocuments, report.sourceDocuments);
});

test("官方模组资源引用已按原规则书改写为本房规包路径", async () => {
  const localReferences = Object.fromEntries(
    Object.keys(expectedSourceBreakdown).map((source) => [source, 0])
  );
  for await (const { pack, source } of packSources()) {
    const serialized = JSON.stringify(source);
    for (const prefix of oldPrefixes) {
      assert.equal(serialized.includes(prefix), false, `${pack} still contains ${prefix}`);
    }
    for (const [sourceId] of Object.entries(expectedSourceBreakdown)) {
      const prefix = `${localAssetPrefix}${sourceId}/`;
      localReferences[sourceId] += serialized.split(prefix).length - 1;
    }
    const allLocalReferences = serialized.match(new RegExp(escapeRegExp(localAssetPrefix), "g"))?.length ?? 0;
    const scopedReferences = Object.keys(expectedSourceBreakdown).reduce((count, sourceId) => (
      count + serialized.split(`${localAssetPrefix}${sourceId}/`).length - 1
    ), 0);
    assert.equal(allLocalReferences, scopedReferences, `${pack} contains an unscoped module-local asset path`);
  }

  assert.deepEqual(localReferences, expectedSourceBreakdown);
  assert.equal(report.assetReferences, 2420);
  assert.equal(report.assetReferencesMigrated, 2420);
  assert.equal(report.inferredPlayerHandbook, 150);
  assert.deepEqual(report.sourceBreakdown, expectedSourceBreakdown);
  assert.equal(report.assetReferencesMissing, report.missingAssets.length);
  assert.equal(report.assetReferencesMissing, 2420);
});

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function* packSources() {
  for (const pack of manifest.packs) {
    const directory = path.join(root, "data", "packs", pack.name);
    const packIndex = JSON.parse(await readFile(path.join(directory, "pack.json"), "utf8"));
    for (const group of packIndex.groups) {
      yield {
        pack: pack.name,
        source: JSON.parse(await readFile(path.join(directory, group.file), "utf8"))
      };
    }
  }
}
