---
title: Ubuntu24原生环境安装与测试NVBandwidth记录
Author: Mango
top_img: transparent
tags:
  - AI
  - Code
  - AI Infra
categories:
  - 教程
abbrlink: 97a78550
date: 2026-06-10 21:54:18
cover:
---

NVBandwidth 是 NVIDIA 官方提供的 GPU 带宽测试工具，用于测量 **CPU↔GPU、GPU↔GPU、GPU 显存读写、Copy Engine、SM 拷贝内核**等路径的实际带宽。NVBandwidth 的测试结果可以帮助分析 vLLM 使用 TP/PP 多卡推理时，GPU 间通信是否成为性能瓶颈。

本文档记录在 **Ubuntu 24 Desktop/Server 环境**下，针对 **4 张 NVIDIA RTX 4090**，使用 **原生环境**安装 CUDA Toolkit 13.2、编译并测试 NVIDIA NVBandwidth 的完整流程。

本文档不使用 Docker 进行测试，适用于希望在宿主机上直接运行 `nvbandwidth` 的场景。

---

## 环境说明

当前测试环境：

| 项目                  | 配置                                |
| --------------------- | ----------------------------------- |
| 操作系统              | Ubuntu 24                           |
| GPU                   | 4 × NVIDIA GeForce RTX 4090         |
| NVIDIA 驱动版本       | 595.71.05                           |
| CUDA Toolkit 目标版本 | CUDA Toolkit 13.2                   |
| 测试工具              | NVIDIA NVBandwidth                  |
| 测试方式              | 宿主机原生编译与运行，不使用 Docker |

说明：

- 当前驱动版本 `595.71.05` 已经足够新，可以配合 CUDA Toolkit 13.x 使用。
- 本流程只安装 `cuda-toolkit-13-2`，不安装 `cuda` 或 `cuda-13-2` 这类可能牵涉驱动变更的完整 CUDA meta package。
- RTX 4090 属于 Ada Lovelace 架构，CUDA 架构号为 `sm_89`，编译时建议显式指定 `CMAKE_CUDA_ARCHITECTURES=89`。
- RTX 4090 没有 NVLink，因此 NVBandwidth 的 GPU-GPU 测试主要反映 PCIe/P2P 路径带宽，而不是 NVLink 带宽。

---

## 测试前准备

如果当前正在运行 vLLM 或其他占用显存的程序，建议先停止，否则 NVBandwidth 可能因为显存不足导致测试失败或结果不稳定。

如果 vLLM 是通过 Docker 容器启动的，可以执行：

```bash
sudo docker stop qwen36-vllm
```

查看当前显存占用：

```bash
nvidia-smi
```

确认 4 张 RTX 4090 都能正常识别，并且没有明显的大显存占用进程。

---

## 安装基础编译依赖

先安装编译 NVBandwidth 所需的基础工具：

```bash
sudo apt update

sudo apt install -y \
  build-essential \
  gcc \
  g++ \
  make \
  cmake \
  git \
  pkg-config \
  libboost-program-options-dev
```

检查 CMake 版本：

```bash
cmake --version
```

Ubuntu 24 自带的 CMake 一般可以满足 NVBandwidth 编译需求。

---

## 添加 NVIDIA CUDA 官方 APT 源

Ubuntu 24.04 对应的 NVIDIA CUDA 仓库为 `ubuntu2404`。

进入临时目录：

```bash
cd /tmp
```

下载并安装 CUDA keyring：

```bash
wget https://developer.download.nvidia.com/compute/cuda/repos/ubuntu2404/x86_64/cuda-keyring_1.1-1_all.deb

sudo dpkg -i cuda-keyring_1.1-1_all.deb
```

更新软件源：

```bash
sudo apt update
```

---

## 安装 CUDA Toolkit 13.2

先确认 `cuda-toolkit-13-2` 是否可用：

```bash
apt-cache policy cuda-toolkit-13-2
```

如果输出中存在 `Candidate` 版本，说明可以安装。

建议先进行模拟安装，确认不会替换驱动：

```bash
sudo apt install -s cuda-toolkit-13-2
```

重点检查模拟输出里是否出现类似下面的驱动相关包：

```text
nvidia-driver
cuda-drivers
```

如果没有出现驱动替换或驱动安装行为，可以继续安装 Toolkit：

