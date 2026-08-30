# naxx-dnd5e-collection-2024

NAXX 的 Foundry VTT D&D5e 2024 房规合集包，包含物品、角色、表格、日志与宏等合集。

## 在 Foundry VTT 中安装

在“安装模组”窗口使用以下清单地址：

```text
https://github.com/naxx1426/naxx-dnd5e-collection-2024/releases/latest/download/module.json
```

安装后，Foundry 可以通过同一清单地址检查更新。这个仓库不会提交到 Foundry 官方模组目录，因此需要首次手动粘贴清单地址安装；后续可从 Foundry 的模组管理界面检查并安装新版。

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

## 权利说明

本仓库公开仅用于托管与个人 Foundry 更新分发；除各素材自身已经标明的许可外，仓库未额外授予复制、再分发或商用许可。
