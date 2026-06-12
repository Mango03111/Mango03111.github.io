---
title: Ubuntu 24 + Docker + 4×RTX 4090 安装 Megatron-LM 并完成多卡训练测试
Author: Mango
top_img: transparent
date: 2026-06-11 19:50:40
tags:
 - AI
 - Code
 - AI Infra
categories:
 - 教程
cover:
---

## 环境说明

本文记录在一台单机 4 卡 RTX 4090 服务器上，通过 Docker 部署 NVIDIA Megatron-LM，并完成从环境安装、NCCL 通信验证到 GPT 小模型训练测试的完整流程。

本机环境如下：

```text
操作系统：Ubuntu 24 Desktop
GPU：4 × NVIDIA GeForce RTX 4090
NVIDIA Driver：595.71.05
容器运行环境：Docker + NVIDIA Container Toolkit
Megatron 路线：NVIDIA/Megatron-LM 主线版本
基础镜像：nvcr.io/nvidia/pytorch:26.01-py3
```

Megatron-LM 主要用于大模型训练和并行训练实验，和 vLLM 的定位不同：vLLM 更偏推理部署，Megatron-LM 更偏训练、预训练、继续预训练、模型并行和分布式训练验证。

---

## 停止已有 vLLM 容器

如果机器上正在运行的占用现存的服务，需要先停止，释放GPU。

```bash
docker ps
```

如果看到正在运行的 vLLM 容器，例如 `qwen36-vllm`，执行：

```bash
docker stop qwen36-vllm
```

确认 GPU 空闲：

```bash
nvidia-smi
```

---

## 创建 Megatron-LM 工作目录

在宿主机上创建统一目录：

```bash
mkdir -p ~/megatron/{code,data,checkpoints,logs,scripts}
```

目录含义如下：

```text
~/megatron/code          # Megatron-LM 源码
~/megatron/data          # 训练数据
~/megatron/checkpoints   # 训练产生的 checkpoint
~/megatron/logs          # 训练日志
~/megatron/scripts       # 启动脚本与环境脚本
~/model                  # 已有模型目录，可只读挂载进容器
```

---

## 拉取 NGC PyTorch 镜像

Megatron-LM 推荐使用 NVIDIA NGC PyTorch 容器，因为其中已经预装 PyTorch、CUDA、cuDNN、NCCL、Transformer Engine 等训练相关依赖。

```bash
docker pull nvcr.io/nvidia/pytorch:26.01-py3
```

如果拉取失败，可以登录 NGC：

```bash
docker login nvcr.io
```

用户名通常填写：

```text
$oauthtoken
```

密码填写自己的 NGC API Key。

---

## 下载 Megatron-LM 源码

考虑到部分服务器容器内网络不稳定，推荐在宿主机下载源码，再挂载进容器。

```bash
cd ~/megatron/code
git clone https://github.com/NVIDIA/Megatron-LM.git
```

如果 GitHub 访问较慢，可以使用镜像代理：

```bash
cd ~/megatron/code
git clone https://gh-proxy.com/https://github.com/NVIDIA/Megatron-LM.git
```

检查源码目录：

```bash
ls -lh ~/megatron/code/Megatron-LM
```

应能看到类似内容：

```text
megatron
examples
tools
tests
docs
pretrain_gpt.py
pyproject.toml
```

---

## 启动 Megatron-LM 开发容器

执行：

```bash
docker run -it \
  --name megatron-dev \
  --gpus all \
  --ipc=host \
  --network host \
  --shm-size=64g \
  --ulimit memlock=-1 \
  --ulimit stack=67108864 \
  -v "$HOME/megatron/code:/workspace/code" \
  -v "$HOME/megatron/data:/workspace/data" \
  -v "$HOME/megatron/checkpoints:/workspace/checkpoints" \
  -v "$HOME/megatron/logs:/workspace/logs" \
  -v "$HOME/megatron/scripts:/workspace/scripts" \
  -v "$HOME/model:/workspace/model:ro" \
  -e PIP_CONSTRAINT= \
  -e PIP_INDEX_URL=https://pypi.tuna.tsinghua.edu.cn/simple \
  -e PIP_TRUSTED_HOST=pypi.tuna.tsinghua.edu.cn \
  nvcr.io/nvidia/pytorch:26.01-py3 \
  bash
```

