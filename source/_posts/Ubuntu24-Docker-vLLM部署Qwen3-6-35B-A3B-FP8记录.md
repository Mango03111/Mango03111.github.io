---
title: Ubuntu 24 + Docker + vLLM 部署 Qwen3.6-35B-A3B-FP8 记录
Author: Mango
top_img: transparent
tags:
  - AI
  - Code
  - AI Infra
categories:
  - 教程
abbrlink: 24f50170
date: 2026-06-10 21:56:56
cover:
---

本文记录在 **Ubuntu 24 Desktop** 系统上，使用 **Docker + vLLM** 部署 **Qwen3.6-35B-A3B-FP8** 大模型的完整流程。测试硬件为 **4 张 RTX 4090 24GB**，宿主机 NVIDIA 驱动版本为 **595.71.05**；本安装记录仅在此平台上经过验证，其余平台请按照自身需求调整策略。

本文目标是形成一套可复现的部署教程，因此只保留核心步骤，省略无意义的试错过程。

## 环境说明

本次部署环境如下：

```text
操作系统：Ubuntu 24 Desktop
显卡：4 × NVIDIA RTX 4090 24GB
NVIDIA 驱动：595.71.05
部署方式：Docker + vLLM OpenAI API Server
模型：Qwen/Qwen3.6-35B-A3B-FP8
模型存放目录：~/model
服务端口：8000
```

由于 4 张 4090 总显存为 96GB，推荐优先使用 **FP8 版本模型**，即：

```text
Qwen/Qwen3.6-35B-A3B-FP8
```

不建议一开始直接部署 BF16 原版，因为 35B BF16 权重和 KV Cache 会带来更大的显存压力。

## 检查显卡驱动

首先确认宿主机能够正常识别 GPU：

```bash
nvidia-smi
```

正常情况下应能看到 4 张 RTX 4090。

如果宿主机无法看到 GPU，需要先修复 NVIDIA 驱动，再继续 Docker 和 vLLM 部署。

## 安装 Docker Engine

先更新软件源：

```bash
sudo apt update
```

卸载系统中可能存在的旧版 Docker：

```bash
for pkg in docker.io docker-doc docker-compose docker-compose-v2 podman-docker containerd runc; do
    sudo apt remove -y $pkg
done
```

安装 Docker 官方源所需工具：

```bash
sudo apt install -y ca-certificates curl
```

添加 Docker 官方 GPG key：

```bash
sudo install -m 0755 -d /etc/apt/keyrings

sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  -o /etc/apt/keyrings/docker.asc

sudo chmod a+r /etc/apt/keyrings/docker.asc
```

添加 Docker apt 源：

```bash
sudo tee /etc/apt/sources.list.d/docker.sources > /dev/null <<'EOF'
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: noble
Components: stable
Architectures: amd64
Signed-By: /etc/apt/keyrings/docker.asc
EOF
```

如果你的系统不是 `amd64` 或 Ubuntu 24.04，不要直接复制上面的 `Suites: noble` 和 `Architectures: amd64`，应改成对应系统代号和架构。

安装 Docker：

```bash
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

启动 Docker：

```bash
sudo systemctl enable --now docker
```

将当前用户加入 docker 用户组：

```bash
sudo usermod -aG docker $USER
newgrp docker
```

测试 Docker：

```bash
docker run hello-world
```

## 安装 NVIDIA Container Toolkit

Docker 默认不能直接访问 NVIDIA GPU，需要安装 NVIDIA Container Toolkit。

安装依赖：

```bash
sudo apt-get update
sudo apt-get install -y --no-install-recommends ca-certificates curl gnupg2
```

添加 NVIDIA Container Toolkit GPG key：

```bash
curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | \
  sudo gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg
```

添加 NVIDIA Container Toolkit 源：

```bash
curl -s -L https://nvidia.github.io/libnvidia-container/stable/deb/nvidia-container-toolkit.list | \
  sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' | \
  sudo tee /etc/apt/sources.list.d/nvidia-container-toolkit.list
