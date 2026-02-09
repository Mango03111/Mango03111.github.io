---
title: Codex CLI 安装与 VS Code 插件使用教程
Author: Mango
tags:
  - AI
categories:
  - 教程
abbrlink: 9975aeb1
date: 2026-02-09 15:51:22
---

**Codex** 是 OpenAI 推出的新一代 **AI 编程智能体（Coding Agent）**，它不只是“会写代码的 ChatGPT”，而是一个**可以直接参与你真实开发流程的工具**。与传统在网页里对话的 ChatGPT 不同，Codex 被设计为：

- **运行在本地开发环境中**
- **理解你的项目结构**
- **能操作文件、执行命令、修改代码**



**那Codex 和 ChatGPT 写代码有什么本质区别？**

很多人第一反应是：

> “我用 ChatGPT 写代码也挺好，为什么还要 Codex？”

关键差别在于 **上下文深度和执行能力**。

| 维度       | ChatGPT（网页） | Codex                    |
| ---------- | --------------- | ------------------------ |
| 项目上下文 | 仅靠复制粘贴    | 自动理解整个代码仓库     |
| 文件操作   | 不能直接改文件  | 可新建 / 修改 / 删除文件 |
| 命令执行   | 只能给你命令    | 可直接执行命令           |
| 多步骤任务 | 需要你手动拆解  | 可自动规划并执行         |
| 开发位置   | 浏览器          | 终端 / VS Code / Cursor  |

**Codex CLI** 是 OpenAI 提供的一款在终端中运行的 AI 代码助手工具，结合 ChatGPT 的能力，可在命令行和 IDE 中以自然语言生成、审查、重构代码。本文整理了国内环境下的安装前置条件、Codex CLI 安装步骤以及 VS Code 插件安装方法，帮助你快速上手。

------

## 🧠 前置条件

在开始安装之前，请确保满足以下基本条件：

1. **ChatGPT Plus / Pro / Team 会员**
   Codex 目前仅对 ChatGPT 的付费订阅用户开放，免费账户无法使用。这里推荐大家去海鲜市场按月购入team会员（价格在10-20元不等），不过要注意的是，为了防止商家跑路，最好不要一次性购入很长时间的会员。
2. **科学上网环境**
   国内访问 ChatGPT 及相关服务时，需要能够访问被墙外服务。这个不做推荐，大家自行寻找。
3. **Node.js 环境（用于 CLI）**
   Codex CLI 基于 Node.js 运行，需要 **Node.js 22+** 版本环境。后文会详细说明安装方法。

------

## 🚀 Codex CLI 安装步骤

### 1. 检查 Node.js 是否已安装

打开终端（macOS / Linux / Windows PowerShell），执行：

```bash
node -v
```

若返回版本号 **≥ 22**，则可跳过安装节点。

------

### 2. 安装 Node.js（如未安装）

前往 **Node.js 官网** 下载并安装最新版（推荐使用 LTS 或最新 22+ 版本）：

🔗 Node.js 官网：https://nodejs.org/zh-cn/ 

安装后重新打开终端，再次执行 `node -v` 确认版本。

------

### 3. 安装 Codex CLI

#### 🐧 macOS / Linux

使用 npm 全局安装：

```bash
npm install -g @openai/codex@latest
```

> 若国内网络较慢，可使用国内镜像加速：

```bash
npm install -g @openai/codex@latest --registry=https://registry.npmmirror.com
```

也可以通过 Homebrew 安装：

~~~bash
brew install codex
``` :contentReference[oaicite:8]{index=8}
~~~

验证安装：

~~~bash
codex --version
~~~

若输出版本号，则说明安装成功。

#### 🪟 windows

Windows 用户同样可以正常使用 Codex CLI，推荐使用 **PowerShell**。

- 在开始菜单中搜索 **PowerShell**
- 右键选择 **“以管理员身份运行”**

执行以下命令：

```
npm install -g @openai/codex@latest
```

如果遇到下载慢或卡住的问题，建议使用国内 npm 镜像：

```
npm install -g @openai/codex@latest --registry=https://registry.npmmirror.com
```

验证安装，在 PowerShell 中执行：

```
codex --version
```

![image-20260205122856394](image-20260205122856394.png)

如果能正确输出版本号，说明 Codex CLI 已成功安装。

------

## 🔐 Codex CLI 登录授权

Codex CLI 需要登录授权才能使用。支持两种方式：

### 🔹 方式 1 — 使用 ChatGPT 官方账号登录（推荐）

终端执行：

```bash
codex
```

![image-20260205123004216](image-20260205123004216.png)

首次运行时会弹出链接或二维码（我这里已经登陆过了），让你在浏览器中登录你的 ChatGPT 账号并授权。登录成功后，即可在终端直接使用。授权信息会自动保存，下次无需重复登录。

------

### 🔹 方式 2 — 使用 API Key（第三方服务）

如果你有支持 Codex 模型的第三方 API Key，也可以配置：

1. 新建配置目录：

```bash
mkdir -p ~/.codex
```

1. 创建 `config.toml`（指定 API 服务商和模型）
2. 创建 `auth.json` 并填入你的 API Key

示例：

```json
{
  "OPENAI_API_KEY": "sk-你的API密钥"
}
```

然后重新运行 `codex` 即可。

------

## 🧩 在 VS Code 中安装 Codex 插件

如果你不喜欢命令行交互，实际上这中方式在实际开发中很少用到，我推荐在 **VS Code 中通过插件 UI 使用 Codex**。

### 1. 打开 VS Code

打开 VS Code 编辑器。

------

### 2. 安装 Codex 扩展

1. 点击左侧的 **扩展商店（Extensions）**
2. 在搜索框中输入 **Codex**
3. 找到 **OpenAI 官方 Codex 插件** 并点击 **安装**。

![image-20260205123303996](image-20260205123303996.png)

------

### 3. 登录并使用

安装完成后：

1. 左侧边栏会出现 Codex 图标
2. 点击图标并完成登录授权（与 CLI 登录类似）
3. 授权成功后即可在侧边栏中与 Codex 对话、生成代码

![image-20260205123455217](image-20260205123455217.png)

🛠 你还可以选中代码块 → 右键 → 选择 “Ask Codex” 直接提问当前代码片段的解释或优化建议。

**安装教程到此结束，后续有时间我还会发一些有关codex在代码开发中的实际应用方式以及一些小技巧，供大家交流与学习！**

