---
title: RTX 4090 P2P与GDR解锁指南
Author: Mango
top_img: transparent
tags:
  - AI
  - AI Infra
categories:
  - AIInfra
abbrlink: deffa08e
date: 2026-09-05 23:42:39
cover:
---

> 适用范围：Ubuntu 22.04、RTX 4090、NVIDIA 595.71.05 open 驱动、CUDA 13、NCCL 2.31.x，以及 ConnectX-6/7 RoCE 网络。
>
> 本文依据本机 `/home/antl/ncu` 中的补丁驱动、NCCL Tests 和实验报告整理。P2P 与 GDR 均属于非官方改造，不受 NVIDIA 支持。驱动安装或切换会中断所有 GPU 任务，并需要重启。

## 先理解 P2P 与 GDR

P2P 和 GDR 解决的是两类不同问题：

| 功能                  | 数据路径                        | 主要用途               | 本机实现方式                    |
| --------------------- | ------------------------------- | ---------------------- | ------------------------------- |
| PCIe P2P              | GPU 显存直接访问另一张 GPU 显存 | 单机多卡 NCCL、DDP、TP | 社区补丁版 NVIDIA open 内核模块 |
| GPUDirect RDMA（GDR） | RNIC 直接 DMA 到/从 GPU 显存    | 跨节点 IB/RoCE 通信    | NV503C 注册 shim + 补丁 NCCL    |

正确顺序是：**先完成 P2P，再配置 GDR**。P2P 成功不等于 GDR 成功；`nvidia_peermem` 已加载也不等于 GeForce 的显存已经能被 RNIC 注册。

## 已验证的软件组合

本机资料记录的成功组合如下：

| 组件         | 已验证版本或位置                                             |
| ------------ | ------------------------------------------------------------ |
| 补丁驱动     | `nvidia-open-p2p-dkms 595.71.05-1`                           |
| 驱动安装包   | `/home/antl/ncu/p2p/nvidia-open-p2p-dkms_595.71.05-1_all.deb` |
| 补丁源码     | `/home/antl/ncu/p2p/open-gpu-kernel-modules-595.71.05-p2p-48g/` |
| CUDA         | 13.0                                                         |
| NCCL         | 2.31.2 + CUDA 13.3                                           |
| NCCL Tests   | `/home/antl/ncu/nccl-tests-master/build/`                    |
| GDR perftest | `/home/antl/perftest-gdr/`                                   |
| RDMA 栈      | MLNX_OFED 26.01，ConnectX-6/7                                |

不要把不同 NVIDIA 分支的内核模块、固件和用户态库混用。例如，595.71.05 补丁模块应配套 595.71.05 用户态库和固件。

> 状态提示：截至 2026-09-04，本机当前加载的是官方 `nvidia/595.71.05` DKMS，而不是补丁 DKMS。本文描述的是重新部署补丁的流程，不代表当前机器已经处于解锁状态。

## 操作前检查与备份

### 第 1 步：安排维护窗口

确认没有训练、推理、桌面会话或容器占用 GPU：

```bash
nvidia-smi
nvidia-smi --query-compute-apps=pid,process_name,gpu_uuid --format=csv
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Image}}'
```

如果仍有任务，先从任务自身的管理方式正常停止。不要在 GPU 正被使用时卸载模块或切换驱动。

### 第 2 步：记录当前状态

```bash
mkdir -p "$HOME/nvidia-before-p2p-gdr"
nvidia-smi -q > "$HOME/nvidia-before-p2p-gdr/nvidia-smi-q.txt"
nvidia-smi topo -m > "$HOME/nvidia-before-p2p-gdr/topology.txt"
dpkg-query -W > "$HOME/nvidia-before-p2p-gdr/packages.txt"
apt-mark showhold > "$HOME/nvidia-before-p2p-gdr/holds.txt"
dkms status > "$HOME/nvidia-before-p2p-gdr/dkms.txt"
uname -a > "$HOME/nvidia-before-p2p-gdr/uname.txt"
```

### 第 3 步：确认硬件和启动条件

```bash
nvidia-smi --query-gpu=index,name,pci.bus_id,driver_version,memory.total --format=csv
nvidia-smi topo -m
mokutil --sb-state
uname -r
dpkg -s "linux-headers-$(uname -r)" | grep '^Status:'
```

要求：

- 至少两张 RTX 4090；
- 当前内核的 headers 已安装；
- Secure Boot 已关闭，或已正确签名并注册自编译模块；
- BIOS 中开启 Above 4G Decoding；若硬件支持，也建议开启 Re-Size BAR；
- IOMMU/ACS 不应强制把同组 GPU 的 peer 流量重定向到主机内存。

