---
title: 【教程】hexo跨端协同教程
Author: Mango
tags:
  - Blog
  - git
categories:
  - 教程
abbrlink: 83dcefb7
date: 2026-02-09 15:13:18
top_img: transparent
cover: https://pic2.zhimg.com/v2-421d607a485277fe8997edc5a672b6e5_r.jpg
---

Hexo 是一个快速、高效的静态博客生成框架，主要用于搭建个人博客或技术网站。它允许用户使用 Markdown 编写文章，再由 Hexo 自动生成完整的静态网页。与传统动态博客不同，Hexo 不依赖数据库或后端服务，生成的站点由纯 HTML、CSS 和 JavaScript 组成，访问速度快，安全性高，维护成本低。Hexo 拥有完善的主题和插件生态，支持文章分类、标签、归档、代码高亮等功能，非常适合程序员和技术爱好者记录学习笔记、项目总结或个人思考。通过配合 Git 和静态托管服务，可以实现博客的自动部署和多设备同步，使写作与发布流程更加高效、可控。

如果你在多台电脑之间切换写博客，例如在多台工作电脑上上都想维护同一个 Hexo 博客，本篇文章将带你一步步完成设置和同步流程，让你的博客在不同电脑之间无缝协作。（有关hexo博客的搭建网上已经有很多优秀的教程了，这里我来推荐几个：[Hexo + GitHub Pages 零基础搭建博客详细步骤](https://blog.csdn.net/2301_79954726/article/details/157688775)、 [超详细 Hexo + Github Pages 博客搭建教程](https://zhuanlan.zhihu.com/p/8488305089)、 [手把手教你搭建 Hexo 博客](https://webfem.com/post/hexo)）

------

## 🎯 为什么需要多台电脑同步博客？

很多人会遇到这样的情况：手头有多台设备，但博客内容和配置需要保持一致。为避免重复操作、环境不一致或内容丢失，我们需要让 Hexo 博客在不同电脑之间能够方便地同步和更新。

------

## 🔍 同步的核心思路

要实现多电脑之间的博客同步，关键在于利用 Git 的分支管理机制：

- 博客的 **源文件** 和 **生成的静态页面** 分别管理在不同的分支。
- 所有博客源文件统一放在一个分支（如 `hexo` 分支）。
- 生成后的静态页面则通过 Hexo 自动部署到另一个分支（如 `master` 分支）。

### 为什么要区分分支？

Hexo 自带的部署机制会将生成的静态页面推送到一个指定分支。如果这个分支同时也承载源文件，那么每次生成与提交都会混合变更，造成历史混乱。因此：

- 使用一个分支来存放源代码（markdown、配置）。
- 使用另一个分支来存放静态文件（Hexo 自动生成的 HTML 等）。

这样，你在不同电脑上都能拉取最新的源文件，生成站点并部署，而不会互相干扰。

------

## 🛠 在老电脑上配置 Hexo

下面介绍在你已有博客的主电脑上进行必要的设置。

### 创建用于源码的分支

1. 进入你的博客仓库。
2. 从 GitHub 上新建一个名为 `hexo` 的分支，这时，github会将master分支中的静态网页内容克隆到hexo分支。

![截图20260205125043](截图20260205125043.png)

### 准备推送博客源码

1. 克隆远程仓库到本地：

   ```bash
   git clone git@github.com:你的用户名/你的仓库名.git
   git fetch origin #同步远程数据
   git checkout hexo #切换到开发分支
   ```

2. 删除所有文件，只保留 `.git` 文件夹（将静态网页文件删除掉）。

3. 把你现有博客的所有内容（除 `.deploy_git` 文件夹）复制进来，**如果你配置了主题，注意把Theme文件夹中的.git文件也要删除掉（这一步十分重要，git不允许嵌套上传，不删除会导致报错）**。

4. 编辑 `.gitignore` 文件（在当前目录，目的是在push时忽略这些文件；如果项目根目录中没有这个文件，请手动创建一个），将以下内容复制进去：

   ```
   .DS_Store
   Thumbs.db
   db.json
   *.log
   node_modules/
   public/
   .deploy*/
   ```

5. 提交并推送所有源码：

   ```bash
   git add .
   git commit -m "initial blog source"
   git push origin hexo
   ```

这样一来，你的博客源文件就保存在 GitHub 的 `hexo` 分支里了。

------

## 💻 在新电脑上搭建 Hexo 环境

当你换用另一台新电脑，以下是完整的步骤：

### 克隆博客源码

克隆你博客的源码分支：

```bash
git clone git@github.com:你的用户名/你的仓库名.git
git fetch origin #同步远程数据
git checkout hexo #切换到开发分支
```

此时仓库就在本地了。

### 安装 Node.js 和 Hexo

**确保安装 Node.js 与 npm；**

进入刚刚克隆下来的**仓库文件夹内**，安装 Hexo 和相关依赖：

```bash
npm install -g hexo-cli
npm install
npm install hexo-deployer-git
```

现在，你的新电脑就已经具备 Hexo 的运行环境了。

------

## 🔄 日常更新与同步流程

无论你在哪台设备上写博客，都可以按以下流程来保证内容最新：

### 同步远程仓库最新内容

在写文章之前：

```bash
git pull origin hexo #同步远程分支
```

### 编写文章 & 提交

写完文章后：

```bash
#hexo四件套：
hexo c #清除缓存
hexo g #生成静态网页
hexo s #本地预览
hexo d #远程部署
#git三件套：
git add . 
git commit -m "更新日志"
git push origin hexo
```

这样可以确保博客源文件和静态页面都分别更新到了对应的分支，如果你想要更方便一点，可以将hexo分支设置为默认分支（这样可以在版本同步时少打几个字，不过我认为没必要，还容易影响到其他关联的软件）。

## 补充内容

### 取消vercel除生产分支外的自动部署

如果你也是用vercel自动部署的，可能会发现在hexo分支更新之后，vercel会自动进行预览部署操作，实际上我们是不需要这一步多余操作的（浪费资源）；如果想要关闭这个功能，请进入你的vercel项目设置 - > Environments，把Preview设置为Disabled即可。

![mmexport1770620438174](mmexport1770620438174.png)
