import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const manifest = JSON.parse(await readFile(path.join(root, "module.json"), "utf8"));
const iconIndex = JSON.parse(await readFile(path.join(root, "data", "item-icons.json"), "utf8"));

test("Foundry 更新清单和下载地址与版本一致", () => {
  assert.equal(manifest.id, "naxx-dnd5e-collection-2024");
  assert.equal(manifest.type, "module");
  assert.equal(manifest.manifest, `${manifest.url}/releases/latest/download/module.json`);
  const tag = `v${manifest.version}`;
  const expected = `${manifest.url}/releases/download/${tag}/module.zip`;
  const legacy = `${manifest.url}/releases/download/${tag}/${manifest.id}.zip`;
  assert.equal(manifest.download, manifest.version === "1.0.1" ? legacy : expected);
});

test("清单中的每个合集数据库都存在", async () => {
  for (const pack of manifest.packs) {
    assert.equal((await stat(path.join(root, pack.path))).isDirectory(), true, pack.path);
    assert.equal((await stat(path.join(root, pack.path, "CURRENT"))).isFile(), true, pack.path);
  }
});

test("物品图标索引只使用本模组路径且文件全部存在", async () => {
  assert.equal(iconIndex.count, 150);
  assert.equal(iconIndex.items.length, iconIndex.count);
  assert.equal(new Set(iconIndex.items.map((item) => item.id)).size, iconIndex.count);
  const prefix = `modules/${manifest.id}/`;
  for (const item of iconIndex.items) {
    assert.match(item.img, new RegExp(`^modules/${manifest.id}/assets/icons/`));
    assert.equal((await stat(path.join(root, item.img.slice(prefix.length)))).isFile(), true, item.img);
  }
});

test("公开清单不包含个人邮箱", () => {
  assert.doesNotMatch(JSON.stringify(manifest), /@(?:gmail|qq)\.com/i);
});