### 第 4 步：校验本地材料

```bash
P2P_DEB=/home/antl/ncu/p2p/nvidia-open-p2p-dkms_595.71.05-1_all.deb
test -r "$P2P_DEB" || { echo "缺少 $P2P_DEB"; exit 1; }
dpkg-deb -f "$P2P_DEB" Package Version Depends Conflicts Provides
sha256sum "$P2P_DEB"
```

应看到包名 `nvidia-open-p2p-dkms`、版本 `595.71.05-1`。建议把输出的 SHA-256 保存到变更记录中。

---

## 第一部分：解锁 RTX 4090 PCIe P2P

### 第 1 步：确认 595.71.05 用户态组件齐全

```bash
dpkg-query -W -f='${binary:Package}\t${Version}\t${Status}\n' \
  nvidia-firmware nvidia-kernel-common nvidia-modprobe \
  libnvidia-compute libnvidia-cfg1 nvidia-persistenced
```

这些包应全部为 `595.71.05-1ubuntu1`，且状态为 `install ok installed`。如果版本不一致，先修复版本一致性，不要继续安装补丁模块。

可用下面的命令检查仓库是否仍提供精确版本：

```bash
apt-cache policy nvidia-firmware nvidia-kernel-common nvidia-modprobe \
  libnvidia-compute libnvidia-cfg1 nvidia-persistenced
```

### 第 2 步：预演移除官方 DKMS 模块

补丁包的控制文件不会自动排除本机 CUDA 仓库使用的 `nvidia-dkms-open` 包名，因此必须显式移除官方 DKMS 包，避免系统中出现两份 `nvidia.ko`。

先只做模拟：

```bash
sudo apt-get -s remove nvidia-dkms-open nvidia-kernel-source-open
```

检查模拟结果。它不应移除 CUDA 工具链、NCCL 或大量 NVIDIA 用户态库。若模拟输出明显超出这两个内核构建包，停止并先解决包依赖。

### 第 3 步：移除官方 DKMS，安装补丁 DKMS

如果相关包被 hold，先仅解除这两个包的 hold：

```bash
sudo apt-mark unhold nvidia-dkms-open nvidia-kernel-source-open
sudo apt-get remove --allow-change-held-packages \
  nvidia-dkms-open nvidia-kernel-source-open
sudo apt-get install \
  "linux-headers-$(uname -r)" dkms g++
sudo apt-get install \
  /home/antl/ncu/p2p/nvidia-open-p2p-dkms_595.71.05-1_all.deb
```

安装脚本会为所有已安装且具有 headers 的内核编译五个模块，但不会热重载正在运行的 NVIDIA 驱动。

### 第 4 步：检查 DKMS 结果

```bash
dkms status -m nvidia-open-p2p -v 595.71.05
modinfo -k "$(uname -r)" nvidia | grep -E '^(filename|version|license):'
find "/lib/modules/$(uname -r)/updates/dkms" -maxdepth 1 \
  -type f -name 'nvidia*.ko*' -print
```

`dkms status` 必须显示当前内核为 `installed`。如果不是，检查：

```bash
sudo dkms build -m nvidia-open-p2p -v 595.71.05 -k "$(uname -r)"
sudo dkms install -m nvidia-open-p2p -v 595.71.05 \
  -k "$(uname -r)" --force
```

然后更新 initramfs：

```bash
sudo update-initramfs -u -k "$(uname -r)"
```

### 第 5 步：固定版本并重启

防止普通系统升级把补丁模块替换成其他版本：

```bash
sudo apt-mark hold nvidia-open-p2p-dkms \
  nvidia-firmware nvidia-kernel-common nvidia-modprobe \
  libnvidia-compute libnvidia-cfg1 libnvidia-decode libnvidia-encode \
  libnvidia-fbc1 libnvidia-gl libnvidia-gpucomp nvidia-persistenced \
  xserver-xorg-video-nvidia
sudo reboot
```

### 第 6 步：重启后验证加载的是补丁模块

```bash
cat /proc/driver/nvidia/version
modinfo nvidia | grep -E '^(filename|version|license):'
dkms status | grep nvidia
nvidia-smi
nvidia-smi topo -p2p r
```

预期结果：

- NVRM 版本为 `595.71.05`；
- DKMS 名称为 `nvidia-open-p2p/595.71.05`；
- `nvidia-smi topo -p2p r` 的 GPU 对显示 `OK`；
- 内核日志没有 Xid、BAR 映射失败或模块版本不匹配：

```bash
journalctl -k -b --no-pager | grep -Ei 'NVRM|Xid|BAR|nvidia'
```

