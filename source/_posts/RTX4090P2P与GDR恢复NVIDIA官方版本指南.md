---
title: RTX4090P2P与GDR恢复NVIDIA官方版本指南
Author: Mango
top_img: transparent
tags:
  - AI
  - AI Infra
categories:
  - AIInfra
abbrlink: '21e19566'
date: 2026-09-05 23:45:30
cover:
---

> 目标：移除 RTX 4090 P2P/GDR 非官方改造，恢复 NVIDIA 官方普通驱动和官方 NCCL，同时保留 CUDA 工具链、业务数据和 RDMA 网络栈。
>
> 推荐路径是恢复与现有用户态完全匹配的官方 `595.71.05` open DKMS。不要用通配符清除所有 `nvidia-*` 或 `libnvidia-*` 包；这种做法容易一并删除 CUDA、容器运行时和桌面依赖。

## 1. 恢复后的目标状态

| 项目                | 目标                                                        |
| ------------------- | ----------------------------------------------------------- |
| NVIDIA 内核模块     | 官方 `nvidia-dkms-open 595.71.05-1ubuntu1`                  |
| NVIDIA 用户态和固件 | 官方 `595.71.05-1ubuntu1`                                   |
| NCCL                | 仓库提供的官方 `libnccl2` / `libnccl-dev`                   |
| P2P 补丁            | `nvidia-open-p2p-dkms` 不再安装，DKMS 无 `nvidia-open-p2p`  |
| GDR shim            | 业务进程不再设置 `LD_PRELOAD=...libgdrshim.so`              |
| 补丁 NCCL           | 不再通过 `LD_LIBRARY_PATH` 加载 `/opt/rtx4090-gdr/nccl-gdr` |
| RDMA 栈             | 可保留 MLNX_OFED、mlx5 和官方 `nvidia_peermem`              |

`nvidia_peermem` 是官方驱动也会提供的模块。它存在不代表 GDR 已被非官方解锁，因此恢复时不必为了“看不到该模块”而破坏 RDMA 栈。

## 2. 恢复前准备

### 第 1 步：确认维护窗口并停止任务

```bash
nvidia-smi
nvidia-smi --query-compute-apps=pid,process_name,gpu_uuid --format=csv
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Image}}'
```

正常停止所有 GPU、NCCL、MPI 和使用 GDR shim 的容器。切换内核模块需要重启，不支持无中断恢复。

### 第 2 步：保存现状

```bash
mkdir -p "$HOME/nvidia-before-official-restore"
cat /proc/driver/nvidia/version \
  > "$HOME/nvidia-before-official-restore/driver-version.txt"
modinfo nvidia \
  > "$HOME/nvidia-before-official-restore/modinfo-nvidia.txt"
dkms status \
  > "$HOME/nvidia-before-official-restore/dkms.txt"
dpkg-query -W \
  > "$HOME/nvidia-before-official-restore/packages.txt"
apt-mark showhold \
  > "$HOME/nvidia-before-official-restore/holds.txt"
```

### 第 3 步：确认官方精确版本仍可获得

本文使用：

```bash
OFFICIAL_VER=595.71.05-1ubuntu1
apt-cache policy \
  nvidia-dkms-open nvidia-kernel-source-open \
  nvidia-kernel-common nvidia-firmware nvidia-modprobe \
  libnvidia-compute libnvidia-cfg1 nvidia-persistenced
```

每个关键包的版本表中都应包含 `595.71.05-1ubuntu1`。如果仓库不再提供该版本，先下载并归档整套匹配的官方包，或改为执行本文第 8 节的“整栈升级”，不要只升级内核模块。

### 第 4 步：预演包操作

```bash
sudo apt-get -s remove nvidia-open-p2p-dkms
sudo apt-get -s install --allow-change-held-packages \
  nvidia-dkms-open="$OFFICIAL_VER" \
  nvidia-kernel-source-open="$OFFICIAL_VER" \
  nvidia-kernel-common="$OFFICIAL_VER" \
  nvidia-firmware="$OFFICIAL_VER" \
  nvidia-modprobe="$OFFICIAL_VER"
```

确认模拟输出不会移除 CUDA 工具链、NCCL、Docker/NVIDIA Container Toolkit 或其他业务依赖。

---

## 3. 第一部分：撤销 GDR 用户态改造

GDR 是进程级 shim 和补丁 NCCL，因此应先撤销用户态配置，再更换内核驱动。

