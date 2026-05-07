---
title: MRC 与 SRv6：让 10 万 GPU 级 AI 超算网络在故障中继续训练
Author: Mango
top_img: >-
  https://a.tuchuangyun.top/autoupload/sGsLTdNbILw_FMc-EyyWvNiO_OyvX7mIgxFBfDMDErs/20260401/BxKq/2560X1440/code01.jpg
tags:
  - Algorithm
  - Research
  - AI
categories:
  - 计算机网络
cover: >-
  https://a.tuchuangyun.top/autoupload/sGsLTdNbILw_FMc-EyyWvNiO_OyvX7mIgxFBfDMDErs/20260401/PFyM/2048X1152/dc02.jpg
abbrlink: 1a4047db
date: 2026-05-07 09:56:49
---

> 本文改写自 OpenAI 官方工程博客《Supercomputer networking to accelerate large scale AI training》与论文《Resilient AI Supercomputer Networking using MRC and SRv6》。目标是用博客化的方式解释：为什么大规模 AI 训练需要新的网络协议，MRC 如何与多平面拓扑、SRv6 源路由一起，把“网络故障”从训练中断事件变成可被系统自动绕开的背景噪声。

论文链接：[Resilient AI Supercomputer Networking using MRC and SRv6](https://a.tuchuangyun.top/autoupload/sGsLTdNbILw_FMc-EyyWvNiO_OyvX7mIgxFBfDMDErs/20260507/UowK/Resilient%2520AI%2520Supercomputer%2520Networking%2520using%2520MRC%2520and%2520SRv6.pdf)

## 问题不是平均带宽，而是最慢那一次通信

在同步预训练中，成千上万甚至十万级 GPU 按训练 step 锁步推进。每个 step 中，GPU 之间要执行数据并行、张量并行、流水线并行、专家并行等多种通信。理想状态下，通信被尽量隐藏在计算之后；但现实里，只要某一次传输成为“长尾”，整个 step 都可能被拖慢。

这也是大规模训练网络最棘手的地方：平均吞吐量很高并不够，最慢的那条路径、最晚到达的那个包，才决定训练作业的体验。随着集群规模扩大，链路 flap、交换机异常、流冲突、incast 拥塞都会从偶发问题变成常态背景噪声。传统做法通常依赖动态路由和 lossless Ethernet，但在百 K GPU 级训练网络中，这些机制本身也会带来复杂性和收敛延迟。

OpenAI 与 Microsoft、AMD、Broadcom、NVIDIA 等合作提出的 MRC，也就是 Multipath Reliable Connection，试图把问题换一个角度解决：不要让单个流被固定在单条路径上，而是让一个 RDMA 连接主动跨很多路径发包，并且在微秒级绕开坏路径。

## 第一层改变：从单平面 Clos 到多平面网络

传统 800Gb/s 单平面设计里，一个 51.2Tb/s 交换机大约可以提供 64 个 800Gb/s 端口。要连接 10 万 GPU 并保持全双分带宽，网络往往需要三层甚至四层 Clos，路径更长、光模块和交换机更多，故障面也更大。

MRC 论文中的核心拓扑思路是：把一个 800Gb/s NIC 拆成 8 条 100Gb/s 链路，分别接入 8 个并行的网络平面。这样，同样的 51.2Tb/s 交换机可以提供 512 个 100Gb/s 端口，网络可以用两层交换机连接约 131,072 个 NIC/GPU。

![740X735/paper-fig1-multiplane-topology.png](https://a.tuchuangyun.top/autoupload/sGsLTdNbILw_FMc-EyyWvNiO_OyvX7mIgxFBfDMDErs/20260507/7fri/740X735/paper-fig1-multiplane-topology.png)

这种多平面设计带来几个直接好处：路径经过的交换机更少，延迟更低；T0 本地可达的节点更多，更容易利用局部性；满带宽所需的光模块与交换机数量更少；更重要的是，某个 T0-T1 链路失败只影响很小一部分容量，而不是把某个训练通信直接打断。

OpenAI 官方文章也用一个更直观的图解释了这个变化：多平面网络不是把所有鸡蛋放在一个 800G 篮子里，而是把一块 NIC 的能力分散到多个独立平面中，让网络天然具备绕路空间。

![802X435/image.png](https://a.tuchuangyun.top/autoupload/sGsLTdNbILw_FMc-EyyWvNiO_OyvX7mIgxFBfDMDErs/20260507/yyyE/802X435/image.png)

## 第二层改变：MRC 把一个连接喷洒到上百条路径

多平面拓扑提供了路径多样性，但传统 RoCE 连接通常仍是单路径的：交换机通过 ECMP 哈希给一个流选一条路径。问题是，大量训练流同时出现时，很容易有多个大流撞到同一条链路上，形成 hot spot。对于同步训练来说，少数 hot spot 就足以制造长尾。

![808X393/image.png](https://a.tuchuangyun.top/autoupload/sGsLTdNbILw_FMc-EyyWvNiO_OyvX7mIgxFBfDMDErs/20260507/1ayG/808X393/image.png)

MRC 的关键动作是“packet spraying”：同一个 Queue Pair 的数据包不再走同一条路径，而是轮流使用一组 entropy value，也就是 EV。每个 EV 对应某个平面上的某条路径。典型情况下，一个 QP 会维护 128 到 256 个 EV，发送端逐包轮换，让一个 RDMA 传输自然分布到多个平面和多条路径上。

![808X393/image.png](https://a.tuchuangyun.top/autoupload/sGsLTdNbILw_FMc-EyyWvNiO_OyvX7mIgxFBfDMDErs/20260507/FkWJ/808X393/image.png)

这会带来一个新要求：包会乱序到达，接收端必须能立即把包放到正确内存位置。MRC 的做法是，每个数据包都携带 RDMA 虚拟地址和 remote key，接收 NIC 不必等待顺序重组，就能直接写入目标内存。

同时，MRC 放弃 PFC 依赖，运行在 best-effort Ethernet 上。为了让丢包恢复足够快，它引入 SACK/NACK 选择性重传；为了区分“拥塞导致的包被丢”和“路径真的坏了”，它还使用 packet trimming：当交换机本来要丢包时，剪掉 payload，只转发 header 到接收端，让接收端立刻发 NACK，请求重传。

## 第三层改变：用 SRv6 静态源路由替代动态路由

如果 MRC 已经能检测坏路径并自动避开，交换机是否还需要动态路由协议来重新计算路径？论文给出的答案很激进：在 MRC 后端网络中，动态路由可能弊大于利。

原因是，如果终端侧 MRC 在做自适应负载均衡，交换机侧动态路由也在根据故障改变 ECMP 集合，两套机制会互相干扰。MRC 刚刚把坏路径移出，动态路由又改变了哈希映射，反而让负载均衡状态更难理解。

因此，OpenAI 的方案是让数据包使用 IPv6 Segment Routing，也就是 SRv6。发送端把路径中的交换机标识编码进 IPv6 目的地址，交换机只按静态表逐跳转发。路径坏了，MRC 直接停止使用对应 EV；交换机不需要重新收敛。

![821X399/image.png](https://a.tuchuangyun.top/autoupload/sGsLTdNbILw_FMc-EyyWvNiO_OyvX7mIgxFBfDMDErs/20260507/CD7C/821X399/image.png)

论文中还进一步解释了 EV 与 SRv6 地址之间的映射：在 QP 启动时，NIC 先根据目的地址生成一个 SRv6 模板；发包时，再把 EV 中的 plane、T0 uplink 等字段填入 uSID 序列，形成最终 SRv6 目的地址。这样，EV 不只是“随机哈希值”，而是一个可解释、可探测、可映射到物理路径的压缩路径描述。

![1540X560/paper-fig2-3-srv6-forwarding-mapping.png](https://a.tuchuangyun.top/autoupload/sGsLTdNbILw_FMc-EyyWvNiO_OyvX7mIgxFBfDMDErs/20260507/Gevb/1540X560/paper-fig2-3-srv6-forwarding-mapping.png)

## 为什么这对运维很重要：坏链路不再需要立刻抢修

过去，训练网络中的 flappy link 往往需要运维团队快速介入：下线链路、等待动态路由收敛、确认训练是否受影响。MRC 改变了优先级。论文中提到，在 Cluster A 的大规模同步预训练期间，T0-T1 链路每分钟持续出现 flap，但训练几乎不受影响。MRC 会在对应 EV 丢包后移除该路径，并通过其他路径选择性重传。

![1540X495/paper-fig4-5-startup-losses-link-flaps.png](https://a.tuchuangyun.top/autoupload/sGsLTdNbILw_FMc-EyyWvNiO_OyvX7mIgxFBfDMDErs/20260507/IGYI/1540X495/paper-fig4-5-startup-losses-link-flaps.png)

这让运维策略从“故障必须马上消失”变成“系统先绕开故障，人再按优先级修复”。更妙的是，SRv6 的确定性路径让 Clustermapper 这样的探测系统更容易定位问题：探测包走的路径和 MRC 数据包一致，不会被 ECMP 哈希或动态路由变化扰动。

## 生产结果：50K GPU 作业没有因为链路 flap 崩溃

论文给了一个很有代表性的生产事件：在 OpenAI 的 50K GPU 预训练作业中，一个 T0 交换机上的光模块发生 glitch，四条连接到不同节点的 NIC-T0 链路快速 flap，其中三个节点当时处于训练作业中。由于同步训练由最慢节点决定整体进度，作业吞吐在这分钟内下降约 25%，但随后立即恢复。更关键的是：作业没有崩溃，QP 没有失败，受影响节点也不需要被踢出作业。

![730X610/paper-fig6-7-nic-t0-flap.png](https://a.tuchuangyun.top/autoupload/sGsLTdNbILw_FMc-EyyWvNiO_OyvX7mIgxFBfDMDErs/20260507/owxZ/730X610/paper-fig6-7-nic-t0-flap.png)

另一个例子是 75K GPU 预训练中 T1 交换机故障与重启。论文显示，当某个 T1 停止转发时，约四分之一 QP 受影响并丢了约 58 万个包，但 MRC 很快映射掉坏路径；真正 reboot 时，对作业吞吐几乎没有影响。

![740X435/paper-fig8-t1-failure-reboot.png](https://a.tuchuangyun.top/autoupload/sGsLTdNbILw_FMc-EyyWvNiO_OyvX7mIgxFBfDMDErs/20260507/STfR/740X435/paper-fig8-t1-failure-reboot.png)

OpenAI 官方博客把这个变化总结得很直白：以前重启交换机需要小心协调训练作业，现在许多链路修复甚至可以在链路仍处于服务状态时进行；如果链路足够好，MRC 会使用它；如果不够好，MRC 会避开它，直到探测显示它恢复。

## 测试结果：不是“能跑”，而是能在坏环境里继续跑

论文中的 controlled testbed 进一步展示了 MRC 的行为。Cluster B 上，T0-local 的 2B 消息单向延迟约 5.09 微秒，Cross-T1 约 6.54 微秒；32KB 消息带宽约 770Gb/s，约为理论峰值的 96%。

在链路故障实验中，NIC-T0 链路逐条下线时，吞吐随剩余平面容量逐级下降并恢复；但 T0-T1 链路故障影响小得多，因为每个 QP 分散在大量路径上。即使一次性 flap 多条 T0-T1 链路，MRC 也能快速重路由，工作负载级影响很小。

![1540X790/paper-fig9-11-reliability-results.png](https://a.tuchuangyun.top/autoupload/sGsLTdNbILw_FMc-EyyWvNiO_OyvX7mIgxFBfDMDErs/20260507/2EDG/1540X790/paper-fig9-11-reliability-results.png)

路径级丢包和负载均衡实验也很有意思。当某个 EV 被人为注入 20% 丢包时，MRC 会立即把该 EV 标记为 inactive，并启用备用 EV，端到端带宽保持稳定。另一个双流实验中，当两个流被挤到同一 EV 上产生 ECN 信号，MRC 会把其中一个流迁移到另一个 EV，两个流都能保持接近峰值吞吐。

![1540X770/paper-fig12-15-path-loss-loadbalancing-nccl.png](https://a.tuchuangyun.top/autoupload/sGsLTdNbILw_FMc-EyyWvNiO_OyvX7mIgxFBfDMDErs/20260507/cptY/1540X770/paper-fig12-15-path-loss-loadbalancing-nccl.png)

## 与 RoCE 对比：MRC 的优势在长尾和故障恢复

论文没有在超大生产集群中直接 AB 比较 MRC 与 RoCE，但在小规模 testbed 中构建了相近硬件条件：RoCE 使用单平面 400Gb/s ECMP + PFC/DCQCN，MRC 使用四平面 4x100Gb/s + SRv6 + best-effort Ethernet。

在 64-way ring all-reduce 中，RoCE 单 QP 会受到 ECMP 流碰撞影响，带宽通常只有理想值的一半；RoCE 通过 QP scaling 能改善，但 16 QP 仍不如 MRC 单 QP 跨 256 条路径喷洒。加入 0.1% 随机丢包后，MRC 的选择性重传还能维持较好表现，而 RoCE 性能下降明显；到 1% 丢包，二者都受到严重影响，但 MRC 仍能短时间“扛住”比 RoCE 更好的吞吐。

![740X530/paper-fig16-17-mrc-vs-roce.png](https://a.tuchuangyun.top/autoupload/sGsLTdNbILw_FMc-EyyWvNiO_OyvX7mIgxFBfDMDErs/20260507/0Uks/740X530/paper-fig16-17-mrc-vs-roce.png)

在 incast 场景中，MRC 还有一个很实用的优势：它不会像 PFC 那样把拥塞扩散到无关流。论文中的 7-to-1 incast + victim flow 实验显示，RoCE 即使用 DCQCN，victim flow 仍会出现明显吞吐下降；而 MRC 能几乎完美共享瓶颈链路，并避免伤害无关流。

![1540X480/paper-fig18-incast-victim.png](https://a.tuchuangyun.top/autoupload/sGsLTdNbILw_FMc-EyyWvNiO_OyvX7mIgxFBfDMDErs/20260507/98ES/1540X480/paper-fig18-incast-victim.png)

## MRC 不是万能药，但它改变了故障模型

MRC 的价值不只是“更快”，而是把训练网络的故障模型从“单点故障会让作业失败”改成“绝大多数链路和部分交换机异常都能被端系统吸收”。这对大模型训练很关键，因为 GPU 时间昂贵，checkpoint restart 代价高，且越大的同步作业越容易被最慢通信放大。

当然，论文也指出仍有单点问题。例如 800Gb/s NIC 光模块如果整体 flap，所有拆分端口都会同时丢失，QP 仍可能失败。对于 NIC-T0 高丢包但未完全 down 的灰故障，MRC 也需要依赖 Clustermapper 策略来识别并下发 denylist。换句话说，MRC 不消灭故障，而是把大量故障变成可观测、可绕开、可延后处理的问题。

## 结语：未来 AI 集群的网络会越来越“端系统智能化”

MRC、SRv6 与多平面拓扑的组合，代表了一种很清晰的方向：在 AI 训练网络里，靠交换机动态路由维护全局最优越来越困难；更可行的方式，是让 NIC/端系统掌握路径状态，用细粒度 packet spraying 和源路由直接管理路径选择。

这也是为什么 OpenAI 将 MRC 规格通过 OCP 开放出来。大规模 AI 训练的瓶颈已经不只是 FLOPS，而是如何让海量 GPU 在故障、拥塞和维护事件中持续一起前进。MRC 的经验说明：当网络协议、拓扑和运维系统一起设计时，超大规模训练可以更可靠，也可以更简单。

---

## 参考

- OpenAI Engineering Blog: “Supercomputer networking to accelerate large scale AI training”, published May 5, 2026.
- Paper: “Resilient AI Supercomputer Networking using MRC and SRv6”.