```bash
sudo apt install -y cuda-toolkit-13-2
```

注意，不建议执行：

```bash
sudo apt install cuda
```

也不建议执行：

```bash
sudo apt install cuda-13-2
```

本流程只需要安装：

```bash
sudo apt install cuda-toolkit-13-2
```

这样主要安装 CUDA 开发工具链，包括 `nvcc`，避免不必要地改动当前 NVIDIA 驱动环境。

---

## 配置 CUDA 环境变量

CUDA 13.2 安装完成后，一般位于：

```bash
/usr/local/cuda-13.2
```

检查 CUDA 安装目录：

```bash
ls /usr/local | grep cuda
```

临时配置当前终端环境：

```bash
export CUDA_HOME=/usr/local/cuda-13.2
export PATH=$CUDA_HOME/bin:$PATH
export LD_LIBRARY_PATH=$CUDA_HOME/lib64:$LD_LIBRARY_PATH
```

写入 `~/.bashrc`，使其长期生效：

```bash
echo 'export CUDA_HOME=/usr/local/cuda-13.2' >> ~/.bashrc
echo 'export PATH=$CUDA_HOME/bin:$PATH' >> ~/.bashrc
echo 'export LD_LIBRARY_PATH=$CUDA_HOME/lib64:$LD_LIBRARY_PATH' >> ~/.bashrc

source ~/.bashrc
```

验证 `nvcc`：

```bash
which nvcc
nvcc --version
```

正常情况下，应该能看到 CUDA Compiler 的版本信息。

再次确认驱动状态：

```bash
nvidia-smi
```

需要确认：

- 4 张 RTX 4090 都存在；
- 驱动版本仍然是 `595.71.05`；
- 没有异常报错。

---

## 查看 GPU 拓扑

NVBandwidth 的 GPU-GPU 测试结果需要结合 PCIe 拓扑分析，因此建议先保存拓扑信息。

```bash
nvidia-smi topo -m
```

常见拓扑标记含义：

| 标记 | 含义                                            |
| ---- | ----------------------------------------------- |
| PIX  | GPU 间经过同一个 PCIe Switch，路径较近          |
| PXB  | GPU 间经过多个 PCIe Bridge/Switch               |
| PHB  | GPU 间经过 PCIe Host Bridge                     |
| SYS  | GPU 间跨 CPU Socket，路径较远                   |
| NODE | GPU 间路径跨 NUMA Node，但不跨 SMP Interconnect |
| NV#  | NVLink 链路数量，4090 通常不会出现              |

RTX 4090 没有 NVLink，因此 GPU-GPU 带宽主要取决于：

- 主板 PCIe 拓扑；
- 是否经过同一个 PCIe Switch；
- 是否跨 CPU Socket；
- PCIe 版本与链路宽度；
- P2P 是否可用；
- BIOS 中 Above 4G Decoding、Resizable BAR、IOMMU 等配置。

---

## 下载 NVBandwidth 源码

建议将测试工具放在 `~/tools` 目录下：

```bash
mkdir -p ~/tools
cd ~/tools
```

从 NVIDIA 官方 GitHub 仓库下载：

```bash
git clone https://github.com/NVIDIA/nvbandwidth.git
cd nvbandwidth
```

如果 GitHub 访问较慢，可以使用镜像代理：

```bash
git clone https://gh-proxy.com/https://github.com/NVIDIA/nvbandwidth.git
cd nvbandwidth
```

---

## 编译 NVBandwidth

确认当前目录为 NVBandwidth 源码目录：

```bash
pwd
```

应类似：

```text
/home/antl/tools/nvbandwidth
```

编译时指定 RTX 4090 的 CUDA 架构 `sm_89`：

```bash
cmake -S . -B build -DCMAKE_CUDA_ARCHITECTURES=89
cmake --build build -j"$(nproc)"
```

检查二进制文件是否生成：

```bash
ls -lh build/nvbandwidth
```

如果能看到 `build/nvbandwidth`，说明编译成功。

---

## 查看 NVBandwidth 帮助与测试项

查看帮助：

```bash
./build/nvbandwidth -h
```

列出所有可用测试项：

```bash
./build/nvbandwidth -l
```

可以重点关注包含以下关键词的测试项：

```bash
./build/nvbandwidth -l | grep host
./build/nvbandwidth -l | grep device_to_device
./build/nvbandwidth -l | grep memcpy
```

