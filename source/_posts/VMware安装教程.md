---
title: "【教程】安装 VMware 虚拟机并部署 Ubuntu 系统\U0001F680"
Author: Mango
top_img: transparent
categories:
  - 教程
cover: https://industrywired.com/wp-content/uploads/2020/08/VMware-featured-2100x1200.jpg
abbrlink: 8bb62f89
date: 2026-03-02 15:32:20
tags:
---

这篇教程将带你一步步完成 **VMware Workstation Pro 的安装**，以及 **在 VMware 中部署 Ubuntu 虚拟机系统**。
![11](https://robots.net/wp-content/uploads/2023/11/how-to-set-up-vmware-workstation-12-1700841902.jpg)

引用：[安装虚拟机（VMware）保姆级教程](https://blog.csdn.net/weixin_74195551/article/details/127288338#75)

------

## 准备工作 🧰

开始之前，请准备好：

- VMware Workstation Pro 安装包
- Ubuntu ISO 镜像文件

### 下载 VMware

你可以前往 VMware 官网下载最新版本（例如 VMware Workstation Pro 17），本教程提供百度网盘链接：

通过网盘分享的文件：VMware-workstation-full-17.6.2-Win.exe
链接: https://pan.baidu.com/s/15pfZ2bcNTCn5nIWNNUR1Jg?pwd=w2cj 提取码: w2cj

------

### 下载 Ubuntu 镜像

前往 Ubuntu 官网下载所需版本（推荐 LTS 长期支持版本，更稳定 👍）。

这里提供华为云镜像：[华为云镜像24LTS](https://mirrors.huaweicloud.com/ubuntu-releases/24.04/)

下载完成后，我们就可以正式开始安装了。

------

## 安装 VMware Workstation Pro 💿

- 双击下载好的安装程序，启动安装向导。

- 勾选许可协议后点击“下一步”。

- 选择安装路径。建议不要安装在系统盘（C盘），可以选择空间较大的磁盘：

- 继续点击“下一步”直到安装完成。

如果出现许可证界面，选择个人使用即可免费使用VMware；安装完成后，启动 VMware 🎉。

------

## 创建 Ubuntu 虚拟机 🖥️

- 打开 VMware 后，选择“创建新的虚拟机”。

- 选择“典型（推荐）”，然后在安装来源处选择“使用 ISO 镜像文件”，并找到刚才下载好的 Ubuntu 镜像。

接下来设置：

- 虚拟机名称
- 虚拟机存放位置

磁盘大小默认即可（后期也可以扩展）。

点击完成，一个全新的虚拟机就创建好了 ✨。

------

## 安装 Ubuntu 系统 🐧

启动虚拟机后，会自动进入 Ubuntu 安装界面。

点击“Continue”开始安装。

根据提示完成：

- 选择语言
- 选择键盘布局
- 设置用户名和密码
- 选择安装类型（默认即可）

安装过程需要几分钟，耐心等待 ⏳。

安装完成后重启虚拟机，就能进入 Ubuntu 桌面啦 🎊。

------

## 修改系统语言（可选）🌏

如果系统默认是英文，可以修改为中文：

打开 **Settings** → 进入 **Language & Region** → 修改为中文。

------

## 使用建议 💡

- 虚拟机建议放在系统盘以外，避免占用C盘空间
- 安装时设置的用户名和密码一定要记住 🔐
- 如果运行卡顿，可以在虚拟机设置中增加内存或 CPU 核心数