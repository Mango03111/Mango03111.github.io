---
title: GitHub SSH Key 配置指南
Author: Mango
top_img: transparent
tags:
  - git
  - Code
categories:
  - 梦啥说啥
cover: https://a.tuchuangyun.top/autoupload/sGsLTdNbILw_FMc-EyyWvNiO_OyvX7mIgxFBfDMDErs/20260316/Xa1W/1280X853/image.png
abbrlink: 1070beb0
date: 2026-03-09 11:14:11
---


在日常开发中，GitHub 是最常用的代码托管平台之一。当我们更换电脑、重装系统或重新配置开发环境时，**SSH Key 的配置是非常重要的一步**。

使用 SSH 方式连接 GitHub 可以避免每次 push 代码都输入用户名和密码，同时也更加安全和高效。

这篇文章将从零开始介绍 **GitHub SSH Key 的完整配置流程**。

---

# 为什么推荐使用 SSH 连接 GitHub

GitHub 支持两种访问方式：

1. HTTPS
2. SSH

两种方式的区别：

| 方式    | 特点               |
| ----- | ---------------- |
| HTTPS | 每次操作可能需要输入账号密码   |
| SSH   | 使用密钥认证，不需要反复输入密码 |

在开发环境中，大多数开发者都会选择 **SSH 方式**，因为：

* 使用更加方便
* 安全性更高
* 适合长期开发环境

---

# 生成 SSH Key

首先需要在本地生成 SSH 密钥。

打开终端执行：

```bash
ssh-keygen -t rsa -C "your_email@example.com"
```

参数说明：

* `-t rsa`：指定密钥类型为 RSA
* `-C`：添加备注信息，通常填写 GitHub 邮箱

执行命令后会提示：

```
Enter file in which to save the key
```

这里直接 **按 Enter 使用默认路径即可**。

接下来会提示输入密码：

```
Enter passphrase
```

如果不想每次使用密钥输入密码，可以直接按 Enter 跳过。

生成成功后，在用户目录下会出现 `.ssh` 文件夹。

---

# 查看生成的 SSH Key

进入 `.ssh` 目录：

```bash
cd ~/.ssh
```

查看文件：

```bash
ls
```

一般会看到两个文件：

```
id_rsa
id_rsa.pub
```

含义：

| 文件         | 说明               |
| ---------- | ---------------- |
| id_rsa     | 私钥（必须保密）         |
| id_rsa.pub | 公钥（需要上传到 GitHub） |

查看公钥内容：

```bash
cat id_rsa.pub
```

终端会输出一段类似这样的内容：

```
ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQ...
```

复制 **整段内容**。

---

# 将 SSH Key 添加到 GitHub

登录 GitHub 后，按以下步骤操作：

1. 点击右上角头像
2. 进入 **Settings**
3. 找到 **SSH and GPG keys**
4. 点击 **New SSH key**

然后填写：

* **Title**：设备名称（例如：My Laptop）
* **Key**：粘贴刚刚复制的公钥

点击 **Add SSH key** 完成添加。

---

# 测试 SSH 是否配置成功

在终端执行：

```bash
ssh -T git@github.com
```

如果看到类似提示：

```
Hi username! You've successfully authenticated
```

说明 SSH 配置成功。

---

# 使用 SSH 克隆仓库

在 GitHub 仓库页面可以看到两种地址：

```
HTTPS
SSH
```

选择 **SSH 地址**，例如：

```
git@github.com:username/repository.git
```

执行克隆命令：

```bash
git clone git@github.com:username/repository.git
```

这样就可以将远程仓库克隆到本地。

---

# 提交代码到 GitHub

开发完成后，可以按标准 Git 流程提交代码。

查看当前状态：

```bash
git status
```

添加文件：

```bash
git add .
```

提交代码：

```bash
git commit -m "feat: add new feature"
```

推送代码：

```bash
git push
```

如果 SSH 配置正确，就可以直接推送到 GitHub。

---

# 常见问题：Git 提交时报错

有些情况下第一次提交代码会出现提示：

```
Please tell me who you are
```

这是因为 Git 没有配置用户信息。

执行以下命令：

```bash
git config --global user.email "your_email@example.com"
git config --global user.name "Your Name"
```

配置完成后即可正常提交代码。


![](https://git-scm.com/images/logos/downloads/Git-Logo-2Color.png)