关键参数说明：

```text
--gpus all             # 允许容器使用全部 GPU
--ipc=host             # 避免多进程训练时共享内存不足
--network host         # 使用宿主机网络
--shm-size=64g         # 增大共享内存
--ulimit memlock=-1    # 解除内存锁限制
-v ~/megatron/...      # 挂载源码、数据、checkpoint、日志
-v ~/model:/workspace/model:ro  # 只读挂载已有模型目录
```

---

## 容器内检查 PyTorch 和 GPU

进入容器后执行：

```bash
python - <<'PY'
import torch

print("Torch:", torch.__version__)
print("CUDA available:", torch.cuda.is_available())
print("GPU count:", torch.cuda.device_count())

for i in range(torch.cuda.device_count()):
    print(i, torch.cuda.get_device_name(i))
PY
```

正常应看到 4 张 RTX 4090。

---

## 创建 Python 虚拟环境

由于新版 Python 对系统环境有 externally managed 保护，不建议直接向系统 Python 安装 Megatron-LM。因此在容器内创建虚拟环境，并继承 NGC 容器已有的 PyTorch/CUDA 依赖。

```bash
cd /workspace/code/Megatron-LM

python3 -m venv /workspace/megatron-venv --system-site-packages

source /workspace/megatron-venv/bin/activate
```

确认 Python 路径：

```bash
which python
which pip
```

应显示：

```text
/workspace/megatron-venv/bin/python
/workspace/megatron-venv/bin/pip
```

---

## 安装基础工具和 uv

```bash
python -m pip install -U pip setuptools wheel uv
```

为了避免和 NGC 容器自带包冲突，固定部分依赖版本：

```bash
cat > /workspace/megatron-constraints.txt <<'EOF'
packaging==25.0
numpy==2.3.5
click==8.4.1
EOF
```

---

## 设置 GitHub 代理和 PyPI 镜像源

如果服务器访问 GitHub 或 PyPI 较慢，可以配置：

```bash
git config --global url."https://gh-proxy.com/https://github.com/".insteadOf "https://github.com/"
```

设置 uv 镜像源：

```bash
export UV_DEFAULT_INDEX=https://pypi.tuna.tsinghua.edu.cn/simple
export UV_INDEX_URL=https://pypi.tuna.tsinghua.edu.cn/simple
```

---

## 安装 Megatron-LM

进入源码目录：

```bash
cd /workspace/code/Megatron-LM
source /workspace/megatron-venv/bin/activate
```

安装 build 依赖：

```bash
uv pip install \
  --default-index https://pypi.tuna.tsinghua.edu.cn/simple \
  -c /workspace/megatron-constraints.txt \
  --group build
```

安装 Megatron-LM 训练和开发依赖：

```bash
MAX_JOBS=4 uv pip install \
  --default-index https://pypi.tuna.tsinghua.edu.cn/simple \
  -c /workspace/megatron-constraints.txt \
  --no-build-isolation \
  -e ".[training,dev]"
```

安装完成后，应能看到类似：

```text
Built megatron-core
Installed xxx packages
megatron-core==0.19.0
```

如果看到如下 warning，可以暂时忽略：

```text
warning: The package `nvidia-modelopt==0.44.0` does not have an extra named `torch`
```

---

## 创建 Megatron 环境脚本

为了后续不用重复设置环境变量，创建统一环境脚本：

```bash
cat > /workspace/scripts/megatron_env.sh <<'EOF'
#!/bin/bash

source /workspace/megatron-venv/bin/activate

export PYTHONPATH=/workspace/code/Megatron-LM:$PYTHONPATH

export UV_DEFAULT_INDEX=https://pypi.tuna.tsinghua.edu.cn/simple
export UV_INDEX_URL=https://pypi.tuna.tsinghua.edu.cn/simple

export NCCL_DEBUG=WARN
export NCCL_IB_DISABLE=1
export NCCL_P2P_DISABLE=1
export NCCL_NET=Socket
export NCCL_SOCKET_IFNAME=lo

export CUDA_DEVICE_MAX_CONNECTIONS=1

cd /workspace/code/Megatron-LM
EOF

chmod +x /workspace/scripts/megatron_env.sh
```

