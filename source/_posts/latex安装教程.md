---
title: 【教程】LaTeX 安装教程（Windows + TeX Live 2025 + TeXstudio）
Author: Mango
abbrlink: 6317b69f
date: 2026-02-21 22:41:30
tags:
- Research
categories:
- 教程
---

如果你准备开始使用 LaTeX 写论文或技术文档，那么本教程将带你在 Windows 上完整搭建 LaTeX 开发环境。我们将使用：

- **TeX Live 2025** —— LaTeX 编译发行版（核心环境）
- **TeXstudio** —— 图形化编辑器（写代码用）

> 适用于论文写作、课程作业、科研排版
> 系统环境：Windows 10 / 11
> 安装方案：TeX Live 2025 + TeXstudio

------

# 什么是 TeX Live 和 TeXstudio？

在开始安装之前，先简单了解一下：

| 软件      | 作用                                            |
| --------- | ----------------------------------------------- |
| TeX Live  | LaTeX 的核心发行版，包含编译器和各种宏包        |
| TeXstudio | 可视化 LaTeX 编辑器，用于编写和编译 `.tex` 文件 |

------

# 安装 TeX Live 2025

## 下载 TeX Live

为了获得更快的下载速度，推荐使用 **清华大学开源软件镜像站（TUNA）** 下载 TeX Live ISO 镜像：

👉 **清华镜像目录：**
🔗 https://mirrors.tuna.tsinghua.edu.cn/CTAN/systems/texlive/Images/

在目录中找到最新版本的 ISO 文件，例如：

- 📥 [TeX Live 2025 ISO 镜像（清华镜像）](https://mirrors.tuna.tsinghua.edu.cn/CTAN/systems/texlive/Images/texlive2025-20250308.iso)
- 📥 [TeX Live 通用 ISO 文件](https://mirrors.tuna.tsinghua.edu.cn/CTAN/systems/texlive/Images/texlive.iso)

⚠️ 文件体积约 6GB~8GB，建议使用稳定网络下载。

下载完成后：

- 右键 ISO 文件 → 选择“装载”
- 或使用解压软件解压
- 进入文件夹后运行：

```
install-tl-windows.bat
```

即可启动安装程序。

------

## 运行安装程序

安装界面打开后：

### 推荐配置：

- 选择 **Full installation（完整安装）**
- 安装路径保持默认（一般为 C:\texlive\2025）
- 为节省空间，建议语言只勾选中文和英文（Advance-customize）

点击 **Install** 开始安装。

------

## 等待安装完成

完整安装时间：

- 30分钟 ~ 1小时（取决于电脑性能）

安装完成后会自动配置环境变量。

------

## 测试是否安装成功

打开 **命令提示符（Win + R → cmd）**，输入：

```bash
tex -v
```

如果显示版本信息，说明安装成功。

------

# 安装 TeXstudio 编辑器

## 下载 TeXstudio

👉 [TeXstudio 官方下载页面](https://www.texstudio.org/)

下载 Windows 版本安装包。

------

## 安装步骤

- 双击安装程序
- 一路 Next
- 保持默认配置即可

安装完成后启动 TeXstudio。

------

# 配置 TeXstudio 编译器

打开 TeXstudio：

```
Options → Configure TeXstudio
```

在「构建（Build）」选项中：

### 默认编译器建议设置为：

```
XeLaTeX
```

原因：

- 支持中文
- 字体更现代
- 更适合论文写作

设置完成点击 OK。

------

# 测试编译第一个 LaTeX 文件

新建文件：

```
File → New
```

输入测试代码：

```latex
\documentclass{article}
\usepackage{ctex}

\begin{document}

你好，LaTeX！

\end{document}
```

点击绿色 ▶ 编译按钮。

如果成功生成 PDF 文件，说明环境搭建完成。

------

# 推荐平台

如果你不想在本地安装 LaTeX 环境，或者希望在不同设备之间同步写作，可以使用 **Overleaf** —— 一个基于浏览器的在线 LaTeX 编辑平台。

- [Overleaf 在线 LaTeX 平台](https://www.overleaf.com/)
