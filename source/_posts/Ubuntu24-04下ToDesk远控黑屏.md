---
title: Ubuntu 24.04 下 ToDesk 远控黑屏/卡进度条问题解决记录
Author: Mango
top_img: transparent
tags:
  - Research
  - Code
categories:
  - 计算机网络
abbrlink: 8da2c97d
date: 2026-04-28 19:24:26
cover:
---

安装 Ubuntu 24.04 LTS 后，ToDesk 远程控制软件可能会出现无法正常被控的问题。表面上看，设备在线、软件也能启动，但其他电脑发起远控时，连接进度条会卡住，甚至进入黑屏状态。

本文记录一次 Ubuntu 24.04 环境下 ToDesk 远控异常的排查和解决过程。

---

## 问题现象

系统环境如下：

* 系统版本：Ubuntu 24.04.1 LTS
* ToDesk 版本：4.7.2.0

遇到的问题主要有：

Ubuntu 电脑可以正常使用 ToDesk 去远控其他设备，但偶尔会出现窗口闪烁。

其他电脑也能看到这台 Ubuntu 设备在线，但发起远控后无法真正进入桌面。连接进度条可能卡在一半，也可能卡到 100% 后黑屏。

与此同时，Ubuntu 被控端会提示“正在被远控”，但实际上控制端并不能看到桌面，也无法正常操作。

也就是说，ToDesk 的连接似乎已经建立，但远程画面没有正常传输出来。

---

## 问题原因

Ubuntu 24.04 默认使用的显示管理器通常是 `gdm3`。在本次问题中，ToDesk 在 `gdm3` 环境下可以启动，也可以显示设备在线，但作为被控端时无法正常输出远程桌面画面。

表现出来就是：

连接请求能够进来；

被控端提示正在被远控；

控制端进度条卡住或黑屏；

远控操作无法真正生效。

最终排查发现，ToDesk 在 Ubuntu 24.04 的 `gdm3` 环境下存在兼容性问题。将显示管理器切换为 `lightdm` 后，远控功能恢复正常。

---

## 解决方法：切换到 lightdm

首先安装 `lightdm`：

```bash
sudo apt install lightdm
```

安装过程中，系统可能会弹出显示管理器选择界面。在该界面中选择：

```text
lightdm
```

如果安装时没有弹出选择界面，或者后续需要重新配置默认显示管理器，可以执行：

```bash
sudo dpkg-reconfigure lightdm
```

然后在弹出的界面中选择 `lightdm`。

配置完成后，重启电脑：

```bash
sudo reboot
```

重启后，再次使用其他电脑连接这台 Ubuntu 24.04 设备，ToDesk 黑屏、卡进度条、无法被控的问题即可解决。

---

## 总结

Ubuntu 24.04 下 ToDesk 出现远控黑屏、连接进度条卡住、被控端提示已连接但无法实际控制等问题时，可以优先检查显示管理器。

本次问题的关键原因是：

```text
ToDesk 暂时不兼容或不完全兼容 Ubuntu 24.04 默认的 gdm3 显示管理器。
```

解决思路是将默认显示管理器切换为 `lightdm`：

```bash
sudo apt install lightdm
sudo dpkg-reconfigure lightdm
sudo reboot
```

切换完成并重启后，ToDesk 远程控制功能恢复正常。

