---
title: wallpaper壁纸解包软件推荐
Author: Mango
categories:
  - 梦啥说啥
abbrlink: f09cdbbd
date: 2026-02-11 20:11:30
tags:
---

**RePKG** 是一款开源的资源解包工具，专门用于提取 **Wallpaper Engine** 动态壁纸包（`.pkg` 文件）中的资源内容。通过该工具，可以将壁纸中的图片、纹理、音频及项目文件完整提取出来。此外，RePKG 还支持将 Wallpaper Engine 使用的 **TEX 纹理格式** 转换为常见图片格式（如 PNG/JPG），方便查看、编辑或二次创作。

该工具为命令行程序，体积小、使用简单，适合壁纸爱好者、内容创作者及开发者使用。

参考文章：https://zhuanlan.zhihu.com/p/578573147

------

## 下载地址

**官方 GitHub 下载地址（推荐下载最新版）：**

👉 https://github.com/notscuffed/repkg/releases

下载后解压即可使用，无需安装。

**如果没有魔法，也可以通过以下链接下载（网盘下载）：**

👉https://wwc.lanzouw.com/iZVay064qleh

------

## 准备工作

1. 下载并解压 RePKG 工具压缩包。

2. 将需要解包的 `.pkg` 文件准备好（通常来自 Wallpaper Engine 的 Workshop 目录，可在wallpaper中`右键-在资源管理器中打开`）。

   ![截图20260217002809](截图20260217002809.png)

3. 建议新建一个单独文件夹，将：

   - `repkg.exe`
   - 需要解包的 `.pkg` 文件
     放在同一个目录中，便于操作。

   

------

## 操作方法一：PowerShell 自动化脚本（需下载网盘压缩包）

直接右键 - 使用powershell运行：

![截图20260217003033](截图20260217003033.png)

执行完成后，程序会在当前目录下生成一个output文件夹，里面就是解包后的资源文件。

## 操作方法二：PowerShell 命令行解包（通用）

### 第一步：打开 PowerShell

在包含 `repkg.exe` 和 `.pkg` 文件的文件夹中：

- 在空白处右键
- 选择 **“在此处打开 PowerShell”**

------

### 第二步：执行解包命令

在 PowerShell 中输入：

```powershell
repkg extract E:\Games\steamapps\workshop\content\123\scene.pkg 
```

说明：

- `repkg` —— 工具主程序
- `extract` —— 提取命令
- `my_wallpaper.pkg` —— 你要解包的文件名(注意前面的路径要修改成你自己的路径)

执行完成后，程序会在当前目录下生成一个output文件夹，里面就是解包后的资源文件。

------

## 进阶用法（常用参数说明）

下面是一些常见的高级使用场景示例，你可以根据需求选择对应命令。

------

### 1️⃣ 批量查找子目录中的 PKG 并生成完整项目结构

递归搜索指定目录下所有子文件夹中的 `.pkg` 文件，并将它们转换为完整的 Wallpaper Engine 项目结构：

```
repkg extract -c E:\Games\steamapps\workshop\content\123
```

参数说明：

- `-c` ：创建完整的 Wallpaper Engine 项目结构
- 自动扫描该目录及其子目录中的所有 PKG 文件

适用于：

- 批量整理 Workshop 下载的壁纸
- 将多个壁纸转换为可编辑项目

------

### 2️⃣ 批量查找 PKG，只转换 TEX 为 PNG，并统一输出到指定目录

递归查找目录中的所有 PKG 文件，仅提取 TEX 文件并转换为 PNG 格式，同时忽略原始路径结构，统一输出到 `./output` 文件夹：

```
repkg extract -e tex -s -o ./output E:\Games\steamapps\workshop\content\123
```

参数说明：

- `-e tex` ：仅处理 TEX 文件
- `-s` ：忽略原始路径结构（扁平化输出）
- `-o ./output` ：指定输出目录

适用于：

- 批量提取所有壁纸的贴图
- 统一整理为一个图片文件夹

------

### 3️⃣批量转换指定文件夹中的 TEX 文件

如果你已经单独提取了 TEX 文件，只想将它们转换为图片格式，可以使用：

```
repkg extract -t -s E:\path\to\dir\with\tex\files
```

参数说明：

- `-t` ：转换 TEX 文件为图片
- `-s` ：忽略原始路径结构

适用于：

- 已有 TEX 文件，仅需转换格式
- 单独整理贴图资源

------

### 常见参数汇总

| 参数 | 作用                               |
| ---- | :--------------------------------- |
| `-c` | 创建完整 Wallpaper Engine 项目结构 |
| `-e` | 仅提取指定扩展名文件               |
| `-t` | 转换 TEX 文件为图片                |
| `-s` | 忽略原始路径结构（扁平化输出）     |
| `-o` | 指定输出目录                       |

解包完成后，你会看到以下内容：

- 图片文件（PNG / JPG）
- 纹理文件（TEX）
- 音频文件
- 配置文件（如 project.json）
- 其他资源文件
