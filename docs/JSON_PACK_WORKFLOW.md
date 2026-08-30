# JSON 合集维护说明

## 单一事实来源

本仓库将合集数据分为两层：

| 路径 | 角色 | 是否手工编辑 |
| --- | --- | --- |
| `data/packs/` | 按合集与记录类型分组的 JSON 源数据 | 是 |
| `packs/` | Foundry 运行所需的 LevelDB 数据库 | 否，由 JSON 生成 |

`data/packs/<pack-id>/pack.json` 保存合集索引、总记录数和分组文件；`records/*.json` 保存稳定排序的 `{ key, value }` 记录。嵌入物品、效果、日志页面和表格结果分别成组，避免把全部内容塞进一个超大文件。

## 日常修改

1. 在 `data/packs/` 中定位对应合集和记录组。
2. 通过文档 `_id`、名称、`system.identifier` 或其他稳定字段搜索目标记录。
3. 只编辑该记录的 `value`；不要修改 LevelDB `key`，除非确实在进行文档 ID 迁移。
4. 运行：

   ```shell
   npm test
   npm run packs:build
   ```

5. 预览构建成功后，将生成结果写回运行制品：

   ```shell
   node tools/build-packs-json.mjs --write
   ```

6. 再次运行 `npm test` 和 `npm run release:prepare`，检查 Git diff。

`--write` 会先把现有 `packs/` 移到 `backups/packs-before-json-build-<时间>/`。构建或替换失败时，工具会尝试恢复旧目录。

## 从 Foundry 导入编辑结果

如果先在 Foundry 界面编辑了合集，安装目录或工作区 `packs/` 会成为暂时的新数据来源。先关闭使用该数据库的世界，再执行：

```shell
npm run packs:export
```

默认只导出到 `build/exported-pack-sources/`，不会覆盖权威 JSON。审查预览后才执行：

```shell
node tools/export-packs-json.mjs --write
```

写入模式会把旧 `data/packs/` 备份到 `backups/pack-json-before-export-<时间>/`。因此误导出时仍能找回原 JSON，但不要把 `backups/` 提交到 Git。

## 资源路径迁移

以下来源前缀会被改写：

```text
modules/dnd-dungeon-masters-guide/assets/
modules/dnd-monster-manual/assets/
modules/dnd-players-handbook/assets/
```

按照原始来源分别改写为：

```text
modules/naxx-dnd5e-collection-2024/assets/dnd-dungeon-masters-guide/
modules/naxx-dnd5e-collection-2024/assets/dnd-monster-manual/
modules/naxx-dnd5e-collection-2024/assets/dnd-players-handbook/
```

迁移会递归处理 JSON 中的路径，包括文档 `img`、Token 纹理、主体图以及效果变更值。当前共维护 2,420 条本模组资源引用：DMG 617 条、MM 1,136 条、PHB 667 条。其中 2,270 条由三个官方模组路径迁移而来，另有 150 条旧 PHB 本地引用按来源重新归类。

完整素材由私有仓库 `naxx1426/naxx-dnd5e-collection-2024-assets` 通过 Git LFS 维护，公开仓库和公开 Release 不包含它们。公开仓库只保留原先已经分发的 142 个 PHB 图标，可满足 254 条引用；其余 2,166 条写入 `data/asset-reference-report.json`。私有仓库中的 `sync-to-foundry.ps1` 会把三套来源目录合并到已安装模组，不会删除其他文件。

迁移工具只改 JSON 引用，不主动从官方模组复制素材。目标文件不存在时仍会改写，并把具体合集、记录 key、字段路径、当前路径和期望路径写入报告。

预览与写入命令分别是：

```shell
npm run packs:migrate
node tools/migrate-pack-json.mjs --write
```

## 规则来源迁移

同一迁移工具会把所有已有 `system.source` 规范为：

```json
{
  "book": "NoveilHomeRule",
  "page": "",
  "custom": "",
  "license": "",
  "rules": "2024",
  "revision": 1
}
```

`module.json` 同时通过 D&D5e 原生清单字段注册 `NoveilHomeRule`，并给每个合集配置相同的默认 `sourceBook`。新增内容应直接使用这份结构，避免再次运行大范围迁移。

## 工具边界

- 工具从本机 Foundry 安装目录加载它已经附带的 `classic-level`，不为仓库增加原生 Node 依赖。
- 默认 Foundry 路径是 `C:\Software\Foundry Virtual Tabletop\resources\app`；其他安装位置可设置 `FOUNDRY_APP_PATH`，或传入 `--foundry-app`。
- 预览命令只写 `build/`；正式写入命令都要求显式 `--write`。
- GitHub Actions 不修改合集，只验证已提交的 JSON、LevelDB、清单、资源前缀和发布结构。