### 第 7 步：用 NCCL 验证实际 P2P 路径

双路 CPU 或多个 PCIe Host Bridge 的机器通常需要显式允许 `SYS` 级 P2P。以下命令按本机当前三张 GPU 编写：

```bash
cd /home/antl/ncu/nccl-tests-master/build
NCCL_P2P_LEVEL=SYS \
NCCL_LOCAL_REGISTER=0 \
NCCL_GRAPH_REGISTER=0 \
NCCL_DEBUG=INFO \
NCCL_DEBUG_SUBSYS=INIT,P2P \
./all_reduce_perf -b 8M -e 1G -f 2 -g 3
```

如果 GPU 数量不同，修改 `-g`。多进程“一进程一卡”可按原始资料使用 `mpirun -np <GPU数> ... -g 1`。

成功日志应同时满足：

```text
isAllCudaP2p 1
isAllDirectP2p 1
via P2P/direct pointer
#wrong 0
Out of bounds values : 0 OK
```

仅看到 `P2P Chunksize` 不能证明数据实际走 P2P。如果日志是 `via SHM/direct`，说明 NCCL 仍在经过主机共享内存。

本机三卡实测参考：强制 `NCCL_P2P_LEVEL=SYS` 后平均 bus bandwidth 约 `23.99 GB/s`；默认 `SHM/direct` 约 `6.48 GB/s`。硬件拓扑、消息大小和 GPU 数量变化会影响结果。

### 第 8 步：给业务任务启用 P2P

建议只给目标任务设置变量，不要先写入全局 `/etc/environment`：

```bash
NCCL_P2P_LEVEL=SYS \
NCCL_LOCAL_REGISTER=0 \
NCCL_GRAPH_REGISTER=0 \
torchrun ...
```

BAR1 较小时，保持两个 REGISTER 变量为 `0`，避免 NCCL 用户缓冲区注册耗尽动态 BAR1 窗口。

---

## 第二部分：解锁 RTX 4090 GPUDirect RDMA

### 重要限制

在本机 4090 + 595.71.05 上，以下两条官方路径都已被实验确认不可用：

- 对普通 CUDA GPU 指针调用 `ibv_reg_mr` 返回 `EFAULT`；
- CUDA dma-buf 路径返回 `NOT_SUPPORTED/801`。

因此，仅执行 `modprobe nvidia_peermem` **不能**完成 4090 GDR 解锁。已验证方案包含两层：

1. P2P 补丁驱动提供 NV503C third-party P2P 能力；
2. 用户态 shim 精确跟踪 UVM/RM 映射，并在 RDMA 注册前执行 `REGISTER_VA_SPACE` 和 `REGISTER_VIDMEM`；NCCL 还需配套的 4090 GDR 能力探测补丁。

### 先做材料完整性门禁

当前 `ncu` 中保存了最终报告和完整历史会话，但**没有独立保存最终版 `libgdrshim.c`、`libgdrshim.so` 和补丁 NCCL 目录**。在从已验证环境或备份找回这些产物之前，不要尝试凭报告片段重新拼装生产 shim。

建议将找回的产物固定为以下结构：

```text
/home/antl/ncu/gdr/
├── libgdrshim.c
├── libgdrshim.so
├── nccl-gdr/
│   └── lib/libnccl.so.2
├── SHA256SUMS
└── README-build-info.txt
```

其中 `README-build-info.txt` 至少记录：源码提交、编译器、NCCL 基线版本、补丁内容、构建命令和验证日志哈希。

执行门禁：

```bash
GDR_DIR=/home/antl/ncu/gdr
test -r "$GDR_DIR/libgdrshim.so"
test -r "$GDR_DIR/nccl-gdr/lib/libnccl.so.2"
(cd "$GDR_DIR" && sha256sum -c SHA256SUMS)
```

任一步失败都应停止。历史会话压缩包只能作为审计和恢复线索，不能代替经过校验的最终源码产物。

### 检查 RDMA 基础环境

#### 第 1 步：检查驱动与设备

```bash
lsmod | grep -E '^(mlx5_core|mlx5_ib|ib_core|nvidia_peermem)'
ibv_devices
ibv_devinfo
rdma link show
ibdev2netdev
nvidia-smi topo -m
```

选择与目标 GPU NUMA 距离最近的 RNIC。`PIX/PXB/PHB/NODE` 通常优于跨 NUMA 的 `SYS`。

#### 第 2 步：加载 peermem 模块

```bash
sudo modprobe nvidia_peermem
lsmod | grep '^nvidia_peermem'
modinfo nvidia_peermem | grep -E '^(filename|version|description):'
```

