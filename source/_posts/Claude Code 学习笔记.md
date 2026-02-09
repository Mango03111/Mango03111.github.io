---
title: Claude Code 学习笔记
Author: Mango
categories:
  - 学习笔记
abbrlink: 57c84b4f
date: 2026-01-22 21:21:33
tags:
  - AI
---

**Claude Code** 是人工智能助手Claude具备的代码理解、生成和优化能力的统称，它基于大型语言模型训练而成，能够处理多种编程语言（如Python、C++、Java等）的编程任务。具体而言，Claude Code能够分析用户需求并生成相应的代码片段，调试和解释现有代码的逻辑错误，优化算法实现以提高性能，在不同编程语言之间进行转换，以及生成技术文档和测试用例。它深度理解编程范式、数据结构和算法，并能结合具体应用场景（如网络优化、数学建模、系统设计等）提供专业级编码解决方案。Claude Code的特点在于能够上下文关联地理解复杂需求，提供符合工程最佳实践的代码，同时给出清晰的技术解释，相当于一个具备全栈开发能力的AI编程助手。

## 一、常用指令行

1. `/init` - 初始化阅读工程，输出到md文件
2. 两次按`shift+tab` 进入plan mode（做计划）
3. `think hard/ harder/ ultrathink` -代表思考力度（越右消耗token越多）
4. `creat a task to xxxx` - 创建todo list，分步骤执行操作
5. `add a task to xxx` - 添加 task
6. `clear` - 清除
7. `compact` - 主动压缩context

## 二、Context Manage

### 1.局部上下文管理

（1）插入内容（框选、直接复制进来）

（2）插入文件（@+文件名、@/+目录名）

（3）图片（Ctrl+v）

### 2.整体上下文管理

（1）恢复上次对话（`claude -c`，在进入cc之前）

（2）选择历史会话（`claude -r`，同上；`/resume`，在进入cc之后）

### 3.记忆管理

（1）添加记忆/规则（# + 内容）<存储到文件中>

## 三、工具与MCP

### 1.内置工具

（1）bash超时问题：通过环境变量调整变大 `bash`

（2）可以编辑jupyter notebook

（3）可以贴链接url（可以直接抓取网页内容）`webFetch`

### 2.自定义斜杠命令

（1）把经常打的那句话变成命令,以下是操作方法（arguments可有可无）：

```bash
#创建个人命令
mkdir -p ~/.claude/commands
echo "xxxxxxxxxxxxx:$ARGUMENTS" > ~/.claude/commands/xxx.md
#md的文件名就是自定义命令名
```

使用方法：

```bash
/xxx [arguments]
```

（2）可以调用MCP服务里面的提示词

```bash
/mcp__mcp名字__斜杠命令名 [arguments]
```

### 3. Model Context Protocol

在Claude执行之前进行下述操作：

**（1）添加本地 stdio 服务器**

Stdio 服务器作为本地进程在您的机器上运行。它们非常适合需要直接系统访问或自定义脚本的工具。

```bash
# 基本语法
claude mcp add <name> <command> [args...]

# 实际示例：添加 Airtable 服务器
claude mcp add airtable --env AIRTABLE_API_KEY=YOUR_KEY \
  -- npx -y airtable-mcp-server
```

**（2）添加远程 SSE 服务器**

SSE（服务器发送事件）服务器提供实时流连接。许多云服务使用此功能进行实时更新。

```bash
# 基本语法
claude mcp add --transport sse <name> <url>

# 实际示例：连接到 Linear
claude mcp add --transport sse linear https://mcp.linear.app/sse

# 带身份验证标头的示例
claude mcp add --transport sse private-api https://api.company.com/mcp \
  --header "X-API-Key: your-key-here"
```

**（3）添加远程 HTTP 服务器**

HTTP 服务器使用标准的请求/响应模式。大多数 REST API 和 Web 服务使用此传输方式。

```bash
# 基本语法
claude mcp add --transport http <name> <url>

# 实际示例：连接到 Notion
claude mcp add --transport http notion https://mcp.notion.com/mcp

# 带 Bearer 令牌的示例
claude mcp add --transport http secure-api https://api.example.com/mcp \
  --header "Authorization: Bearer your-token"
```

**（4）管理MCP**

配置完成后，使用以下命令管理的 MCP 服务器：

```bash
# 列出所有配置的服务器
claude mcp list

# 获取特定服务器的详细信息
claude mcp get github

# 删除服务器
claude mcp remove github

# （在 Claude Code 中）检查服务器状态
/mcp
```

**（5） [MCP 安装范围](https://docs.anthropic.com/zh-CN/docs/claude-code/mcp#mcp-%E5%AE%89%E8%A3%85%E8%8C%83%E5%9B%B4)**

MCP 服务器可以在三个不同的范围级别配置，每个级别都有不同的目的来管理服务器可访问性和共享。了解这些范围有助于确定为特定需求配置服务器的最佳方式。

- **本地范围**：个人服务器、实验性配置或特定于一个项目的敏感凭据
- **项目范围**：团队共享服务器、项目特定工具或协作所需的服务
- **用户范围**：多个项目需要的个人实用程序、开发工具或经常使用的服务

## 四、实践

### 1. Work Flow

（1）`CLAUDE.md` `/init`

（2）按`ESC`中断操作，而不损失上下文；按两下` ESC`清除当前操作输出内容

（3）`Shift+Tab`进入自动接受模式

（4）可以让它把**问题列表**存储到各个`.md`文件中，以便项目迁移和上下文存储