以后进入容器后，只需要执行：

```bash
source /workspace/scripts/megatron_env.sh
```

---

## 验证 Megatron-LM 和 Transformer Engine

执行：

```bash
source /workspace/scripts/megatron_env.sh
```

检查 Megatron-LM：

```bash
python - <<'PY'
import torch
import megatron
import megatron.core

print("Megatron import OK")
print("Megatron Core import OK")
print("Torch:", torch.__version__)
print("CUDA available:", torch.cuda.is_available())
print("GPU count:", torch.cuda.device_count())

for i in range(torch.cuda.device_count()):
    print(i, torch.cuda.get_device_name(i))
PY
```

检查 Transformer Engine：

```bash
python - <<'PY'
try:
    import transformer_engine
    print("Transformer Engine import OK")
except Exception as e:
    print("Transformer Engine import FAILED:")
    print(e)
PY
```

如果都能正常 import，说明 Python 环境基本正常。

---

## 编写 NCCL 多卡通信测试脚本

创建脚本：

```bash
cat > /workspace/scripts/nccl_test.py <<'PY'
import os
import datetime
import torch
import torch.distributed as dist

local_rank = int(os.environ["LOCAL_RANK"])
rank = int(os.environ["RANK"])
world_size = int(os.environ["WORLD_SIZE"])

torch.cuda.set_device(local_rank)

print(
    f"[before init] rank={rank}, local_rank={local_rank}, "
    f"world_size={world_size}, device={torch.cuda.get_device_name(local_rank)}",
    flush=True,
)

dist.init_process_group(
    backend="nccl",
    timeout=datetime.timedelta(seconds=60),
)

print(f"[after init] rank={rank}, local_rank={local_rank}", flush=True)

x = torch.ones(1, device="cuda") * (rank + 1)
dist.all_reduce(x)
torch.cuda.synchronize()

print(f"[after all_reduce] rank={rank}, result={x.item()}", flush=True)

dist.destroy_process_group()
PY
```

先测试 2 卡：

```bash
source /workspace/scripts/megatron_env.sh

CUDA_VISIBLE_DEVICES=0,1 python -m torch.distributed.run \
  --standalone \
  --nnodes=1 \
  --nproc_per_node=2 \
  /workspace/scripts/nccl_test.py
```

2 卡成功时，结果应为：

```text
result=3.0
```

再测试 4 卡：

```bash
CUDA_VISIBLE_DEVICES=0,1,2,3 python -m torch.distributed.run \
  --standalone \
  --nnodes=1 \
  --nproc_per_node=4 \
  /workspace/scripts/nccl_test.py
```

4 卡成功时，结果应为：

```text
result=10.0
```

说明 4 卡 NCCL 通信正常。

---

## 运行 Megatron Core 最小训练测试

注意：这里不要直接使用系统里的 `torchrun`，而是使用：

```bash
python -m torch.distributed.run
```

这样可以确保使用虚拟环境中的 Python。

执行 2 卡测试：

```bash
source /workspace/scripts/megatron_env.sh

CUDA_VISIBLE_DEVICES=0,1 python -m torch.distributed.run \
  --standalone \
  --nnodes=1 \
  --nproc_per_node=2 \
  examples/run_simple_mcore_train_loop.py
```

如果看到：

```text
Successfully loaded the model
```

说明 Megatron Core 最小训练闭环成功。

可以继续测试 4 卡：

```bash
CUDA_VISIBLE_DEVICES=0,1,2,3 python -m torch.distributed.run \
  --standalone \
  --nnodes=1 \
  --nproc_per_node=4 \
  examples/run_simple_mcore_train_loop.py
```

---

