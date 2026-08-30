# naxx-dnd5e-collection-2024

NAXX 的 Foundry VTT D&D5e 2024 房规合集包，包含物品、角色、表格、日志与宏等合集。

## 在 Foundry VTT 中安装

在“安装模组”窗口使用以下清单地址：

```text
https://github.com/naxx1426/naxx-dnd5e-collection-2024/releases/latest/download/module.json
```

安装后，Foundry 可以通过同一清单地址检查更新。这个仓库不会提交到 Foundry 官方模组目录，因此需要首次手动粘贴清单地址安装；后续可从 Foundry 的模组管理界面检查并安装新版。

## 物品图标

`Naxx物品` 合集内由本模组提供的图标统一使用：

```text
modules/naxx-dnd5e-collection-2024/assets/icons/
```

图标迁移只处理 Item 文档自身的 `img` 字段，不会批量改写角色、日志、表格、宏或说明文本中出现的路径。维护脚本会验证每个索引图标都能在本模组中找到对应文件。

## 发布

推送形如 `v1.0.2` 的标签后，GitHub Actions 会运行校验并建立公开 Release。Release 标题使用版本标签，正文列出 Foundry 兼容版本与完整更新对比链接，自定义附件只保留：

- `module.json`
- `naxx-dnd5e-collection-2024.zip`

旧的 `v1.0.1` Release 仍保留额外的 `SHA256SUMS.txt`；从新的 `v1.0.0` 基准版本开始不再单独上传该文件。

具体步骤见 [发布说明](docs/PUBLISHING.md)。

## 权利说明

本仓库公开仅用于托管与个人 Foundry 更新分发；除各素材自身已经标明的许可外，仓库未额外授予复制、再分发或商用许可。
