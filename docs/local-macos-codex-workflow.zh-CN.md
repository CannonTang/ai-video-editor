# macOS 本地静态 App 与 Codex 工作流

本方案把 Timeline Studio 安装为 macOS 按需本地静态应用，并把仓库命令层接入本机 Codex。目标是单机使用，不创建登录项、LaunchAgent、守护进程或永久监听端口的服务。

English version: [local-macos-codex-workflow.md](local-macos-codex-workflow.md)

## 架构

```text
Timeline Studio Local.app
  ├─ 内嵌生产版 dist
  ├─ 内嵌零依赖静态文件服务器
  └─ 原生启动器
       ├─ 仅在 App 运行期间启动 Node
       ├─ 只监听 http://127.0.0.1:4173
       └─ 用 Safari 打开本地页面

Codex
  ├─ edit-timeline-studio Skill → 指向仓库内 Skill
  └─ timeline_studio_local MCP → 执行仓库 npm run mcp
```

App 与 Codex 共用同一份源码检出，但执行路径相互独立：

- 人工使用时，从 Dock 打开 App。App 启动内嵌静态服务器、打开 Safari，并在 App 退出时停止服务器。
- Codex 对受支持的工程检查、事务编辑、本地媒体导入和无头渲染直接使用 CLI/MCP，不依赖 Safari。
- 只有 CLI/MCP 暂不支持的高级操作才需要本地编辑器 UI 和浏览器控制。

## “离线”的边界

生产版 HTML、JavaScript、CSS、WASM 运行文件、图标和仓库内置媒体会复制到 App。打开编辑器时不会访问线上 Timeline Studio 网站。

仓库没有打包所有大型 AI 模型。AI 音乐、ASR、TTS、修复、换脸等模型能力首次使用时可能仍需联网下载；同一浏览器 Origin 下成功缓存后可以复用。只使用本地媒体、`.timeline`、FFmpeg 和官方已支持无头渲染子集的 Codex 任务，不需要下载这些浏览器模型。

## 安全与生命周期

- 静态服务器只绑定 `127.0.0.1`，并校验 HTTP `Host`。
- 只允许读取 App 内嵌 `Site` 目录，拒绝路径穿越。
- 返回浏览器媒体 Worker 所需的 COOP、COEP 和 CORP 隔离响应头。
- 只有 `Timeline Studio Local.app` 启动后才开放端口。
- 退出 App 时先发送 `SIGTERM`，超时才执行有界强制终止。
- 安装器不会创建 LaunchAgent、LaunchDaemon、登录项、计划任务或 shell 配置。
- App 使用本地 ad-hoc 签名，不是 Developer ID 签名，也未公证。

## 环境要求

- macOS 13 或更高版本
- Safari
- Node.js 20 或更高版本
- npm
- 含 `swiftc` 的 Xcode Command Line Tools
- Codex 无头媒体流程需要 FFmpeg 与 FFprobe
- 全局注册 MCP 需要 Codex CLI

首次使用前运行只读环境检查：

```bash
npm run skill:doctor
```

除非已经审阅安装计划并明确同意安装缺失依赖，否则不要运行 `npm run skill:setup`。

## 构建与安装

在仓库根目录执行：

```bash
npm ci
npm run local:app:install
```

安装器会：

1. 构建 Vite 生产版 `dist`。
2. 编译原生 Swift 启动器。
3. 把 `dist` 和静态服务器内嵌到 App。
4. 生成 ad-hoc 签名。
5. 使用 `ditto` 打包 zip，并在解压后再次验证签名。
6. 如果已安装的启动器正在运行，先正常退出它，再安装到 `/Applications/Timeline Studio Local.app`。
7. 注销构建包和被替换旧包的 LaunchServices 记录；旧包以可恢复的 `.app.retired` 后缀移入废纸篓，只登记正式安装包。
8. 刷新 Dock 文件书签、重启 Dock 并启动 App，避免更新后出现同名问号项。

只构建、不安装：

```bash
npm run local:app:build
```

构建产物位于 `.artifacts/macos-local/`，该目录已被 Git 忽略。

常用安装参数：

```bash
bash scripts/macos-local/install-app.sh --no-launch
bash scripts/macos-local/install-app.sh --no-dock
bash scripts/macos-local/install-app.sh --skip-build
bash scripts/macos-local/install-app.sh --install-dir "$HOME/Applications"
```

App 会记录构建时 Node 的绝对路径。如果以后删除或迁移该 Node 安装，需要重新构建 App。

## 运行方式

从 Dock 打开 `Timeline Studio Local`，Safari 会访问：

```text
http://127.0.0.1:4173/
```

只关闭 Safari 标签页不会退出启动器。请从 Dock 或应用菜单退出 `Timeline Studio Local`，本地静态服务器才会停止。App 仍在运行时再次点击 Dock 图标，会重新在 Safari 打开页面。

启动器日志位于：

```text
~/Library/Logs/Timeline Studio Local/preview.log
```

## Codex 接入

安装仓库 Skill 链接和全局 STDIO MCP：

```bash
npm run codex:install -- --check
npm run codex:install
```

第一条命令是只读预检，不会修改 Codex 配置。