## 准备 GPT 小模型训练数据

创建数据目录：

```bash
mkdir -p /workspace/data/gpt2_raw
mkdir -p /workspace/data/gpt2_mmap
mkdir -p /workspace/checkpoints/gpt2_tiny
mkdir -p /workspace/logs/gpt2_tiny
```

创建一个小 JSONL 数据集：

```bash
cat > /workspace/data/gpt2_raw/tiny_gpt.jsonl <<'EOF'
{"text": "Megatron-LM is a framework for training large transformer language models."}
{"text": "Tensor parallelism splits matrix operations across multiple GPUs."}
{"text": "Pipeline parallelism splits model layers across different GPU stages."}
{"text": "Data parallelism replicates the model and splits input batches."}
{"text": "This is a small dataset for testing GPT pretraining with Megatron-LM."}
{"text": "NCCL is used for communication between GPUs during distributed training."}
{"text": "This test verifies data preprocessing, model training, and checkpoint saving."}
EOF
```

复制多份，生成测试数据：

```bash
rm -f /workspace/data/gpt2_raw/tiny_gpt_repeat.jsonl

for i in $(seq 1 2000); do
  cat /workspace/data/gpt2_raw/tiny_gpt.jsonl >> /workspace/data/gpt2_raw/tiny_gpt_repeat.jsonl
done
```

检查：

```bash
wc -l /workspace/data/gpt2_raw/tiny_gpt_repeat.jsonl
```

---

## 下载 GPT-2 tokenizer 文件

需要两个文件：

```text
vocab.json
merges.txt
```

可以使用 Hugging Face 镜像下载：

```bash
export HF_ENDPOINT=https://hf-mirror.com

python - <<'PY'
from huggingface_hub import hf_hub_download

target_dir = "/workspace/data/gpt2_raw"

for filename in ["vocab.json", "merges.txt"]:
    path = hf_hub_download(
        repo_id="openai-community/gpt2",
        filename=filename,
        local_dir=target_dir,
    )
    print(path)
PY
```

检查：

```bash
ls -lh /workspace/data/gpt2_raw
```

应看到：

```text
vocab.json
merges.txt
tiny_gpt.jsonl
tiny_gpt_repeat.jsonl
```

---

## 预处理数据

当前版本的 `tools/preprocess_data.py` 不需要 `--dataset-impl mmap` 参数。直接执行：

```bash
source /workspace/scripts/megatron_env.sh

rm -f /workspace/data/gpt2_mmap/tiny_gpt*

python tools/preprocess_data.py \
  --input /workspace/data/gpt2_raw/tiny_gpt_repeat.jsonl \
  --output-prefix /workspace/data/gpt2_mmap/tiny_gpt \
  --tokenizer-type GPT2BPETokenizer \
  --vocab-file /workspace/data/gpt2_raw/vocab.json \
  --merge-file /workspace/data/gpt2_raw/merges.txt \
  --json-keys text \
  --append-eod \
  --workers 4
```

检查输出：

```bash
ls -lh /workspace/data/gpt2_mmap
```

应看到：

```text
tiny_gpt_text_document.bin
tiny_gpt_text_document.idx
```

---

## 2 卡 TP=2 GPT tiny 训练

创建训练脚本：

