# 发布说明

## 发布前

1. 更新 `module.json` 与 `package.json` 中的版本号。
2. 将 `module.json.download` 更新为相同版本的标签 URL。
3. Foundry 未使用合集数据库时，运行 `npm run icons:refresh` 刷新图标索引。
4. 运行 `npm test`。
5. 运行 `npm run release:prepare`，检查 `build/package`。

## 发布

提交并推送代码后，创建与版本号一致的标签，例如：

```text
v1.0.1
```

推送标签会触发 `.github/workflows/release.yml`。工作流会重新运行校验，建立根目录布局正确的 Foundry 安装包，并发布公开 Release。

## Foundry 更新地址

```text
https://github.com/naxx1426/naxx-dnd5e-collection-2024/releases/latest/download/module.json
```

仓库与 Release 可以保持公开，但不需要提交到 Foundry 官方模组目录。
