import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const manifest = JSON.parse(await readFile(path.join(root, "module.json"), "utf8"));
const iconIndex = JSON.parse(await readFile(path.join(root, "data", "item-icons.json"), "utf8"));
const assetSources = [
  "dnd-dungeon-masters-guide",
  "dnd-monster-manual",
  "dnd-players-handbook"
];

test("Foundry 更新清单和下载地址与版本一致", () => {
  assert.equal(manifest.id, "naxx-dnd5e-collection-2024");
  assert.equal(manifest.type, "module");
  assert.equal(manifest.manifest, `${manifest.url}/releases/latest/download/module.json`);
  assert.equal(manifest.download, `${manifest.url}/releases/download/v${manifest.version}/${manifest.id}.zip`);
});

test("清单中的每个合集数据库都存在", async () => {
  for (const pack of manifest.packs) {
    assert.equal((await stat(path.join(root, pack.path))).isDirectory(), true, pack.path);
    assert.equal((await stat(path.join(root, pack.path, "CURRENT"))).isFile(), true, pack.path);
  }
});

test("物品图标索引只使用按规则书区分的本模组路径", () => {
  const assetPrefix = `modules/${manifest.id}/assets/`;
  assert.equal(iconIndex.assetPrefix, assetPrefix);
  assert.ok(iconIndex.count > 0);
  assert.equal(iconIndex.items.length, iconIndex.count);
  assert.equal(new Set(iconIndex.items.map((item) => item.id)).size, iconIndex.count);
  for (const item of iconIndex.items) {
    assert.ok(
      assetSources.some((source) => item.img.startsWith(`${assetPrefix}${source}/`)),
      item.img
    );
  }
});

test("公开清单不包含个人邮箱", () => {
  assert.doesNotMatch(JSON.stringify(manifest), /@(?:gmail|qq)\.com/i);
});