### 第 1 步：定位所有 GDR 注入点

```bash
grep -RInE 'libgdrshim|rtx4090-gdr|nccl-gdr|NCCL_NET_GDR' \
  /etc/environment /etc/profile /etc/profile.d \
  "$HOME/.profile" "$HOME/.bashrc" \
  /etc/systemd/system /usr/local/bin \
  2>/dev/null
```

同时检查业务的 systemd unit、Docker Compose、Kubernetes manifest、Slurm 脚本、MPI hostfile 和容器入口脚本。

### 第 2 步：从业务启动配置中移除以下设置

```text
LD_PRELOAD=/opt/rtx4090-gdr/lib/libgdrshim.so
LD_LIBRARY_PATH=/opt/rtx4090-gdr/nccl-gdr/lib:...
GDRSHIM_VERBOSE=...
GDRSHIM_DUMP=...
NCCL_NET_GDR_LEVEL=...
```

不要直接删除包含其他库的整个 `LD_PRELOAD` 或 `LD_LIBRARY_PATH`；只移除 GDR shim 和补丁 NCCL 对应的条目。

如果当前 shell 只是临时设置，可执行：

```bash
unset LD_PRELOAD
unset GDRSHIM_VERBOSE GDRSHIM_DUMP GDRSHIM_TRACE
unset NCCL_NET_GDR_LEVEL NCCL_NET_GDR_READ
```

若 `LD_LIBRARY_PATH` 中还包含其他必要目录，请重新开启一个干净 shell，而不是粗暴 `unset`。

### 第 3 步：恢复官方 NCCL

先确认将使用的官方版本：

```bash
dpkg-query -W -f='${Package}\t${Version}\n' libnccl2 libnccl-dev
apt-cache policy libnccl2 libnccl-dev
```

如果曾覆盖系统库，重新安装当前已登记版本：

```bash
NCCL_RUNTIME_VER=$(dpkg-query -W -f='${Version}' libnccl2)
NCCL_DEV_VER=$(dpkg-query -W -f='${Version}' libnccl-dev)
sudo apt-get install --reinstall \
  libnccl2="$NCCL_RUNTIME_VER" \
  libnccl-dev="$NCCL_DEV_VER"
sudo ldconfig
```

如果补丁 NCCL 始终只部署在 `/opt/rtx4090-gdr`，无需删除它；停用环境变量即可。建议先保留到官方恢复验证完成，再按变更管理规则归档。

### 第 4 步：验证新进程不会再注入 shim

打开一个新的登录 shell，然后检查：

```bash
env | grep -E '^(LD_PRELOAD|LD_LIBRARY_PATH|GDRSHIM_|NCCL_NET_GDR)' || true
ldconfig -p | grep 'libnccl.so.2'
```

启动业务前，还应检查对应容器或服务内部的环境，而不只是宿主机 shell。

---

## 4. 第二部分：撤销 P2P 补丁驱动

### 第 1 步：解除相关 hold

```bash
for pkg in \
  nvidia-open-p2p-dkms \
  nvidia-dkms-open nvidia-kernel-source-open \
  nvidia-kernel-common nvidia-firmware nvidia-modprobe; do
  sudo apt-mark unhold "$pkg" 2>/dev/null || true
done
```

某些包不存在时，`apt-mark` 可能打印提示，可继续核对下一步。

### 第 2 步：移除补丁 DKMS 包

```bash
sudo apt-get remove --allow-change-held-packages \
  nvidia-open-p2p-dkms
```

该包的 `prerm` 会执行 `dkms remove -m nvidia-open-p2p -v 595.71.05 --all`。随后确认：

```bash
dkms status | grep nvidia || true
```

如果包已不存在但 DKMS 条目仍残留，再执行：

```bash
sudo dkms remove -m nvidia-open-p2p -v 595.71.05 --all
```

不要删除 `/lib/modules` 下的文件来代替 DKMS 卸载；这样会绕过包管理状态。

### 第 3 步：安装同版本 NVIDIA 官方 open DKMS

```bash
OFFICIAL_VER=595.71.05-1ubuntu1
sudo apt-get install --allow-change-held-packages --reinstall \
  nvidia-kernel-source-open="$OFFICIAL_VER" \
  nvidia-kernel-common="$OFFICIAL_VER" \
  nvidia-firmware="$OFFICIAL_VER" \
  nvidia-modprobe="$OFFICIAL_VER" \
  nvidia-dkms-open="$OFFICIAL_VER"
```