```bash
cat > /workspace/scripts/train_gpt_tiny_tp2.sh <<'EOF'
#!/bin/bash

source /workspace/scripts/megatron_env.sh

export CUDA_VISIBLE_DEVICES=0,1
export CUDA_DEVICE_MAX_CONNECTIONS=1

DATA_PATH=/workspace/data/gpt2_mmap/tiny_gpt_text_document
CHECKPOINT_PATH=/workspace/checkpoints/gpt2_tiny_tp2
TOKENIZER_DIR=/workspace/data/gpt2_raw
LOG_PATH=/workspace/logs/gpt2_tiny/train_tp2.log

mkdir -p $CHECKPOINT_PATH
mkdir -p /workspace/logs/gpt2_tiny

python -m torch.distributed.run \
  --standalone \
  --nnodes=1 \
  --nproc_per_node=2 \
  pretrain_gpt.py \
  --use-mcore-models \
  --transformer-impl transformer_engine \
  --tensor-model-parallel-size 2 \
  --pipeline-model-parallel-size 1 \
  --num-layers 4 \
  --hidden-size 256 \
  --ffn-hidden-size 1024 \
  --num-attention-heads 4 \
  --seq-length 128 \
  --max-position-embeddings 128 \
  --micro-batch-size 2 \
  --global-batch-size 8 \
  --train-iters 50 \
  --lr-decay-iters 50 \
  --save $CHECKPOINT_PATH \
  --load $CHECKPOINT_PATH \
  --data-path $DATA_PATH \
  --vocab-file $TOKENIZER_DIR/vocab.json \
  --merge-file $TOKENIZER_DIR/merges.txt \
  --tokenizer-type GPT2BPETokenizer \
  --split 949,50,1 \
  --distributed-backend nccl \
  --lr 1.0e-4 \
  --min-lr 1.0e-5 \
  --lr-decay-style cosine \
  --weight-decay 1e-2 \
  --clip-grad 1.0 \
  --lr-warmup-fraction 0.01 \
  --log-interval 1 \
  --save-interval 25 \
  --eval-interval 25 \
  --eval-iters 5 \
  --bf16 2>&1 | tee $LOG_PATH
EOF

chmod +x /workspace/scripts/train_gpt_tiny_tp2.sh
```

运行：

```bash
bash /workspace/scripts/train_gpt_tiny_tp2.sh
```

成功标志：

```text
using world size: 2
tensor-model-parallel size: 2
data-parallel size: 1
iteration ...
lm loss ...
saving checkpoint ...
```

---

## 4 卡 TP=4 GPT tiny 训练

创建脚本：

```bash
cat > /workspace/scripts/train_gpt_tiny_tp4.sh <<'EOF'
#!/bin/bash

source /workspace/scripts/megatron_env.sh

export CUDA_VISIBLE_DEVICES=0,1,2,3
export CUDA_DEVICE_MAX_CONNECTIONS=1

DATA_PATH=/workspace/data/gpt2_mmap/tiny_gpt_text_document
CHECKPOINT_PATH=/workspace/checkpoints/gpt2_tiny_tp4
TOKENIZER_DIR=/workspace/data/gpt2_raw
LOG_PATH=/workspace/logs/gpt2_tiny/train_tp4.log

mkdir -p $CHECKPOINT_PATH
mkdir -p /workspace/logs/gpt2_tiny

python -m torch.distributed.run \
  --standalone \
  --nnodes=1 \
  --nproc_per_node=4 \
  pretrain_gpt.py \
  --use-mcore-models \
  --transformer-impl transformer_engine \
  --tensor-model-parallel-size 4 \
  --pipeline-model-parallel-size 1 \
  --num-layers 4 \
  --hidden-size 256 \
  --ffn-hidden-size 1024 \
  --num-attention-heads 4 \
  --seq-length 128 \
  --max-position-embeddings 128 \
  --micro-batch-size 2 \
  --global-batch-size 8 \
  --train-iters 50 \
  --lr-decay-iters 50 \
  --save $CHECKPOINT_PATH \
  --load $CHECKPOINT_PATH \
  --data-path $DATA_PATH \
  --vocab-file $TOKENIZER_DIR/vocab.json \
  --merge-file $TOKENIZER_DIR/merges.txt \
  --tokenizer-type GPT2BPETokenizer \
  --split 949,50,1 \
  --distributed-backend nccl \
  --lr 1.0e-4 \
  --min-lr 1.0e-5 \
  --lr-decay-style cosine \
  --weight-decay 1e-2 \
  --clip-grad 1.0 \
  --lr-warmup-fraction 0.01 \
  --log-interval 1 \
  --save-interval 25 \
  --eval-interval 25 \
  --eval-iters 5 \
  --bf16 2>&1 | tee $LOG_PATH
EOF

chmod +x /workspace/scripts/train_gpt_tiny_tp4.sh
```

运行：

