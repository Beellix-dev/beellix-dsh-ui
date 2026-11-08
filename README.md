# Beelli X UI

**Beelli X 界面增强**把外观、侧栏、插件市场和归档聊天整合进 DeepSeek Harness 桌面界面。可以按自己的习惯配置工作区，也可以在同一个窗口整理和恢复归档对话。

Beelli X UI adds unified settings, customizable skins and sidebar controls, market switching, and archived-chat management to DeepSeek Harness desktop.

**版本 0.1.1 · MIT · 作者 Beellix-dev。** 适用于 Windows DSH NEXT，由第三方独立维护。

## 安装与使用

在 DSH 的「插件 → 添加插件」中导入维护者提供的预构建 `.tgz` 安装包。宿主要求重启时，先保存当前工作，再正常重启。不要同时启用其他替换设置页或侧栏的 UI 插件。

包名为 `@beellix-ai/dsh-web-gui`。安装包与版本说明见 [GitHub Releases](https://github.com/Beellix-dev/beellix-dsh-ui/releases)。

- **外观**。在「更多 → 设置 → 外观」调整主题、字体和面板透明度，预览内置插画，或导入图片、MP4 和 JSON 皮肤方案。
- **侧栏和插件市场**。按需显示、隐藏或排列侧栏控件，在同一个插件市场页面切换来源或添加自定义目录。
- **归档聊天**。在设置末尾查看按工作区分组的归档，可搜索、排序、取消归档。确认后可单条或批量删除本地对话，列表随即更新，操作期间客户端继续运行。
- **桌宠**。把动图添加为宠物的默认动作，切换当前桌宠，为每只宠物添加独立动作，并从桌宠右键菜单播放。

![外观与侧栏](docs/images/sidebar.png)

![统一设置](docs/images/settings.png)

![已归档的聊天](docs/images/archives.png)

截图来自同版本隔离开发客户端的已验界面，不包含用户业务资料。

## 兼容与边界

实际桌面验收基线为 **Next 2.0.21-next、Harness / frontend 0.2.1-rc.4、Windows**。清单声明 `engines.dsh >=0.2.1-rc.4 <0.3.0`，该范围不代表其中每个版本或其他操作系统均完成实机验收。

本包通过原生 Bundle 替换设置和侧栏入口，沿公开服务配置宿主功能；安装卸载由 DSH 管理。模型目录来自实际服务接口，连接是否可用仍取决于厂商地址、凭据和模型权限；模型请求及费用按所选厂商处理。

归档删除已在 Windows DSH NEXT 的默认 `desktop` Profile 与标准本地会话存储验证。删除操作清理选中对话的日志、归档标记、工作区关联和对应缓存。其他组件持有写入锁时保留该对话并提示原因。工作区目录内的项目文件继续保留。

皮肤使用共享背景与独立面板，支持静态图片、MP4、CSS 磨砂。三款内置插画原生尺寸为 1672×941。没有 Wallpaper Engine Scene/Web 渲染引擎。桌宠支持动态 WebP（100 MB 以内）和 GIF（20 MB 以内）。默认动作循环展示，其他动作播放一轮后回到默认动作。壁纸文字采样不能保证任意复杂图像上的所有文字均清晰。

最多显示三个已注册环境模块；目前内置真实环境模块只有工作区。环境贡献接口仅转交呈现和新会话操作，不提供环境后端或数据隔离。

## 数据与停用

配置独立使用 `dsh-web-gui` 命名空间；导入媒体保存在所属 DSH 环境的 `DSHWebGui/ui/media`。不会创建 Beellix 企业目录，不自动迁移其他插件资料。

停用／卸载后由宿主恢复原生入口，用户媒体与设置保留；需要删除媒体时请在卸载前从素材库移除。DSH 会话、工作区文件、模型凭据由宿主管理，不属于本插件卸载范围。出现加载问题时可从宿主恢复页面停用本包后重启。

## 从源码构建

独立源码快照需要 Node.js 22+，推荐 Node.js 24；Windows 使用 PowerShell 7。

```sh
npm ci --ignore-scripts
npm run build
npx playwright install chromium
npm test
npm pack --ignore-scripts
```

测试中的浏览器使用固定版本与防账户锁定参数。源码构建不读取日常 DSH 配置、不安装或重启客户端。`lib` 是构建输出；安装预构建包不需要本机编译。

问题报告请提供版本、复现步骤和已脱敏日志。源码与素材的权属见 [LICENSE](LICENSE) 和 [第三方声明](THIRD_PARTY_NOTICES.md)。贡献说明见 [CONTRIBUTING.md](https://github.com/Beellix-dev/beellix-dsh-ui/blob/main/CONTRIBUTING.md)，变更见 [CHANGELOG.md](https://github.com/Beellix-dev/beellix-dsh-ui/blob/main/CHANGELOG.md)。