```

安装：

```bash
sudo apt-get update
sudo apt-get install -y nvidia-container-toolkit
```

配置 Docker runtime：

```bash
sudo nvidia-ctk runtime configure --runtime=docker
sudo systemctl restart docker
```

测试容器是否能访问 GPU：

```bash
docker run --rm --gpus all nvidia/cuda:12.4.1-base-ubuntu22.04 nvidia-smi
```

如果该命令能在容器内看到 4 张 RTX 4090，说明 Docker GPU 环境配置成功。

## 拉取 vLLM 镜像

拉取 vLLM OpenAI API Server 镜像：

```bash
docker pull vllm/vllm-openai:latest
```

查看 vLLM 版本：

```bash
docker run --rm \
  --entrypoint python \
  vllm/vllm-openai:latest \
  -c "import importlib.metadata as m; print(m.version('vllm'))"
```

本次测试版本为：

```text
0.22.1
```

该版本可以继续部署 Qwen3.6 系列模型。

## 准备模型目录

本教程将模型统一放到当前用户家目录下的 `model` 文件夹：

```bash
mkdir -p ~/model
```

模型最终目录建议为：

```text
~/model/Qwen3.6-35B-A3B-FP8
```

也就是完整路径类似：

```text
/home/antl/model/Qwen3.6-35B-A3B-FP8
```

## 下载模型

模型不一定要在 Docker 容器内下载。实际部署中，更推荐在宿主机下载模型，然后通过 Docker volume 挂载给 vLLM 容器使用。

### 创建 Python 虚拟环境

```bash
sudo apt update
sudo apt install -y python3-venv python3-pip git-lfs

python3 -m venv ~/hf-download
source ~/hf-download/bin/activate

pip install -U huggingface_hub hf_transfer
```

### 使用 Hugging Face 镜像源下载

如果服务器无法直连 Hugging Face，可以使用镜像源：

```bash
export HF_ENDPOINT=https://hf-mirror.com
export HF_HUB_ENABLE_HF_TRANSFER=1
```

然后下载模型：

```bash
hf download Qwen/Qwen3.6-35B-A3B-FP8 \
  --local-dir ~/model/Qwen3.6-35B-A3B-FP8
```

如果有 Hugging Face Token，可以提前设置：

```bash
read -rsp "HF_TOKEN: " HF_TOKEN
echo
export HF_TOKEN
```

然后再执行下载命令。

### 检查模型文件

下载完成后检查目录：

```bash
ls -lh ~/model/Qwen3.6-35B-A3B-FP8
```

正常情况下应该能看到类似文件：

```text
config.json
generation_config.json
tokenizer.json
tokenizer_config.json
model.safetensors.index.json
model-00001-of-xxxxx.safetensors
model-00002-of-xxxxx.safetensors
...
```

查看模型目录大小：

```bash
du -sh ~/model/Qwen3.6-35B-A3B-FP8
```

如果不确定模型下载到了哪里，可以用：

```bash
find ~/model -maxdepth 3 -name "config.json" -print
```

## 启动 vLLM 服务

模型下载完成后，通过 Docker 启动 vLLM。

### 推荐基础启动命令

```bash
docker rm -f qwen36-vllm 2>/dev/null || true

docker run -d \
  --name qwen36-vllm \
  --gpus '"device=0,1,2,3"' \
  --ipc=host \
  --shm-size 32g \
  -p 8000:8000 \
  -v "$HOME/model:/model:ro" \
  -e HF_HUB_OFFLINE=1 \
  -e TRANSFORMERS_OFFLINE=1 \
  vllm/vllm-openai:latest \
  --model /model/Qwen3.6-35B-A3B-FP8 \
  --served-model-name qwen36 \
  --tensor-parallel-size 4 \
  --max-model-len 32768 \
  --gpu-memory-utilization 0.90 \
  --reasoning-parser qwen3 \
  --language-model-only \
  --enable-prefix-caching