这里恢复的是 NVIDIA CUDA 仓库的官方 open 模块，与现有 595.71.05 用户态库匹配。不要同时安装 Ubuntu 的 `nvidia-dkms-595-open` 和 CUDA 仓库的 `nvidia-dkms-open`。

### 第 4 步：检查官方 DKMS 构建

```bash
dkms status | grep nvidia
modinfo -k "$(uname -r)" nvidia | grep -E '^(filename|version|license):'
find "/lib/modules/$(uname -r)/updates/dkms" -maxdepth 1 \
  -type f -name 'nvidia*.ko*' -print
```

预期 DKMS 名称是 `nvidia/595.71.05`，而不是 `nvidia-open-p2p/595.71.05`。

若当前内核尚未构建成功：

```bash
sudo apt-get install "linux-headers-$(uname -r)" dkms
sudo dkms autoinstall -k "$(uname -r)"
```

### 第 5 步：更新 initramfs 并重启

```bash
sudo depmod -a
sudo update-initramfs -u -k "$(uname -r)"
sudo reboot
```

不要在有 GPU 任务时尝试用 `modprobe -r` 热切换整套 NVIDIA 模块。重启是更可靠的模块边界。

---

## 5. 重启后的官方驱动验收

### 第 1 步：确认驱动和 DKMS 来源

```bash
cat /proc/driver/nvidia/version
modinfo nvidia | grep -E '^(filename|version|license|signer):'
dkms status | grep nvidia
nvidia-smi --query-gpu=index,name,pci.bus_id,driver_version,memory.total --format=csv
```

应满足：

- 驱动版本为 595.71.05；
- 构建标识为 NVIDIA 官方构建，不是本机补丁构建；
- DKMS 仅显示 `nvidia/595.71.05`；
- 不存在 `nvidia-open-p2p` DKMS 条目。

### 第 2 步：确认 P2P 补丁已失效

```bash
nvidia-smi topo -p2p r
```

RTX 4090 GPU 对不应再显示补丁状态下的全 `OK`。具体状态文字可能随驱动版本变化。

再用官方 NCCL 做实际路径验证：

```bash
cd /home/antl/ncu/nccl-tests-master/build
NCCL_DEBUG=INFO \
NCCL_DEBUG_SUBSYS=INIT,P2P \
./all_reduce_perf -b 8M -e 128M -f 2 -g 3
```

预期不再出现 `via P2P/direct pointer`，通常会回退到 `via SHM/direct`。测试仍应为 0 wrong；恢复官方版本并不意味着 NCCL 应失败。

### 第 3 步：确认 GDR shim 已失效

```bash
env | grep -E '^(LD_PRELOAD|GDRSHIM_)' || true
readlink -f "$(ldconfig -p | awk '/libnccl.so.2/{print $NF; exit}')"
```

NCCL 应解析到系统官方库，而不是 `/opt/rtx4090-gdr`。

如果需要验证非 GDR 网络路径，可在跨节点/隔离网络命名空间测试中明确设置：

```bash
NCCL_NET_GDR_LEVEL=LOC NCCL_DEBUG=INFO NCCL_DEBUG_SUBSYS=NET <测试命令>
```

预期数据经 host staging，并且不加载 `libgdrshim.so`。不要用单节点普通 AllReduce 判断 GDR，因为单节点默认不会使用 NET/IB。

### 第 4 步：检查系统健康

```bash
sudo apt-get check
journalctl -k -b --no-pager | grep -Ei 'NVRM|Xid|BAR|nvidia'
nvidia-smi
```

不得存在 Xid、API mismatch、固件缺失或模块加载失败。

## 6. 恢复版本 hold

确认官方驱动稳定后，可重新固定匹配版本，避免自动升级其中一部分：

```bash
sudo apt-mark hold \
  nvidia-dkms-open nvidia-kernel-source-open \
  nvidia-kernel-common nvidia-firmware nvidia-modprobe \
  libnvidia-compute libnvidia-cfg1 libnvidia-decode libnvidia-encode \
  libnvidia-fbc1 libnvidia-gl libnvidia-gpucomp nvidia-persistenced \
  xserver-xorg-video-nvidia
```

是否 hold CUDA 和 NCCL 取决于站点升级策略，但同一个维护周期内应避免只升级半套驱动。