```bash
bash /workspace/scripts/train_gpt_tiny_tp4.sh
```

成功标志：

```text
using world size: 4
tensor-model-parallel size: 4
data-parallel size: 1
iteration ...
lm loss ...
saving checkpoint ...
```

---

## 4 卡 TP=2 + DP=2 GPT tiny 训练

创建脚本：

```bash
cat > /workspace/scripts/train_gpt_tiny_tp2_dp2.sh <<'EOF'
#!/bin/bash

source /workspace/scripts/megatron_env.sh

export CUDA_VISIBLE_DEVICES=0,1,2,3
export CUDA_DEVICE_MAX_CONNECTIONS=1

DATA_PATH=/workspace/data/gpt2_mmap/tiny_gpt_text_document
CHECKPOINT_PATH=/workspace/checkpoints/gpt2_tiny_tp2_dp2
TOKENIZER_DIR=/workspace/data/gpt2_raw
LOG_PATH=/workspace/logs/gpt2_tiny/train_tp2_dp2.log

mkdir -p $CHECKPOINT_PATH
mkdir -p /workspace/logs/gpt2_tiny

python -m torch.distributed.run \
  --standalone \
  --nnodes=1 \
  --nproc_per_node=4 \
  pretrain_gpt.py \
  --use-mcore-models \
  --transformer-impl transformer_engine \
  --tensor-model-parallel-size 2 \
  --pipeline-model-parallel-size 1 \
  --num-layers 4 \
  --hidden-size 256 \
  --ffn-hidden-size 1024 \
  --num-attention-heads 4 \
  --seq-length 128 \
  --max-position-embeddings 128 \
  --micro-batch-size 2 \
  --global-batch-size 16 \
  --train-iters 50 \
  --lr-decay-iters 50 \
  --save $CHECKPOINT_PATH \
  --load $CHECKPOINT_PATH \
  --data-path $DATA_PATH \
  --vocab-file $TOKENIZER_DIR/vocab.json \
  --merge-file $TOKENIZER_DIR/merges.txt \
  --tokenizer-type GPT2BPETokenizer \
  --split 949,50,1 \
  --distributed-backend nccl \
  --lr 1.0e-4 \
  --min-lr 1.0e-5 \
  --lr-decay-style cosine \
  --weight-decay 1e-2 \
  --clip-grad 1.0 \
  --lr-warmup-fraction 0.01 \
  --log-interval 1 \
  --save-interval 25 \
  --eval-interval 25 \
  --eval-iters 5 \
  --bf16 2>&1 | tee $LOG_PATH
EOF

chmod +x /workspace/scripts/train_gpt_tiny_tp2_dp2.sh
```

运行：

```bash
bash /workspace/scripts/train_gpt_tiny_tp2_dp2.sh
```

成功标志：

```text
using world size: 4
tensor-model-parallel size: 2
data-parallel size: 2
iteration ...
lm loss ...
saving checkpoint ...
```

---

## 查看训练结果

查看 checkpoint：

```bash
echo "=== TP2 ==="
find /workspace/checkpoints/gpt2_tiny_tp2 -maxdepth 5 -type f | head -10

echo "=== TP4 ==="
find /workspace/checkpoints/gpt2_tiny_tp4 -maxdepth 5 -type f | head -10

echo "=== TP2_DP2 ==="
find /workspace/checkpoints/gpt2_tiny_tp2_dp2 -maxdepth 5 -type f | head -10
```

查看日志：

```bash
grep -E "world size|data-parallel size|tensor-model-parallel size|iteration|lm loss" \
  /workspace/logs/gpt2_tiny/train_tp4.log | head -40
```

```bash
grep -E "world size|data-parallel size|tensor-model-parallel size|iteration|lm loss" \
  /workspace/logs/gpt2_tiny/train_tp2_dp2.log | head -40
```

至此，单机 4×RTX 4090 上的 Megatron-LM 基础训练环境已经完整验证通过。

---

## 重启电脑后如何再次进入运行环境

如果电脑重启，容器不会自动进入，需要按以下步骤恢复。