```

参数说明：

```text
--gpus '"device=0,1,2,3"'
```

指定使用 4 张 GPU。

```text
-v "$HOME/model:/model:ro"
```

将宿主机的 `~/model` 挂载到容器内 `/model`，并以只读方式加载模型。

```text
-e HF_HUB_OFFLINE=1
-e TRANSFORMERS_OFFLINE=1
```

强制离线加载本地模型，避免容器启动时访问 Hugging Face。

```text
--model /model/Qwen3.6-35B-A3B-FP8
```

指定容器内的模型路径。

```text
--served-model-name qwen36
```

指定 API 调用时使用的模型名。

```text
--tensor-parallel-size 4
```

使用 4 卡 Tensor Parallel。

```text
--max-model-len 32768
```

初始上下文长度设置为 32K，适合作为稳定起步配置。

```text
--language-model-only
```

只运行语言模型部分，释放更多显存给文本推理和 KV Cache。

```text
--enable-prefix-caching
```

开启前缀缓存，适合多轮或重复前缀场景。

## 查看启动日志

启动后查看日志：

```bash
docker logs -f --tail=200 qwen36-vllm
```

正常情况下最后会看到类似：

```text
Uvicorn running on http://0.0.0.0:8000
```

同时可以另开终端查看显存：

```bash
watch -n 1 nvidia-smi
```

![586X107/启动界面.png](https://img.pagehost.cn/autoupload/sGsLTdNbILw_FMc-EyyWvNiO_OyvX7mIgxFBfDMDErs/20260610/HQc8/586X107/%E5%90%AF%E5%8A%A8%E7%95%8C%E9%9D%A2.png)

## 测试 OpenAI 兼容接口

### 查看模型列表

```bash
curl http://127.0.0.1:8000/v1/models
```

如果服务正常，应能看到模型名 `qwen36`。

### 测试对话接口

```bash
curl -s http://127.0.0.1:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen36",
    "messages": [
      {
        "role": "user",
        "content": "你好，用三句话介绍一下你自己。"
      }
    ],
    "max_tokens": 512,
    "temperature": 0.6
  }'
```

如果能正常返回文本，说明 vLLM 服务已经部署成功。

## 配置 200K 长上下文

如果需要尝试将上下文长度设置到 200K，需要重新启动容器，并调大 `--max-model-len`。

需要注意：4 张 4090 的总显存为 96GB，200K 上下文会占用大量 KV Cache，因此不保证一定成功。建议先从 128K 或 131K 逐步上调。

### 直接尝试 200K

```bash
docker rm -f qwen36-vllm 2>/dev/null || true

docker run -d \
  --name qwen36-vllm \
  --gpus '"device=0,1,2,3"' \
  --ipc=host \
  --shm-size 64g \
  -p 8000:8000 \
  -v "$HOME/model:/model:ro" \
  -e HF_HUB_OFFLINE=1 \
  -e TRANSFORMERS_OFFLINE=1 \
  vllm/vllm-openai:latest \
  --model /model/Qwen3.6-35B-A3B-FP8 \
  --served-model-name qwen36 \
  --tensor-parallel-size 4 \
  --max-model-len 200000 \
  --gpu-memory-utilization 0.96 \
  --kv-cache-dtype fp8 \
  --enable-chunked-prefill \
  --max-num-seqs 1 \
  --max-num-batched-tokens 8192 \
  --reasoning-parser qwen3 \
  --language-model-only \
  --enable-prefix-caching
```

长上下文参数说明：

```text
--max-model-len 200000
```

设置最大上下文长度为 200K token。这里的长度包括输入 prompt 和输出 token。

```text
--kv-cache-dtype fp8
```

使用 FP8 KV Cache，降低长上下文时的显存占用。

```text
--enable-chunked-prefill
```

开启分块 prefill，适合长 prompt 输入。

```text
--max-num-seqs 1
```

限制为单并发，优先保证超长上下文能跑起来。

```text
--max-num-batched-tokens 8192
```

控制每次调度的 token 数，避免长 prompt 一次性占用过多资源。

### 更稳妥的 131K 启动命令

如果 200K 失败，可以先尝试 131072：

```bash
docker rm -f qwen36-vllm 2>/dev/null || true

docker run -d \
  --name qwen36-vllm \
  --gpus '"device=0,1,2,3"' \
  --ipc=host \
  --shm-size 64g \
  -p 8000:8000 \
  -v "$HOME/model:/model:ro" \
  -e HF_HUB_OFFLINE=1 \
  -e TRANSFORMERS_OFFLINE=1 \
  vllm/vllm-openai:latest \
  --model /model/Qwen3.6-35B-A3B-FP8 \
  --served-model-name qwen36 \
  --tensor-parallel-size 4 \
  --max-model-len 131072 \
  --gpu-memory-utilization 0.96 \
  --kv-cache-dtype fp8 \
  --enable-chunked-prefill \
  --max-num-seqs 1 \
  --max-num-batched-tokens 8192 \
  --reasoning-parser qwen3 \
  --language-model-only \
  --enable-prefix-caching