## 7. 可选清理

只有在官方版本完成验收后，才考虑清理非官方运行产物：

```text
/opt/rtx4090-gdr/
/usr/src/nvidia-open-p2p-595.71.05/
```

优先归档而不是直接删除，并保存 SHA-256、源码、构建信息和有效测试日志。`apt`/DKMS 正常卸载后，`/usr/src/nvidia-open-p2p-595.71.05` 通常已被包管理器处理。

保留以下资料不会影响官方驱动运行：

```text
/home/antl/ncu/p2p/
/home/antl/ncu/P2P and GDR Log/
/home/antl/perftest-gdr/
```

## 8. 如果要升级到新的官方驱动分支

“恢复官方”和“升级驱动”最好分成两个维护窗口。先按本文恢复官方 595.71.05 并验收，再升级到仓库推荐版本。

升级前执行：

```bash
ubuntu-drivers devices
apt-cache policy nvidia-driver-595-open nvidia-driver-580-open
```

如果决定升级，必须把以下组件作为一个版本集合处理：

- NVIDIA DKMS/kernel source；
- kernel common 和 firmware；
- `libnvidia-*` 用户态库；
- `nvidia-modprobe`、`nvidia-persistenced`；
- 显示驱动（若安装）；
- 与目标驱动兼容的 CUDA/NCCL。

不要只安装候选版本的 `nvidia-dkms-open`。本机 CUDA 仓库的候选版本可能高于当前 595 分支，单包升级容易造成 `NVRM: API mismatch`。

## 9. 故障恢复

### 重启后 `nvidia-smi` 失败

```bash
uname -r
dkms status
modinfo nvidia | grep -E '^(filename|version):'
cat /proc/driver/nvidia/version 2>/dev/null
journalctl -k -b --no-pager | grep -Ei 'NVRM|Xid|nvidia|firmware'
```

重点检查：当前内核是否有 headers、DKMS 是否为该内核安装、内核模块与 `libcuda`/NVML 是否同版本。

### 系统里同时出现两个 NVIDIA DKMS 名称

不要重启进入不确定状态。先用：

```bash
dkms status | grep nvidia
dpkg-query -W -f='${binary:Package}\t${Version}\t${Status}\n' \
  | grep -E '^nvidia-(open-p2p-dkms|dkms-open|dkms-[0-9]+-open)'
```

确定保留哪一套包，再通过 `apt` 和 `dkms remove` 正常卸载另一套。

### apt 因 hold 或版本依赖拒绝操作

先模拟并显式指定同一版本，不要使用 `--fix-broken` 盲目接受候选版本：

```bash
apt-mark showhold | grep -E 'nvidia|libnvidia'
apt-cache policy <相关包>
sudo apt-get -s install <包名>=<同一完整版本>
```

## 10. 最终验收清单

- [ ] 所有 GPU/NCCL 业务在维护前已正常停止；
- [ ] 业务和容器中不再注入 `libgdrshim.so`；
- [ ] 业务不再从补丁 NCCL 目录加载 `libnccl.so.2`；
- [ ] `nvidia-open-p2p-dkms` 包和 DKMS 条目均不存在；
- [ ] 官方 `nvidia/595.71.05` DKMS 已为当前内核安装；
- [ ] NVIDIA 内核模块、固件、NVML、CUDA 用户态库版本匹配；
- [ ] `nvidia-smi` 正常，内核日志无 Xid/API mismatch；
- [ ] NCCL 不再走补丁 P2P 路径，但测试仍为 0 wrong；
- [ ] 跨节点测试不再加载 shim，网络回退路径工作正常；
- [ ] 已保存恢复前后包清单、DKMS 状态和测试日志。

## 11. 本机恢复参考状态

截至 2026-09-04，本机已观察到的官方状态为：

```text
nvidia-dkms-open                 595.71.05-1ubuntu1
nvidia-kernel-source-open        595.71.05-1ubuntu1
nvidia-kernel-common             595.71.05-1ubuntu1
nvidia-firmware                  595.71.05-1ubuntu1
nvidia-modprobe                  595.71.05-1ubuntu1
DKMS: nvidia/595.71.05, 6.8.0-138-generic, x86_64: installed
```

这个状态可作为恢复成功的本机基准，但实际执行前仍须以 `uname -r` 和 `apt-cache policy` 的实时输出为准。