### 检查 Docker 服务

宿主机执行：

```bash
sudo systemctl status docker
```

如果 Docker 没启动：

```bash
sudo systemctl start docker
```

如果希望开机自启：

```bash
sudo systemctl enable docker
```

### 检查 GPU 状态

宿主机执行：

```bash
nvidia-smi
```

确认 4 张 RTX 4090 正常显示。

### 启动已有 Megatron 容器

查看容器：

```bash
docker ps -a
```

如果能看到 `megatron-dev`，启动并进入：

```bash
docker start -ai megatron-dev
```

或者后台启动后进入：

```bash
docker start megatron-dev
docker exec -it megatron-dev bash
```

### 进入 Megatron 环境

进入容器后执行：

```bash
source /workspace/scripts/megatron_env.sh
```

确认环境：

```bash
which python
python -c "import megatron; import megatron.core; print('Megatron OK')"
```

正常情况下，`which python` 应显示：

```text
/workspace/megatron-venv/bin/python
```

### 重新运行测试或训练

重新运行 4 卡 NCCL 测试：

```bash
CUDA_VISIBLE_DEVICES=0,1,2,3 python -m torch.distributed.run \
  --standalone \
  --nnodes=1 \
  --nproc_per_node=4 \
  /workspace/scripts/nccl_test.py
```

重新运行训练：

```bash
bash /workspace/scripts/train_gpt_tiny_tp2.sh
bash /workspace/scripts/train_gpt_tiny_tp4.sh
bash /workspace/scripts/train_gpt_tiny_tp2_dp2.sh
```

### 如果容器不存在，需要重新创建

如果重启后发现容器被删除了，但宿主机的 `~/megatron` 目录还在，可以重新创建容器：

```bash
docker run -it \
  --name megatron-dev \
  --gpus all \
  --ipc=host \
  --network host \
  --shm-size=64g \
  --ulimit memlock=-1 \
  --ulimit stack=67108864 \
  -v "$HOME/megatron/code:/workspace/code" \
  -v "$HOME/megatron/data:/workspace/data" \
  -v "$HOME/megatron/checkpoints:/workspace/checkpoints" \
  -v "$HOME/megatron/logs:/workspace/logs" \
  -v "$HOME/megatron/scripts:/workspace/scripts" \
  -v "$HOME/model:/workspace/model:ro" \
  -e PIP_CONSTRAINT= \
  -e PIP_INDEX_URL=https://pypi.tuna.tsinghua.edu.cn/simple \
  -e PIP_TRUSTED_HOST=pypi.tuna.tsinghua.edu.cn \
  nvcr.io/nvidia/pytorch:26.01-py3 \
  bash
```

进入后重新加载环境：

```bash
source /workspace/scripts/megatron_env.sh
```

如果 `/workspace/megatron-venv` 不存在，说明 venv 在旧容器内部丢失，需要重新创建 venv 并安装依赖。如果容器只是停止而没有删除，则不需要重新安装。

---

## 补充：方案二，将已有容器内 venv 复制到宿主机并重新挂载

上面的流程中，`/workspace/megatron-venv` 默认位于容器内部。如果容器只是 `docker stop`，虚拟环境不会丢；但如果执行 `docker rm` 删除容器，容器内部的 venv 会随之消失。

为了避免以后重建容器时重新安装 Megatron 依赖，可以把已经安装好的 venv 从旧容器复制到宿主机，然后在新容器中重新挂载到同一个路径 `/workspace/megatron-venv`。

### 从旧容器复制 venv 到宿主机

先确保旧容器 `megatron-dev` 仍然存在。即使它已经停止，只要没有被删除，也可以复制文件。

宿主机执行：

```bash
mkdir -p ~/megatron

docker cp megatron-dev:/workspace/megatron-venv ~/megatron/venv
```

执行后，宿主机上通常会出现：

```text
~/megatron/venv/megatron-venv
```

也就是说，`docker cp` 会把容器中的目录作为一个子目录复制出来。

为了后续挂载路径更简洁，建议整理为：