再次强调：这一步只建立内核侧 peer-memory 框架，不是最终 GDR 成功证据。

#### 第 3 步：检查 RoCE 端口

```bash
ibdev2netdev
show_gids
ip -br link
ip -br address
```

根据现场网络填写接口、IP、GID index 和 HCA。不要照抄旧报告中的接口名或 GID index，因为它们可能随 OFED、固件和网络配置变化。

旧环回实验使用的是：

| 端口 | 网络接口       | RDMA 设备 | IP                |
| ---- | -------------- | --------- | ----------------- |
| A    | `enp65s0f0np0` | `mlx5_0`  | `10.100.100.1/24` |
| B    | `enp65s0f1np1` | `mlx5_1`  | `10.100.100.2/24` |

如果邻居发现不可靠，可在确认双方实时 MAC 后临时固定邻居项：

```bash
sudo ip neigh replace <对端IP> lladdr <对端MAC> \
  dev <本地接口> nud permanent
```

不要把旧报告里的 MAC 地址固化到启动脚本。

### 先用 perftest 验证 GDR 数据面

`/home/antl/perftest-gdr` 已集成 NV503C 注册路径。两端或两个物理环回端口准备好后，先在接收端运行：

```bash
cd /home/antl/perftest-gdr
GPUDIRECT_GPU=0 ./ib_write_bw \
  -d <接收端HCA> -x <GID_INDEX> \
  --use_cuda=0 -s 16777216 -n 100 --report_gbits
```

再在发送端运行：

```bash
cd /home/antl/perftest-gdr
GPUDIRECT_GPU=0 ./ib_write_bw \
  -d <发送端HCA> -x <GID_INDEX> \
  --use_cuda=0 -s 16777216 -n 100 --report_gbits \
  <接收端IP>
```

旧环回实验在 ConnectX-6 100 Gb/s 上取得约 `69.35 Gb/s`，GPU1 路径约 `68.62 Gb/s`。这个数值仅作参考。

若要证明数据路径而不只是带宽，需要同时满足：

- RDMA work completion 成功；
- 接收端逐字节数据校验通过；
- 无 timeout、retry、sequence error；
- `nvidia-smi dmon` 可观察到显著 PCIe RX/TX 流量。

### 部署 NCCL GDR shim

只有在“先做材料完整性门禁”一节的产物校验通过后执行。

#### 第 1 步：在隔离目录部署，不覆盖系统库

```bash
sudo install -d -m 0755 \
  /opt/rtx4090-gdr/lib \
  /opt/rtx4090-gdr/nccl-gdr
sudo install -m 0755 \
  /home/antl/ncu/gdr/libgdrshim.so \
  /opt/rtx4090-gdr/lib/libgdrshim.so
sudo cp -a \
  /home/antl/ncu/gdr/nccl-gdr/. \
  /opt/rtx4090-gdr/nccl-gdr/
```

不要覆盖 `/usr/lib/x86_64-linux-gnu/libnccl.so.2`。通过进程级环境变量选择补丁版本，便于立即回退。

#### 第 2 步：做最小加载测试

```bash
LD_PRELOAD=/opt/rtx4090-gdr/lib/libgdrshim.so /bin/true
ldd /opt/rtx4090-gdr/nccl-gdr/lib/libnccl.so.2
```

#### 第 3 步：给跨节点 NCCL 任务启用 GDR

以下变量必须在所有 rank 中一致：

```bash
export LD_PRELOAD=/opt/rtx4090-gdr/lib/libgdrshim.so
export LD_LIBRARY_PATH=/opt/rtx4090-gdr/nccl-gdr/lib:${LD_LIBRARY_PATH:-}
export NCCL_IB_DISABLE=0
export NCCL_IB_HCA=<mlx5设备列表>
export NCCL_IB_GID_INDEX=<现场确认的GID_INDEX>
export NCCL_NET_GDR_LEVEL=SYS
export NCCL_DEBUG=INFO
export NCCL_DEBUG_SUBSYS=INIT,NET
```

然后启动跨节点 NCCL Tests。单节点普通 AllReduce 会优先使用 P2P/SHM，不会自然验证网络 GDR。旧实验使用两个独立网络命名空间和两个物理 RNIC 端口，强制两个 rank 经过 RoCE。

#### 第 4 步：判定 NCCL GDR 是否真正成功

日志至少应包含：

```text
GPU Direct RDMA Enabled
GDR 1
```

同时必须满足：

