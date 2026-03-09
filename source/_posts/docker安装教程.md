---
title: 【教程】Windows环境下docker安装教程
Author: Mango
top_img: transparent
categories:
  - 教程
cover: https://pic1.zhimg.com/v2-d21b51fcb099240410565cbaa126a258_r.jpg 
abbrlink: df0fd32a
date: 2026-03-04 16:40:21
tags:
---

Docker 是一个用于构建、发布和运行应用程序的容器化平台。它通过容器技术将应用程序及其运行所需的环境（如依赖库、配置文件和系统工具）一起打包成一个独立的运行单元，使应用能够在不同的计算环境中保持一致的运行效果。相比传统虚拟机，Docker 容器更加轻量、启动速度更快、资源占用更少，因此被广泛应用于软件开发、测试、持续集成和云计算部署等场景，帮助开发者实现快速开发、快速部署和环境一致性。 🚀
这篇文章带你从 0 到 1 在 **Windows 10** 上把 Docker 跑起来（推荐 **WSL2 后端**），并完成镜像加速与安装验证。全程按步骤做即可。
引用：https://zhuanlan.zhihu.com/p/1975315532011046375

---

## 一、开始前准备（一定要先确认）

### 1）确认系统版本尽量更新到 22H2

Docker Desktop + WSL2 对系统版本有要求。建议把 Windows 10 更新到 **22H2**（或至少满足系统要求的较新版本）。

**怎么检查版本：**

* 打开 **设置 → 更新和安全 → 关于**
* 找到 **Windows 规格/版本号**（或“内部版本”信息）

> 如果版本偏老，先完成系统更新，再继续后面步骤。

---

## 二、安装 WSL（Windows Subsystem for Linux）

### 2）用管理员权限打开 PowerShell

在开始菜单搜索 PowerShell，右键选择 **以管理员身份运行**。

### 3）执行安装命令

在 PowerShell 中输入：

```powershell
wsl --install
```
![](https://pic1.zhimg.com/v2-23024b63c85c7a1b419bc55df8da1acc_1440w.jpg)
执行完成后：

* **重启电脑**
* 首次进入 WSL 会提示你创建 Linux 用户名和密码（按提示设置即可）
* 设置完成后，系统会自动进入 Linux 终端环境

> 你看到一个类似 Linux 命令行窗口，就说明 WSL 基本就绪了。

---

## 三、安装 Docker Desktop

### 4）下载安装并运行安装程序

打开 https://docs.docker.com/desktop
![](https://pic4.zhimg.com/v2-55cc7f126a0e196842263c2a1b7db0f9_1440w.jpg)
下载并安装 **Docker Desktop Installer**（Docker Desktop 官方安装包）。
安装过程中如果提示和系统要求相关的信息，通常就是版本/虚拟化/WSL 环境问题，按提示处理即可。

安装完成后：

* **重启电脑**
* 启动 **Docker Desktop**
* 等待右下角或托盘区 Docker 的状态变为 **Running**（常见表现是图标“正常亮起/可用”）

---

## 四、首次配置：启用 WSL2 引擎（推荐）

打开 Docker Desktop：

* 进入 **Settings（设置）→ General（常规）**
* 确保勾选 **Use the WSL 2 based engine**（使用 WSL2 引擎）

如果你安装了多个 WSL 发行版（如 Ubuntu）并希望 Docker 直接集成：

* 进入 **Settings → Resources → WSL Integration**
* 勾选你常用的发行版（例如 Ubuntu）

---

## 五、配置镜像加速（国内网络强烈建议）

### 5）在 Docker Desktop 中配置 registry mirrors

进入：

* **Settings → Docker Engine**

你会看到一个 JSON 配置框，在其中加入类似下面的配置（把地址替换成你自己的镜像源,下面是我正在使用的镜像源）：

```json

  "registry-mirrors": [
    "https://docker.1ms.run",
    "https://docker.m.daocloud.io",
    "https://lispy.org",
    "https://docker-0.unsee.tech",
    "https://docker.xuanyuan.me"
  ]

```

保存并应用（Apply / Restart），Docker 可能会自动重启。

> 镜像加速能显著改善拉取镜像（pull）速度，尤其是首次安装后的常用镜像下载。

---

## 六、验证是否安装成功（必做）

### 6）检查 Docker 版本信息

在 **PowerShell / CMD / WSL 终端**任意一个里运行：

```bash
docker version
```

能看到 Client/Server 的版本信息，说明 Docker 服务正常。

### 7）运行 hello-world 测试镜像

继续运行：

```bash
docker pull hello-world:latest
docker run --rm hello-world
```
![](https://pica.zhimg.com/v2-c23fd46237362cee7b5eedf26a4f2df4_1440w.jpg)

如果输出里出现欢迎信息，并且容器运行结束自动退出，就代表 **Docker + 网络拉取 + 容器运行**全部 OK。

---

## 常见问题排查

### 1）Docker Desktop 打不开或一直启动失败

优先检查：

* Windows 是否较新版本（建议 22H2）
* WSL 是否安装成功（`wsl --status` 能正常输出）
* Docker Desktop 是否启用了 WSL2 引擎 

### 2）拉取镜像很慢/经常超时

* 优先配置镜像加速（第五部分）
* 应用配置后重启 Docker Desktop 再试

### 3）命令提示找不到 docker

* 确认 Docker Desktop 已启动并处于 Running
* 重开终端窗口（让环境变量重新生效）
* 仍不行可尝试重启电脑

---

下面是一组 **Docker 常用命令速查**，涵盖镜像、容器、日志、网络等常见操作：

```bash
# 查看 Docker 版本
docker version

# 查看 Docker 系统信息
docker info

# 搜索镜像
docker search nginx

# 拉取镜像
docker pull nginx

# 查看本地镜像
docker images

# 删除镜像
docker rmi nginx

# 运行容器
docker run -d -p 80:80 --name mynginx nginx

# 查看正在运行的容器
docker ps

# 查看所有容器（包括停止的）
docker ps -a

# 启动容器
docker start 容器ID或名称

# 停止容器
docker stop 容器ID或名称

# 重启容器
docker restart 容器ID或名称

# 删除容器
docker rm 容器ID或名称

# 进入容器终端
docker exec -it 容器ID或名称 /bin/bash

# 查看容器日志
docker logs 容器ID或名称

# 查看容器资源使用情况
docker stats

# 查看容器详细信息
docker inspect 容器ID或名称

# 构建镜像
docker build -t myimage:1.0 .

# 提交容器为新镜像
docker commit 容器ID 新镜像名

# 查看网络
docker network ls

# 查看数据卷
docker volume ls

# 清理未使用的资源
docker system prune
```

![](https://logos-world.net/wp-content/uploads/2021/02/Docker-Logo-2013-2015-700x394.png)