---

## 运行完整测试

建议先使用 1024 MiB buffer，迭代 10 次：

```bash
./build/nvbandwidth -b 1024 -i 10
```

参数含义：

| 参数      | 含义                         |
| --------- | ---------------------------- |
| `-b 1024` | 每次测试使用 1024 MiB buffer |
| `-i 10`   | 每个测试项迭代 10 次         |

如果出现显存不足，可以降低 buffer：

```bash
./build/nvbandwidth -b 512 -i 10
```

或者：

```bash
./build/nvbandwidth -b 256 -i 5
```

---

## 单项测试命令

不同版本 NVBandwidth 的 testcase 名称可能略有差异，建议先使用：

```bash
./build/nvbandwidth -l
```

确认具体 testcase 名称后再运行。

### CPU 到 GPU 带宽

常见测试项：

```bash
./build/nvbandwidth -t host_to_device_memcpy_ce -b 1024 -i 10
```

该测试主要反映：

```text
Host Memory -> GPU Memory
```

也就是 CPU 到 GPU 的 H2D 拷贝带宽。

### GPU 到 CPU 带宽

常见测试项：

```bash
./build/nvbandwidth -t device_to_host_memcpy_ce -b 1024 -i 10
```

该测试主要反映：

```text
GPU Memory -> Host Memory
```

也就是 GPU 到 CPU 的 D2H 拷贝带宽。

### GPU 到 GPU 读带宽

先查看具体名称：

```bash
./build/nvbandwidth -l | grep device_to_device
```

常见测试命令：

```bash
./build/nvbandwidth -t device_to_device_memcpy_read_ce -b 1024 -i 10
```

### GPU 到 GPU 写带宽

先查看具体名称：

```bash
./build/nvbandwidth -l | grep device_to_device
```

常见测试命令：

```bash
./build/nvbandwidth -t device_to_device_memcpy_write_ce -b 1024 -i 10
```

如果提示 testcase 不存在，以 `./build/nvbandwidth -l` 输出为准。

---

## 保存测试结果

建议创建专门目录保存测试结果：

```bash
mkdir -p ~/nvbandwidth-results
```

保存完整测试结果为 JSON：

```bash
./build/nvbandwidth -b 1024 -i 10 -j \
  > ~/nvbandwidth-results/nvbandwidth-4x4090-$(date +%F-%H%M).json
```

保存 GPU 拓扑：

```bash
nvidia-smi topo -m \
  > ~/nvbandwidth-results/topo-4x4090-$(date +%F-%H%M).txt
```

保存当前驱动和 GPU 状态：

```bash
nvidia-smi \
  > ~/nvbandwidth-results/nvidia-smi-4x4090-$(date +%F-%H%M).txt
```

推荐最终至少保留三类文件：

```text
topo-4x4090-日期时间.txt
nvidia-smi-4x4090-日期时间.txt
nvbandwidth-4x4090-日期时间.json
```

---

## 结果解读方法

NVBandwidth 的输出通常包含矩阵，例如 GPU-GPU 测试可能类似：

```text
GPU(row) <- GPU(column) bandwidth GB/s
        0       1       2       3
0     0.0    xx.x    xx.x    xx.x
1    xx.x     0.0    xx.x    xx.x
2    xx.x    xx.x     0.0    xx.x
3    xx.x    xx.x    xx.x     0.0
```

解读时需要注意：

- 对角线通常不是关注重点，因为 GPU 自身到自身不代表跨 GPU 通信；
- GPU-GPU 带宽要结合 `nvidia-smi topo -m` 一起看；
- `SUM` 是聚合带宽，不等于单条链路带宽；
- 4090 没有 NVLink，因此 GPU-GPU 结果通常是 PCIe 路径带宽；
- 如果某些 GPU 对之间带宽明显偏低，可能与跨 CPU Socket、PCIe Switch 拓扑、P2P 不可用有关。

对于 vLLM 部署而言：

- Tensor Parallel 对 GPU-GPU 通信更敏感；
- Pipeline Parallel 对通信压力相对小一些，但单请求延迟可能更高；
- 如果 NVBandwidth 显示 GPU-GPU 带宽较差，PP 可能比 TP 更容易稳定，但吞吐和延迟需要实测；
- 如果 GPU 间 P2P 不可用或跨 NUMA 严重，TP=4 可能表现较差。

