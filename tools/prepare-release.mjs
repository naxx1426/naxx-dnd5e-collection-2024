import { cp, mkdir, readFile, readdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const manifest = JSON.parse(await readFile(path.join(root, "module.json"), "utf8"));
const packageJson = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
const tag = process.argv[2] ?? `v${manifest.version}`;
const expectedId = "naxx-dnd5e-collection-2024";
const repository = `https://github.com/naxx1426/${expectedId}`;

assert(manifest.id === expectedId, "Unexpected module id.");
assert(manifest.type === "module", "module.json type must be module.");
assert(manifest.version === packageJson.version, "module.json and package.json versions differ.");
assert(tag === `v${manifest.version}`, `Tag ${tag} does not match version ${manifest.version}.`);
assert(manifest.url === repository, "Repository URL is incorrect.");
assert(manifest.manifest === `${repository}/releases/latest/download/module.json`, "Manifest update URL is incorrect.");
assert(manifest.download === `${repository}/releases/download/${tag}/${expectedId}.zip`, "Download URL is incorrect.");
assert(!JSON.stringify(manifest).match(/@(?:gmail|qq)\.com/i), "Public manifest contains a personal email address.");

for (const pack of manifest.packs ?? []) {
  const packPath = path.join(root, pack.path);
  assert((await stat(packPath)).isDirectory(), `Missing pack directory: ${pack.path}`);
  assert((await stat(path.join(packPath, "CURRENT"))).isFile(), `Pack is missing CURRENT: ${pack.path}`);
}

const iconIndex = JSON.parse(await readFile(path.join(root, "data", "item-icons.json"), "utf8"));
assert(iconIndex.moduleId === expectedId, "Item icon index belongs to another module.");
assert(iconIndex.count === iconIndex.items.length, "Item icon index count is stale.");
assert(iconIndex.count > 0, "Item icon index is empty.");
const assetPrefixes = [
  "dnd-dungeon-masters-guide",
  "dnd-monster-manual",
  "dnd-players-handbook"
].map(sourceModule => `modules/${expectedId}/assets/${sourceModule}/`);
const seenIds = new Set();
for (const item of iconIndex.items) {
  assert(!seenIds.has(item.id), `Duplicate item id in icon index: ${item.id}`);
  seenIds.add(item.id);
  assert(assetPrefixes.some(prefix => item.img.startsWith(prefix)), `Unexpected item icon prefix: ${item.img}`);
}

const oldPrefixes = [
  "modules/dnd-dungeon-masters-guide/assets/",
  "modules/dnd-monster-manual/assets/",
  "modules/dnd-players-handbook/assets/"
].map(prefix => Buffer.from(prefix, "utf8"));
for (const pack of manifest.packs) {
  for (const file of await listFiles(path.join(root, pack.path))) {
    const contents = await readFile(file);
    for (const oldPrefix of oldPrefixes) {
      assert(
        !contents.includes(oldPrefix),
        `Old official asset prefix remains in current pack storage: ${path.relative(root, file)}`
      );
    }
  }
}

const runtimeEntries = ["assets", "packs", "module.json", "README.md", "CHANGELOG.md"];
const buildRoot = path.join(root, "build");
const packageRoot = path.join(buildRoot, "package");
await rm(buildRoot, { recursive: true, force: true });
await mkdir(packageRoot, { recursive: true });
for (const entry of runtimeEntries) {
  await cp(path.join(root, entry), path.join(packageRoot, entry), { recursive: true });
}
await cp(path.join(root, "module.json"), path.join(buildRoot, "module.json"));

const stagedFiles = await listFiles(packageRoot);
for (const file of stagedFiles) {
  const size = (await stat(file)).size;
  assert(size < 100 * 1024 * 1024, `GitHub rejects files at or above 100 MiB: ${path.relative(root, file)}`);
}

console.log(`Release metadata validated for ${tag}.`);
console.log(`Foundry package staged at ${packageRoot}.`);

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await listFiles(target));
    else if (entry.isFile()) files.push(target);
  }
  return files;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