```

推荐逐级测试：

```text
65536 → 98304 → 131072 → 160000 → 180000 → 200000
```

如果某一级启动失败，说明当前显存和 KV Cache 配置不足以支撑该上下文长度。


## TP 与 PP 并行模式测试记录

在基础部署完成后，进一步对 **TP=4** 和 **PP=4** 两种并行模式进行了对比测试。测试场景均基于 **Qwen3.6-35B-A3B-FP8**，上下文长度配置为 **32K**，主要观察单并发与 10 并发下的吞吐、排队状态和显存占用。

这里的 TP 指 **Tensor Parallel**，即将同一层的张量计算切分到多张 GPU 上；PP 指 **Pipeline Parallel**，即将模型层按阶段切分到不同 GPU 上。

### 测试环境

```text
模型：Qwen3.6-35B-A3B-FP8
显卡：4 × RTX 4090 24GB
vLLM：0.22.1
上下文长度：32768
测试模式：TP=4、PP=4
测试并发：1 并发、10 并发
观察指标：generation throughput、Running/Waiting 请求数、GPU 显存占用、GPU 利用率
```

### PP=4 ，`max-num-seqs=10` 测试结果

PP=4 的启动逻辑为：

```text
--tensor-parallel-size 1
--pipeline-parallel-size 4
--max-model-len 32768
```

测试结果如下：

| 场景              |             vLLM 日志状态 |           生成吞吐 | GPU KV Cache 使用率 | 现象                                     |
| ----------------- | ------------------------: | -----------------: | ------------------: | ---------------------------------------- |
| PP=4，单并发 32K  |  `Running: 1, Waiting: 0` |       约 105 tok/s |      约 0.3% ~ 0.6% | 单请求速度较低                           |
| PP=4，10 并发 32K | `Running: 10, Waiting: 0` | 约 498 ~ 508 tok/s |      约 3.1% ~ 3.7% | 多并发后 pipeline 被填满，总吞吐明显提升 |

PP 模式下 `nvidia-smi` 观察到的显存占用大致为：

```text
GPU0：约 20.6GB / 24GB
GPU1：约 20.6GB / 24GB
GPU2：约 20.6GB / 24GB
GPU3：约 22.5GB / 24GB
```

![886X859/4pp模式.png](https://img.pagehost.cn/autoupload/sGsLTdNbILw_FMc-EyyWvNiO_OyvX7mIgxFBfDMDErs/20260610/32uJ/886X859/4pp%E6%A8%A1%E5%BC%8F.png)

pp单发：

![1059X241/pp单并发32k上下文.png](https://img.pagehost.cn/autoupload/sGsLTdNbILw_FMc-EyyWvNiO_OyvX7mIgxFBfDMDErs/20260610/6RHN/1059X241/pp%E5%8D%95%E5%B9%B6%E5%8F%9132k%E4%B8%8A%E4%B8%8B%E6%96%87.png)

pp10并发：

![1067X125/pp10并发32k上下文.png](https://img.pagehost.cn/autoupload/sGsLTdNbILw_FMc-EyyWvNiO_OyvX7mIgxFBfDMDErs/20260610/2WqW/1067X125/pp10%E5%B9%B6%E5%8F%9132k%E4%B8%8A%E4%B8%8B%E6%96%87.png)

可以看到，PP 的显存分布并不完全均衡，最后一张卡占用更高。这通常与最后一个 pipeline stage 承担额外输出层、norm、lm_head 或调度相关开销有关。PP 的单并发速度较低，主要原因是单个请求无法充分填满流水线，会产生 pipeline bubble；但当并发数提高后，多个请求可以同时处于不同 pipeline stage 中，因此总吞吐明显提升。

### TP=4，`max-num-seqs=1` 测试结果

TP=4 的基础启动逻辑为：

```text
--tensor-parallel-size 4
--max-model-len 32768
--max-num-seqs 1
```

测试结果如下：

| 场景                                |            vLLM 日志状态 |           生成吞吐 | GPU KV Cache 使用率 | 现象                            |
| ----------------------------------- | -----------------------: | -----------------: | ------------------: | ------------------------------- |
| TP=4，单并发 32K，`max-num-seqs=1`  | `Running: 1, Waiting: 0` | 约 157 ~ 166 tok/s |      约 0.2% ~ 0.4% | 单请求速度明显高于 PP           |
| TP=4，10 并发 32K，`max-num-seqs=1` | `Running: 1, Waiting: 9` | 约 153 ~ 164 tok/s |      约 0.2% ~ 0.4% | 只有 1 个请求运行，其余请求排队 |

这个结果说明：当 `max-num-seqs=1` 时，即使外部同时提交 10 个请求，vLLM 也只会让 1 个请求进入运行队列，其余请求处于 waiting 状态。因此该场景下的 10 并发吞吐仍然接近单并发吞吐。

TP=4 在 `max-num-seqs=1` 时，显存占用大约为：

```text
GPU0：约 22.6GB / 24GB
GPU1：约 22.6GB / 24GB
GPU2：约 22.6GB / 24GB
GPU3：约 22.6GB / 24GB
```

![887X859/4tp模式seq1.png](https://img.pagehost.cn/autoupload/sGsLTdNbILw_FMc-EyyWvNiO_OyvX7mIgxFBfDMDErs/20260610/u740/887X859/4tp%E6%A8%A1%E5%BC%8Fseq1.png)

单发：

![1081X101/tp单并发32k上下文seq1.png](https://img.pagehost.cn/autoupload/sGsLTdNbILw_FMc-EyyWvNiO_OyvX7mIgxFBfDMDErs/20260610/qST9/1081X101/tp%E5%8D%95%E5%B9%B6%E5%8F%9132k%E4%B8%8A%E4%B8%8B%E6%96%87seq1.png)

10并发：

![1079X124/tp10并发32k上下文seq1.png](https://img.pagehost.cn/autoupload/sGsLTdNbILw_FMc-EyyWvNiO_OyvX7mIgxFBfDMDErs/20260610/nQLQ/1079X124/tp10%E5%B9%B6%E5%8F%9132k%E4%B8%8A%E4%B8%8B%E6%96%87seq1.png)

TP 的显存分布更均衡，4 张卡都参与同一请求的张量计算，因此单请求速度明显更高。

### TP=4，`max-num-seqs=10` 测试结果

为了公平测试 TP 模式下的 10 并发能力，将 `max-num-seqs` 调整为 10：

```text
--tensor-parallel-size 4
--max-model-len 32768
--max-num-seqs 10
```

测试结果如下：

| 场景                                 |             vLLM 日志状态 |           生成吞吐 | GPU KV Cache 使用率 | 现象                                  |
| ------------------------------------ | ------------------------: | -----------------: | ------------------: | ------------------------------------- |
| TP=4，单并发 32K，`max-num-seqs=10`  |  `Running: 1, Waiting: 0` | 约 152 ~ 159 tok/s |      约 0.2% ~ 0.4% | 单请求速度与 `max-num-seqs=1` 接近    |
| TP=4，10 并发 32K，`max-num-seqs=10` | `Running: 10, Waiting: 0` | 约 634 ~ 654 tok/s |      约 2.1% ~ 2.9% | 10 个请求全部进入运行队列，总吞吐最高 |

TP=4 在 `max-num-seqs=10` 时，显存占用大约为：

```text
GPU0：约 23.5GB / 24GB
GPU1：约 23.5GB / 24GB
GPU2：约 23.5GB / 24GB
GPU3：约 23.5GB / 24GB
```

![890X840/4tp模式seq10.png](https://img.pagehost.cn/autoupload/sGsLTdNbILw_FMc-EyyWvNiO_OyvX7mIgxFBfDMDErs/20260610/dcUw/890X840/4tp%E6%A8%A1%E5%BC%8Fseq10.png)

单发：

![1072X120/tp单并发32k上下文seq10.png](https://img.pagehost.cn/autoupload/sGsLTdNbILw_FMc-EyyWvNiO_OyvX7mIgxFBfDMDErs/20260610/rBu7/1072X120/tp%E5%8D%95%E5%B9%B6%E5%8F%9132k%E4%B8%8A%E4%B8%8B%E6%96%87seq10.png)

并发：

![1070X165/tp10并发32k上下文seq10_(2).png](https://img.pagehost.cn/autoupload/sGsLTdNbILw_FMc-EyyWvNiO_OyvX7mIgxFBfDMDErs/20260610/LfWD/1070X165/tp10%E5%B9%B6%E5%8F%9132k%E4%B8%8A%E4%B8%8B%E6%96%87seq10_%282%29.png)

此时 4 张卡利用率基本接近 100%，总吞吐达到本次测试最高值。但显存也已经非常接近 4090 24GB 的上限，每张卡大约只剩 1GB 左右余量，因此该配置适合性能测试，不一定适合长期稳定服务。

### TP 与 PP 对比结论

整理后的关键对比如下：

| 模式 | 并发 | 关键参数          | 运行状态                  |     生成吞吐 | 结论                     |
| ---- | ---: | ----------------- | ------------------------- | -----------: | ------------------------ |
| PP=4 |    1 | `max-num-seqs=10` | `Running: 1, Waiting: 0`  | 约 105 tok/s | 单并发较慢               |
| PP=4 |   10 | `max-num-seqs=10` | `Running: 10, Waiting: 0` | 约 500 tok/s | 多并发吞吐明显提升       |
| TP=4 |    1 | `max-num-seqs=1`  | `Running: 1, Waiting: 0`  | 约 160 tok/s | 单并发优于 PP            |
| TP=4 |   10 | `max-num-seqs=1`  | `Running: 1, Waiting: 9`  | 约 160 tok/s | 并发被限制，其他请求排队 |
| TP=4 |    1 | `max-num-seqs=10` | `Running: 1, Waiting: 0`  | 约 155 tok/s | 单并发基本不受影响       |
| TP=4 |   10 | `max-num-seqs=10` | `Running: 10, Waiting: 0` | 约 640 tok/s | 本次测试吞吐最高         |

从测试结果看，在本机 **4×RTX 4090** 环境下，**TP=4 是 32K 上下文场景下更优的主力配置**。它不仅单请求速度高于 PP=4，在放开 `max-num-seqs=10` 后，多并发总吞吐也高于 PP=4。

PP=4 的优势是前几张卡显存压力略低，多并发时可以通过填满 pipeline 提升总吞吐；但在本次测试中，其单并发速度和 10 并发总吞吐都低于 TP=4。TP=4 的主要问题是显存更紧，尤其是 `max-num-seqs=10` 时，每张 4090 已接近满显存。

### 关于 `max-num-seqs` 的理解

`max-num-seqs` 可以理解为 vLLM 调度器允许同时进入运行队列的请求序列数量上限之一。

当设置为：

```text
--max-num-seqs 1
```

10 个请求同时进入时，会出现：

```text
Running: 1, Waiting: 9
```

当设置为：

```text
--max-num-seqs 10
```

10 个请求同时进入时，如果显存和 token batch 预算允许，会出现：

```text
Running: 10, Waiting: 0
```

它与 `max-num-batched-tokens` 的区别可以这样理解：

```text
max-num-seqs：限制一次最多同时运行多少条请求序列
max-num-batched-tokens：限制一次调度中最多处理多少 token
```

因此，在长上下文场景中，例如 128K 或 200K，应优先降低 `max-num-seqs`，保证单条长上下文请求能够运行；在 32K 多并发吞吐测试中，可以适当提高 `max-num-seqs`，提升总吞吐。

### 并行模式选择建议

| 使用场景                     | 推荐配置                    | 原因                                                         |
| ---------------------------- | --------------------------- | ------------------------------------------------------------ |
| 自己使用、低并发聊天         | TP=4，`max-num-seqs=1~2`    | 单请求速度最高，显存更可控                                   |
| 32K 上下文，多用户吞吐测试   | TP=4，`max-num-seqs=8~10`   | 本次测试中总吞吐最高                                         |
| 长期稳定服务                 | TP=4，`max-num-seqs=8` 左右 | 比 10 更稳，避免显存过于贴边                                 |
| 极限长上下文，例如 128K/200K | TP=4，`max-num-seqs=1`      | 优先保证 KV Cache 空间                                       |
| 想继续探索折中方案           | TP=2 + PP=2                 | 可能在无 NVLink 的 4090 平台上兼顾通信与流水线效率，需要单独测试 |

本次测试后的实践结论是：**4×RTX 4090 部署 Qwen3.6-35B-A3B-FP8 时，32K 上下文下优先使用 TP=4；单并发用 `max-num-seqs=1~2`，多并发服务可尝试 `max-num-seqs=8`，Benchmark 可尝试 `max-num-seqs=10`。**

## 常用管理命令

查看容器状态：

```bash
docker ps
```

查看日志：

```bash
docker logs -f --tail=200 qwen36-vllm
```

停止服务：

```bash
docker stop qwen36-vllm
```

删除容器：

```bash
docker rm -f qwen36-vllm
```

重新启动已存在容器：

```bash
docker start qwen36-vllm
```

查看 GPU 使用情况：

```bash
watch -n 1 nvidia-smi
```

## 常见问题处理

### Docker 容器看不到 GPU

先测试：

```bash
docker run --rm --gpus all nvidia/cuda:12.4.1-base-ubuntu22.04 nvidia-smi
```

如果失败，重新配置 NVIDIA Container Toolkit：

```bash
sudo nvidia-ctk runtime configure --runtime=docker
sudo systemctl restart docker
```

然后再次测试。

### vLLM 启动时报显存不足

优先降低上下文长度：

```text
32768 → 16384 → 8192
```

也可以适当降低显存利用率：

```text
--gpu-memory-utilization 0.88
```

如果使用长上下文，建议加：

```text
--kv-cache-dtype fp8
--max-num-seqs 1
--enable-chunked-prefill
```

### 不支持 `--language-model-only`

如果日志中出现：

```text
unrecognized arguments: --language-model-only
```

说明当前 vLLM 镜像不支持该参数，删除这一行后重新启动即可。

### 多卡 NCCL 初始化慢或卡住

4 张 4090 没有 NVLink，多卡通信依赖 PCIe/NCCL。如果初始化很慢，可以加日志变量：

```bash
-e NCCL_DEBUG=INFO
```

如果长期卡住，可以尝试禁用 P2P：

```bash
-e NCCL_P2P_DISABLE=1
```

示例：

```bash
docker run -d \
  --name qwen36-vllm \
  --gpus '"device=0,1,2,3"' \
  --ipc=host \
  --shm-size 32g \
  -p 8000:8000 \
  -v "$HOME/model:/model:ro" \
  -e HF_HUB_OFFLINE=1 \
  -e TRANSFORMERS_OFFLINE=1 \
  -e NCCL_DEBUG=INFO \
  -e NCCL_P2P_DISABLE=1 \
  vllm/vllm-openai:latest \
  --model /model/Qwen3.6-35B-A3B-FP8 \
  --served-model-name qwen36 \
  --tensor-parallel-size 4 \
  --max-model-len 16384 \
  --gpu-memory-utilization 0.88 \
  --reasoning-parser qwen3 \
  --enable-prefix-caching