- NCCL Tests 返回码为 0；
- 所有尺寸 `#wrong` 为 0；
- `Out of bounds values : 0 OK`；
- shim 日志为精确 UVM 映射命中（历史报告称为 `pass0`）；
- 没有 `illegal memory access`、`EFAULT`、`NV_ERR_STATE_IN_USE` 或 NCCL WARN。

只看到 `GDR 1` 不足以证明正确。历史实验曾出现 NCCL 报告 GDR 已启用，但因为错误关联 GPU 内存对象而产生大量 wrong 和 CUDA illegal memory access；这种结果必须判定为失败。

旧双容器最终有效结果：1 GiB AllReduce 的 GDR bus bandwidth 为 `5.88 GB/s`，非 GDR 为 `5.09 GB/s`，且两组均为 0 wrong。

## 业务运行建议

把 P2P/GDR 配置写进具体任务或容器的启动脚本，而不是全局环境：

```bash
env \
  NCCL_P2P_LEVEL=SYS \
  NCCL_LOCAL_REGISTER=0 \
  NCCL_GRAPH_REGISTER=0 \
  LD_PRELOAD=/opt/rtx4090-gdr/lib/libgdrshim.so \
  LD_LIBRARY_PATH=/opt/rtx4090-gdr/nccl-gdr/lib:${LD_LIBRARY_PATH:-} \
  NCCL_IB_DISABLE=0 \
  NCCL_IB_HCA=<mlx5设备列表> \
  NCCL_IB_GID_INDEX=<GID_INDEX> \
  NCCL_NET_GDR_LEVEL=SYS \
  torchrun ...
```

容器还需要映射 GPU、RDMA character devices 和相应网络接口。不要仅为了 GDR 使用 `--privileged`；应按实际需要授权 `/dev/nvidia*`、`/dev/infiniband/*` 和网络能力。

## 常见问题

### P2P 矩阵是 OK，但 NCCL 仍走 SHM

设置 `NCCL_P2P_LEVEL=SYS`，并通过 `NCCL_DEBUG=INFO` 查看是否出现 `via P2P/direct pointer`。本机 GPU 间拓扑为 `NODE`，默认策略不会始终选择跨 Host Bridge P2P。

### DKMS 编译失败

确认 headers、编译器和运行内核一致：

```bash
uname -r
ls -ld "/lib/modules/$(uname -r)/build"
dkms status
sudo tail -n 200 \
  /var/lib/dkms/nvidia-open-p2p/595.71.05/*/log/make.log
```

### 重启后 `nvidia-smi` 无法通信

先检查实际模块和设备节点：

```bash
cat /proc/driver/nvidia/version
modinfo nvidia | grep -E '^(filename|version):'
ls -l /dev/nvidia*
journalctl -k -b --no-pager | grep -Ei 'NVRM|Xid|nvidia'
```

设备节点缺失时可尝试 `sudo nvidia-modprobe -u -c=0`。如果模块版本或固件版本不一致，应按恢复指南回到官方驱动，不要反复热卸载正在使用的 GPU 模块。

### `nvidia_peermem` 已加载，但 `ibv_reg_mr` 仍返回 EFAULT

这是本机 RTX 4090 官方注册路径的已知表现。确认使用的是经过校验的 NV503C shim；加载 peermem 本身不能绕过 GeForce 的 RM 限制。

## 验收清单

- [ ] NVIDIA 内核模块、用户态库和固件都是 595.71.05；
- [ ] `dkms status` 只有目标补丁驱动提供 NVIDIA 模块；
- [ ] `nvidia-smi topo -p2p r` 的目标 GPU 对为 `OK`；
- [ ] NCCL 日志实际出现 `via P2P/direct pointer`；
- [ ] P2P 测试 0 wrong、无越界、无 Xid；
- [ ] GDR shim 和补丁 NCCL 通过 SHA-256 校验；
- [ ] perftest work completion 和数据校验均通过；
- [ ] 跨网络命名空间/跨节点 NCCL 日志出现 `GDR 1`；
- [ ] GDR NCCL 测试返回码 0、所有尺寸 0 wrong；
- [ ] 已保存安装版本、命令、日志和哈希，能够按恢复指南回退。

## 本机参考资料

- `../P2P and GDR Log/4090-p2p-enable-plan(1).md`
- `../P2P and GDR Log/GDR-卡间RDMA-最终报告.md`
- `../P2P and GDR Log/NCCL-GDR-双容器实验报告(1).md`
- `../P2P and GDR Log/dsh-session-session-d369e420-b137-4de2-bd0e-b22911944028 (1).zip`
- `../p2p/open-gpu-kernel-modules-595.71.05-p2p-48g/packaging/dkms/README.md`