---

## 常见问题处理

### 找不到 nvcc

报错示例：

```text
No CMAKE_CUDA_COMPILER could be found
```

检查：

```bash
which nvcc
nvcc --version
echo $CUDA_HOME
```

如果 `nvcc` 实际存在于 `/usr/local/cuda-13.2/bin/nvcc`，但系统找不到，执行：

```bash
export CUDA_HOME=/usr/local/cuda-13.2
export PATH=$CUDA_HOME/bin:$PATH
export LD_LIBRARY_PATH=$CUDA_HOME/lib64:$LD_LIBRARY_PATH
```

然后重新编译：

```bash
rm -rf build
cmake -S . -B build -DCMAKE_CUDA_ARCHITECTURES=89
cmake --build build -j"$(nproc)"
```

### Boost 找不到

报错示例：

```text
Could NOT find Boost
```

安装依赖：

```bash
sudo apt install -y libboost-program-options-dev
```

然后重新编译：

```bash
rm -rf build
cmake -S . -B build -DCMAKE_CUDA_ARCHITECTURES=89
cmake --build build -j"$(nproc)"
```

### CUDA 架构不支持 89

报错示例：

```text
Unsupported gpu architecture 'compute_89'
```

说明 CUDA Toolkit 版本过旧，不支持 RTX 4090 的 `sm_89`。本流程使用 CUDA Toolkit 13.2，一般不会出现该问题。

检查：

```bash
nvcc --version
```

### GitHub 无法访问

如果源码下载失败，可以尝试镜像代理：

```bash
git clone https://gh-proxy.com/https://github.com/NVIDIA/nvbandwidth.git
```

或者在其他机器下载后拷贝到当前服务器。

---

## 推荐执行命令总览

如果从零开始，核心命令如下：

```bash
# 停止 vLLM，释放显存
docker stop qwen36-vllm

# 安装基础依赖
sudo apt update
sudo apt install -y \
  build-essential gcc g++ make cmake git pkg-config \
  libboost-program-options-dev

# 添加 NVIDIA CUDA APT 源
cd /tmp
wget https://developer.download.nvidia.com/compute/cuda/repos/ubuntu2404/x86_64/cuda-keyring_1.1-1_all.deb
sudo dpkg -i cuda-keyring_1.1-1_all.deb
sudo apt update

# 安装 CUDA Toolkit 13.2
apt-cache policy cuda-toolkit-13-2
sudo apt install -s cuda-toolkit-13-2
sudo apt install -y cuda-toolkit-13-2

# 配置 CUDA 环境变量
export CUDA_HOME=/usr/local/cuda-13.2
export PATH=$CUDA_HOME/bin:$PATH
export LD_LIBRARY_PATH=$CUDA_HOME/lib64:$LD_LIBRARY_PATH

echo 'export CUDA_HOME=/usr/local/cuda-13.2' >> ~/.bashrc
echo 'export PATH=$CUDA_HOME/bin:$PATH' >> ~/.bashrc
echo 'export LD_LIBRARY_PATH=$CUDA_HOME/lib64:$LD_LIBRARY_PATH' >> ~/.bashrc
source ~/.bashrc

# 检查 CUDA 与驱动
nvcc --version
nvidia-smi
nvidia-smi topo -m

# 下载并编译 NVBandwidth
mkdir -p ~/tools
cd ~/tools
git clone https://github.com/NVIDIA/nvbandwidth.git
cd nvbandwidth

cmake -S . -B build -DCMAKE_CUDA_ARCHITECTURES=89
cmake --build build -j"$(nproc)"

# 测试
./build/nvbandwidth -l
./build/nvbandwidth -b 1024 -i 10

# 保存结果
mkdir -p ~/nvbandwidth-results
./build/nvbandwidth -b 1024 -i 10 -j \
  > ~/nvbandwidth-results/nvbandwidth-4x4090-$(date +%F-%H%M).json
nvidia-smi topo -m \
  > ~/nvbandwidth-results/topo-4x4090-$(date +%F-%H%M).txt
nvidia-smi \
  > ~/nvbandwidth-results/nvidia-smi-4x4090-$(date +%F-%H%M).txt
```

---

## 后续测试结果记录

后续我会将实际测试结果补充到本节中。