```bash
if [ -d "$HOME/megatron/venv/megatron-venv" ]; then
  rm -rf "$HOME/megatron/venv_fixed"
  mv "$HOME/megatron/venv/megatron-venv" "$HOME/megatron/venv_fixed"
  rm -rf "$HOME/megatron/venv"
  mv "$HOME/megatron/venv_fixed" "$HOME/megatron/venv"
fi
```

整理后，宿主机目录结构应为：

```text
~/megatron/venv/bin/activate
~/megatron/venv/bin/python
~/megatron/venv/lib/...
```

可以检查：

```bash
ls -lh ~/megatron/venv/bin/activate
ls -lh ~/megatron/venv/bin/python
```

### 删除旧容器

确认 venv 已经复制到宿主机后，可以删除旧容器：

```bash
docker rm -f megatron-dev
```

这不会删除宿主机上的源码、数据、checkpoint、日志和刚刚复制出来的 venv。

### 用 venv 挂载方式重建容器

新建容器时增加一行挂载：

```bash
-v "$HOME/megatron/venv:/workspace/megatron-venv" \
```

完整命令如下：

```bash
docker run -it \
  --name megatron-dev \
  --gpus all \
  --ipc=host \
  --network host \
  --shm-size=64g \
  --ulimit memlock=-1 \
  --ulimit stack=67108864 \
  -v "$HOME/megatron/code:/workspace/code" \
  -v "$HOME/megatron/data:/workspace/data" \
  -v "$HOME/megatron/checkpoints:/workspace/checkpoints" \
  -v "$HOME/megatron/logs:/workspace/logs" \
  -v "$HOME/megatron/scripts:/workspace/scripts" \
  -v "$HOME/megatron/venv:/workspace/megatron-venv" \
  -v "$HOME/model:/workspace/model:ro" \
  -e PIP_CONSTRAINT= \
  -e PIP_INDEX_URL=https://pypi.tuna.tsinghua.edu.cn/simple \
  -e PIP_TRUSTED_HOST=pypi.tuna.tsinghua.edu.cn \
  nvcr.io/nvidia/pytorch:26.01-py3 \
  bash
```

进入容器后执行：

```bash
source /workspace/scripts/megatron_env.sh
```

验证：

```bash
which python
python -c "import megatron; import megatron.core; print('Megatron OK')"
```

如果输出：

```text
Megatron OK
```

说明复制到宿主机的 venv 可以正常使用。

### 使用方案二后的重启恢复方式

采用方案二后，宿主机上需要保留以下目录：

```text
~/megatron/code
~/megatron/data
~/megatron/checkpoints
~/megatron/logs
~/megatron/scripts
~/megatron/venv
~/model
```

重启电脑后，执行：

```bash
docker start megatron-dev
docker exec -it megatron-dev bash
```

进入容器后：

```bash
source /workspace/scripts/megatron_env.sh
```

验证：

```bash
python -c "import megatron; import megatron.core; print('Megatron OK')"
```

如果容器不存在，则用 24.3 中的完整 `docker run` 命令重新创建。只要 `~/megatron/venv` 仍然存在，就不需要重新创建虚拟环境，也不需要重新安装 Megatron-LM 依赖。

---

## 总结

本文完成了在 Ubuntu 24 + Docker + 4×RTX 4090 环境下安装 NVIDIA Megatron-LM，并完成以下验证：

```text
1. NGC PyTorch 容器启动
2. Megatron-LM 源码安装
3. Python venv 隔离环境配置
4. Transformer Engine import 验证
5. 2 卡 NCCL 通信测试
6. 4 卡 NCCL 通信测试
7. Megatron Core 最小训练测试
8. GPT tiny 数据预处理
9. 2 卡 TP=2 GPT 训练
10. 4 卡 TP=4 GPT 训练
11. 4 卡 TP=2 + DP=2 GPT 训练
12. checkpoint 保存验证
13. 容器内 venv 复制到宿主机并持久化挂载
```

至此，这台 4×RTX 4090 服务器已经可以作为 Megatron-LM 单机多卡训练实验环境使用。