```

注意：禁用 P2P 可能降低性能，只建议在 NCCL 初始化异常时尝试。

## 推荐最终配置

对于 4 × RTX 4090，推荐根据目标场景选择不同配置。

### 日常低并发配置

如果主要是自己使用，或者服务低并发用户，推荐使用 TP=4 和较小并发上限：

```bash
docker rm -f qwen36-vllm 2>/dev/null || true

docker run -d \
  --name qwen36-vllm \
  --gpus '"device=0,1,2,3"' \
  --ipc=host \
  --shm-size 32g \
  -p 8000:8000 \
  -v "$HOME/model:/model:ro" \
  -e HF_HUB_OFFLINE=1 \
  -e TRANSFORMERS_OFFLINE=1 \
  vllm/vllm-openai:latest \
  --model /model/Qwen3.6-35B-A3B-FP8 \
  --served-model-name qwen36 \
  --tensor-parallel-size 4 \
  --max-model-len 32768 \
  --gpu-memory-utilization 0.90 \
  --kv-cache-dtype fp8 \
  --enable-chunked-prefill \
  --max-num-seqs 2 \
  --max-num-batched-tokens 8192 \
  --reasoning-parser qwen3 \
  --language-model-only \
  --enable-prefix-caching
```

该配置更适合交互式使用，单请求速度较高，显存压力相对可控。

### 32K 多并发稳定服务配置

如果目标是 32K 上下文下服务多个并发请求，可以使用：

```bash
docker rm -f qwen36-vllm 2>/dev/null || true