脚本会：

- 将 `skills/edit-timeline-studio` 链接到当前 Codex 技能目录，让 Skill 始终与本检出版本一致；
- 通过 `codex mcp add` 注册 `timeline_studio_local`；
- 将 `TIMELINE_STUDIO_ROOT` 指向本仓库；
- 不安装系统软件、不下载模型、不索取 OpenAI API Key，也不修改 shell 配置。

如果目标已存在，脚本会停止，不会静默覆盖。确认旧配置后，可显式替换：

```bash
bash scripts/macos-local/install-codex-integration.sh --force
```

`--force` 会把旧 Skill 移到带时间戳的备份，并替换 MCP 条目。安装完成后启动一个新的 Codex 会话，让 Skill 和 MCP 工具清单刷新。

示例请求：

```text
使用 $edit-timeline-studio。检查 /绝对路径/project.timeline，先生成带版本校验的差异预览，
保存到一个新的工程路径，重新打开并汇报 revision 与轨道摘要。
```

对于受支持的 MCP 写操作，Codex 应先检查工程，调用 `timeline_project_diff`，审阅结果，再用相同 revision 和 operations 调用 `timeline_project_apply`，最后重新检查输出工程。MCP 不会覆盖已存在的输出路径。

## 验证

验证已安装 App：

```bash
npm run local:app:verify
```

验证内容包括：

- App 签名与 Bundle ID；
- 内嵌页面、静态服务器、启动器和配置文件；
- 不存在 Timeline Studio 的 LaunchAgent/LaunchDaemon；
- HTTP 200 与 Range 请求；
- COOP、COEP、CORP 和本地服务器标记响应头；
- 服务器能够随进程退出，端口随后关闭。

验证 Codex 注册：

```bash
codex mcp get timeline_studio_local --json
readlink "${CODEX_HOME:-$HOME/.codex}/skills/edit-timeline-studio"
```

仓库原有 `.codex/config.toml` 会继续保留。从本仓库直接打开 Codex 时，即使不依赖全局 `timeline_studio_local`，项目级配置也能提供 `timeline_studio` MCP。

## 更新

App 不会自动拉取源码或自我更新。更新必须显式执行：

```bash
git fetch upstream
git merge --ff-only upstream/main
npm ci
npm run check
npm run local:app:install
```

合并前应审阅上游变更。重新安装时，旧 App 会先移到废纸篓，再安装验证后的新版本。

## 卸载

移除 App 与 Dock 项：

```bash
npm run local:app:uninstall
```

移除全局 Codex Skill 链接与 MCP：

```bash
npm run codex:uninstall
```

卸载脚本不会删除仓库、工程文件、渲染结果、带时间戳的 Skill 备份、模型缓存或 Safari 站点数据。这些内容只有在确认精确目标后才能另行清理。

## Gatekeeper 说明

本地构建采用 ad-hoc 签名，没有 Apple Developer ID 公证。在同一台 Mac 构建并安装时通常不会带隔离属性。如果从其他位置复制或下载后被拦截，请先打开 **系统设置 → 隐私与安全性**，选择 **仍要打开**。

如果信任的复制版本在批准后仍提示“已损坏”，才使用下面的兜底命令：

```bash
sudo xattr -r -d com.apple.quarantine "/Applications/Timeline Studio Local.app"
```

若要公开分发并实现无警告首次启动，需要 Developer ID 签名、公证和 stapling；ad-hoc 签名不能替代这些流程。

## 故障排查

### 4173 端口被占用

先退出已有 `Timeline Studio Local`。如果端口属于其他应用，需要停止该应用，或修改 `build-app.sh` 中的端口后重新构建。使用固定 Origin 是为了让浏览器存储和 Service Worker 缓存跨启动保持稳定。

### Dock 同时显示问号和正常图标

问号表示 Dock 或 LaunchServices 仍引用已经被替换的旧 App。重新运行安装命令会注销构建包和旧包，将废纸篓备份保存为不会被重新发现的 `.app.retired`，只登记 `/Applications` 中的正式 App，并刷新 Dock 书签。只需修复 Dock、不重新构建时可执行：

```bash
bash scripts/macos-local/dock.sh add "/Applications/Timeline Studio Local.app"
```

### Safari 打开后页面不可用

查看日志并重新验证：

```bash
tail -100 "$HOME/Library/Logs/Timeline Studio Local/preview.log"
npm run local:app:verify
```

### Codex 没有显示 Skill 或 MCP 工具

启动新的 Codex 会话，然后执行：

```bash
codex mcp get timeline_studio_local --json
```

确认 Skill 链接指向的仓库绝对路径仍然存在。如果仓库移动，通过底层脚本带 `--force` 重新运行 `npm run codex:install` 对应的安装流程。

### Safari 中高级能力失败

Safari 对 WebGPU、WebCodecs 和浏览器模型运行时的兼容性可能与 Chromium 不同。确定性 Codex 工作应优先走 CLI/MCP。确实需要 Chromium 的 UI-only 操作时，可以继续启动同一个本地 App，再用受支持的 Chromium 浏览器打开其回环地址，不需要改变静态部署结构。
