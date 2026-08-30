# naxx-dnd5e-collection-2024

NAXX 的 Foundry VTT D&D5e 2024 房规合集包，包含物品、角色、表格、日志与宏等合集。

## 在 Foundry VTT 中安装

在“安装模组”窗口使用以下清单地址：

```text
https://github.com/naxx1426/naxx-dnd5e-collection-2024/releases/latest/download/module.json
```

安装后，Foundry 可以通过同一清单地址检查更新。这个仓库不会提交到 Foundry 官方模组目录，因此需要首次手动粘贴清单地址安装；后续可从 Foundry 的模组管理界面检查并安装新版。

## 资源路径

合集数据中原先以以下三个官方模组为根的资源引用：

```text
modules/dnd-dungeon-masters-guide/assets/
modules/dnd-monster-manual/assets/
modules/dnd-players-handbook/assets/
```

按照原始来源分别改为：

```text
modules/naxx-dnd5e-collection-2024/assets/dnd-dungeon-masters-guide/
modules/naxx-dnd5e-collection-2024/assets/dnd-monster-manual/
modules/naxx-dnd5e-collection-2024/assets/dnd-players-handbook/
```

当前共维护 2,420 条本模组资源引用，其中 DMG 617 条、MM 1,136 条、PHB 667 条：2,270 条由官方模组路径迁移而来，另有 150 条旧 PHB 本地引用按来源重新归类。迁移只改引用，不复制官方素材，因此在对应文件尚未放入上述目录时，缺失资源报告属于预期结果。具体缺失项记录在 [`data/asset-reference-report.json`](data/asset-reference-report.json)；测试会阻止旧的三个官方路径或不含来源目录的本模组资源路径重新进入 JSON 源数据和生成的合集数据库。

## 规则来源

模组通过 D&D5e 5.3 的原生 `flags.dnd5e.sourceBooks` 机制注册规则书：

```text
NoveilHomeRule
```

所有具有 `system.source` 的合集内容都统一使用该规则书、2024 规则和修订 1。来源配置窗口会在“规则书”下拉项中显示 `NoveilHomeRule`；`naxx` 继续作为模组、仓库和合集的技术标识，不与内容作者名混用。

## JSON 数据维护

`data/packs/` 是合集内容的可审查 JSON 源数据，按合集和 Foundry 记录类型分组；`packs/` 中的 LevelDB 数据库是由 JSON 生成的运行制品。常用流程：

```shell
# 从当前 packs 导出到 build/ 预览，不覆盖 JSON 源
npm run packs:export

# 明确接受 Foundry 内编辑后，更新 JSON 源并建立备份
node tools/export-packs-json.mjs --write

# 预览规则来源与资源路径迁移
npm run packs:migrate

# 写入迁移，然后从 JSON 预览构建 LevelDB
node tools/migrate-pack-json.mjs --write
npm run packs:build

# 确认后替换运行 packs，并自动备份旧数据库
node tools/build-packs-json.mjs --write
```

完整目录边界、编辑步骤、备份和验证规则见 [JSON 合集维护说明](docs/JSON_PACK_WORKFLOW.md)。

## 发布

推送形如 `v1.0.2` 的标签后，GitHub Actions 会运行校验并建立公开 Release。Release 标题使用版本标签，正文列出 Foundry 兼容版本与完整更新对比链接，自定义附件只保留：

- `module.json`
- `naxx-dnd5e-collection-2024.zip`

从新的 `v1.0.0` 基准版本开始不再单独上传 `SHA256SUMS.txt`。

具体步骤见 [发布说明](docs/PUBLISHING.md)。

## 权利说明

本仓库公开仅用于托管与个人 Foundry 更新分发；除各素材自身已经标明的许可外，仓库未额外授予复制、再分发或商用许可。