docker run -d \
  --name qwen36-vllm \
  --gpus '"device=0,1,2,3"' \
  --ipc=host \
  --shm-size 64g \
  -p 8000:8000 \
  -v "$HOME/model:/model:ro" \
  -e HF_HUB_OFFLINE=1 \
  -e TRANSFORMERS_OFFLINE=1 \
  vllm/vllm-openai:latest \
  --model /model/Qwen3.6-35B-A3B-FP8 \
  --served-model-name qwen36 \
  --tensor-parallel-size 4 \
  --max-model-len 32768 \
  --gpu-memory-utilization 0.92 \
  --kv-cache-dtype fp8 \
  --enable-chunked-prefill \
  --max-num-seqs 8 \
  --max-num-batched-tokens 8192 \
  --reasoning-parser qwen3 \
  --language-model-only \
  --enable-prefix-caching
```

本次测试中，TP=4、`max-num-seqs=10` 的 10 并发吞吐可以达到约 634~654 tok/s，但显存已经非常接近上限。因此长期服务建议先使用 `max-num-seqs=8`，在稳定后再根据实际请求长度和显存余量决定是否提高到 10。

### Benchmark 配置

如果只是做 10 并发性能测试，可以将：

```text
--max-num-seqs 8
```

改成：

```text
--max-num-seqs 10
```

该配置在本次测试中 10 并发生成吞吐最高，但不建议在未知请求长度的生产环境中长期贴显存上限运行。

### 长上下文配置

如果需要长上下文，可以再逐步提高：

```text
65536 → 98304 → 131072 → 160000 → 180000 → 200000
```

长上下文推荐附加：

```text
--kv-cache-dtype fp8
--enable-chunked-prefill
--max-num-seqs 1
--max-num-batched-tokens 8192
--gpu-memory-utilization 0.96
```

长上下文和高并发不要同时追求。对于 128K 或 200K 场景，应先保证单请求能稳定运行，再逐步测试并发能力。

## 总结

本次部署的核心思路是：

1. 宿主机安装 NVIDIA 驱动，确保 `nvidia-smi` 能看到 4 张 4090。
2. 安装 Docker Engine。
3. 安装 NVIDIA Container Toolkit，让 Docker 容器可以访问 GPU。
4. 拉取 `vllm/vllm-openai:latest` 镜像。
5. 在宿主机使用 Hugging Face CLI 或镜像源下载模型到 `~/model`。
6. 启动 vLLM 容器时，通过 `-v "$HOME/model:/model:ro"` 挂载本地模型。
7. 使用 OpenAI 兼容接口访问模型。
8. 32K 场景下优先使用 TP=4；如果需要多并发吞吐，需要合理设置 `max-num-seqs`。
9. 如果需要 128K/200K 长上下文，需要结合 FP8 KV Cache、chunked prefill 和单并发配置逐步尝试。

对于本次 4 × RTX 4090 平台，测试后的推荐结论是：

```text
模型：Qwen3.6-35B-A3B-FP8
主力并行方式：Tensor Parallel 4
常规上下文长度：32768
低并发：max-num-seqs=1~2
稳定多并发：max-num-seqs≈8
Benchmark：max-num-seqs=10
长上下文：max-num-seqs=1，逐级提高 max-model-len
```

本次 TP/PP 对比测试中，TP=4 在 32K 单并发下约 157~166 tok/s，高于 PP=4 的约 105 tok/s；TP=4 在 `max-num-seqs=10` 的 10 并发下约 634~654 tok/s，也高于 PP=4 10 并发的约 498~508 tok/s。因此，在当前硬件和模型组合下，**TP=4 是更适合作为主力服务配置的方案**。