---
title: ib网卡隔离配置记录
Author: Mango
top_img: transparent
tags:
  - Code
  - Research
categories:
  - 计算机网络
abbrlink: d2cad145
date: 2026-06-04 16:41:05
cover:
---

## 背景

在一台 Ubuntu 24.04 服务器上，机器插入了两张高速网卡，每张网卡提供两个光模块口，因此一共有四个可配置的高速网口。计划为四个网口分别配置如下 IP 地址：

| 网口        | IP 地址         | 隔离命名空间 |
| ----------- | --------------- | ------------ |
| `ens3f0np0` | `10.0.0.101/24` | `ns101`      |
| `ens3f1np1` | `10.0.0.102/24` | `ns102`      |
| `ens6f0np0` | `10.0.0.103/24` | `ns103`      |
| `ens6f1np1` | `10.0.0.104/24` | `ns104`      |

最终目标是将四个光口都接入交换机，并让这些 IP 之间的访问必须经过物理网口出到交换机，再由交换机转发回来，而不是被 Linux 本机网络栈直接在机内转发。

在正式接交换机之前，先用两根光纤做点对点连通性测试：

```text
ens3f0np0 <----光纤----> ens3f1np1
ens6f0np0 <----光纤----> ens6f1np1
```

也就是：

```text
ns101 / 10.0.0.101  <---->  ns102 / 10.0.0.102
ns103 / 10.0.0.103  <---->  ns104 / 10.0.0.104
```

## 为什么需要隔离

如果直接把 `10.0.0.101`、`10.0.0.102`、`10.0.0.103`、`10.0.0.104` 都配置在同一个 Linux 默认网络命名空间里，Linux 会把这些地址都认为是本机地址。

此时从 `10.0.0.101` 访问 `10.0.0.102`，流量很可能不会真的从物理光口发出，而是直接走 Linux 内核的本地路由表完成本机交付。

这显然不符合测试目标。我们希望把四个网口模拟成四台独立主机，因此使用 network namespace 将四个物理网口分别隔离到四个独立网络栈中。

隔离后的逻辑结构如下：

```text
默认 namespace
    ├── 管理网卡
    └── 不包含 ens3f0np0 / ens3f1np1 / ens6f0np0 / ens6f1np1

ns101
    └── ens3f0np0: 10.0.0.101/24

ns102
    └── ens3f1np1: 10.0.0.102/24

ns103
    └── ens6f0np0: 10.0.0.103/24

ns104
    └── ens6f1np1: 10.0.0.104/24
```

这样一来，每个 IP 都处于不同的网络命名空间中，访问其他 IP 时必须从自身所在 namespace 的物理网口发出。

## 网口信息确认

初始状态下，四个目标网口分别为：

```text
ens3f0np0
ens3f1np1
ens6f0np0
ens6f1np1
```

另外机器上还存在管理口或其他网口，例如：

```text
enx0a94efbb254b
enx000ec67803a9
ens9f0np0
ens9f1np1
```

配置过程中需要注意，尽量不要通过目标实验网口 SSH 登录服务器。因为一旦把目标网口移动到 namespace 中，默认 namespace 将无法继续直接使用这些网口，远程连接可能中断。

## 清理默认命名空间中的网口配置

先清理四个实验网口上的旧地址：

```bash
sudo ip addr flush dev ens3f0np0
sudo ip addr flush dev ens3f1np1
sudo ip addr flush dev ens6f0np0
sudo ip addr flush dev ens6f1np1
```

然后将四个网口临时关闭：

```bash
sudo ip link set ens3f0np0 down
sudo ip link set ens3f1np1 down
sudo ip link set ens6f0np0 down
sudo ip link set ens6f1np1 down
```

查看默认命名空间中的网口：

```bash
ip link
```

此时四个实验口仍能在默认 namespace 中看到，但已经没有 IPv4 地址。

## 创建 network namespace

创建四个独立 namespace：

```bash
sudo ip netns add ns101
sudo ip netns add ns102
sudo ip netns add ns103
sudo ip netns add ns104
```

将四个物理网口分别移动到对应 namespace：

```bash
sudo ip link set ens3f0np0 netns ns101
sudo ip link set ens3f1np1 netns ns102
sudo ip link set ens6f0np0 netns ns103
sudo ip link set ens6f1np1 netns ns104
```

移动完成后，在默认 namespace 下执行：

```bash
ip link
```

此时应该已经看不到以下四个网口：

```text
ens3f0np0
ens3f1np1
ens6f0np0
ens6f1np1
```

这说明它们已经从默认 namespace 中移走，进入各自的 network namespace。

## 配置 namespace 内部地址

启动每个 namespace 中的 loopback：

```bash
sudo ip netns exec ns101 ip link set lo up
sudo ip netns exec ns102 ip link set lo up
sudo ip netns exec ns103 ip link set lo up
sudo ip netns exec ns104 ip link set lo up
```

配置 IPv4 地址：

```bash
sudo ip netns exec ns101 ip addr add 10.0.0.101/24 dev ens3f0np0
sudo ip netns exec ns102 ip addr add 10.0.0.102/24 dev ens3f1np1
sudo ip netns exec ns103 ip addr add 10.0.0.103/24 dev ens6f0np0
sudo ip netns exec ns104 ip addr add 10.0.0.104/24 dev ens6f1np1
```

启动网口：

```bash
sudo ip netns exec ns101 ip link set ens3f0np0 up
sudo ip netns exec ns102 ip link set ens3f1np1 up
sudo ip netns exec ns103 ip link set ens6f0np0 up
sudo ip netns exec ns104 ip link set ens6f1np1 up
```

检查地址配置：

```bash
sudo ip netns exec ns101 ip -br addr
sudo ip netns exec ns102 ip -br addr
sudo ip netns exec ns103 ip -br addr
sudo ip netns exec ns104 ip -br addr
```

预期结果类似：

```text
lo               UNKNOWN        127.0.0.1/8 ::1/128
ens3f0np0        UP             10.0.0.101/24 fe80::1270:fdff:fe06:fa4c/64

lo               UNKNOWN        127.0.0.1/8 ::1/128
ens3f1np1        UP             10.0.0.102/24 fe80::1270:fdff:fe06:fa4d/64

lo               UNKNOWN        127.0.0.1/8 ::1/128
ens6f0np0        UP             10.0.0.103/24 fe80::e42:a1ff:fe15:ffcc/64

lo               UNKNOWN        127.0.0.1/8 ::1/128
ens6f1np1        UP             10.0.0.104/24 fe80::e42:a1ff:fe15:ffcd/64
```

查看路由：

```bash
sudo ip netns exec ns101 ip route
sudo ip netns exec ns102 ip route
sudo ip netns exec ns103 ip route
sudo ip netns exec ns104 ip route
```

预期每个 namespace 中都有一条直连路由：

```text
10.0.0.0/24 dev ens3f0np0 proto kernel scope link src 10.0.0.101
10.0.0.0/24 dev ens3f1np1 proto kernel scope link src 10.0.0.102
10.0.0.0/24 dev ens6f0np0 proto kernel scope link src 10.0.0.103
10.0.0.0/24 dev ens6f1np1 proto kernel scope link src 10.0.0.104
```

这里保留 `/24` 是因为后续四个网口会接入同一个交换机 VLAN。如果只是永久点对点直连，也可以考虑 `/32 + peer route`，但本次场景不需要。

## 隔离状态检查

默认 namespace 中执行：

```bash
ip link
```

此时只应看到管理网口和其他未隔离网口，例如：

```text
lo
enx0a94efbb254b
enx000ec67803a9
ens9f0np0
ens9f1np1
```

看不到四个实验口，说明隔离已经生效。

进一步检查默认 namespace 是否还有 `10.0.0.x` 地址：

```bash
ip addr | grep 10.0.0
ip route show table local | grep 10.0.0
```

正常情况下不应有输出。

在 namespace 内部查看访问路径：

```bash
sudo ip netns exec ns101 ip route get 10.0.0.102
```

预期类似：

```text
10.0.0.102 dev ens3f0np0 src 10.0.0.101
```

说明 `ns101` 访问 `10.0.0.102` 会从 `ens3f0np0` 发出，而不是走默认 namespace 的本地路由。

## 点对点连通性测试

当前临时拓扑是两根光纤两两直连，因此只测试两组对应关系：

```text
10.0.0.101 <-> 10.0.0.102
10.0.0.103 <-> 10.0.0.104
```

测试第一组：

```bash
sudo ip netns exec ns101 ping -I 10.0.0.101 10.0.0.102
sudo ip netns exec ns102 ping -I 10.0.0.102 10.0.0.101
```

测试第二组：

```bash
sudo ip netns exec ns103 ping -I 10.0.0.103 10.0.0.104
sudo ip netns exec ns104 ping -I 10.0.0.104 10.0.0.103
```

实际测试中，两组链路均能正常 ping 通，丢包率为 `0%`，延迟在亚毫秒级。

需要注意的是，在当前点对点连接方式下，不应该期待 `10.0.0.101` 直接 ping 通 `10.0.0.103` 或 `10.0.0.104`。因为这几组 IP 之间没有交换机，也没有直接光纤链路。等四个网口全部接入交换机后，才应该测试任意两两互通。

## 光口链路状态检查

使用 `ethtool` 检查四个口链路状态：

```bash
sudo ip netns exec ns101 ethtool ens3f0np0 | grep -E "Speed|Duplex|Link detected"
sudo ip netns exec ns102 ethtool ens3f1np1 | grep -E "Speed|Duplex|Link detected"
sudo ip netns exec ns103 ethtool ens6f0np0 | grep -E "Speed|Duplex|Link detected"
sudo ip netns exec ns104 ethtool ens6f1np1 | grep -E "Speed|Duplex|Link detected"
```

实际结果四个端口均为：

```text
Speed: 100000Mb/s
Duplex: Full
Link detected: yes
```

说明四个光口均已经以 100G 全双工状态正常连接。

## 抓包测试

抓包可以用于确认流量确实从 namespace 内的物理网口发出。

第一组链路抓包：

```bash
sudo ip netns exec ns101 tcpdump -i ens3f0np0 -nn -e 'arp or icmp'
```

另一个终端执行：

```bash
sudo ip netns exec ns101 ping -I 10.0.0.101 10.0.0.102
```

如果抓包中可以看到 ARP 和 ICMP 报文，说明流量确实经过 `ens3f0np0`。

保存抓包文件：

```bash
sudo ip netns exec ns101 tcpdump -i ens3f0np0 -nn -s 0 -w ns101_to_ns102.pcap 'arp or icmp'
```

第二组链路类似：

```bash
sudo ip netns exec ns103 tcpdump -i ens6f0np0 -nn -e 'arp or icmp'
sudo ip netns exec ns103 ping -I 10.0.0.103 10.0.0.104
```

保存抓包文件：

```bash
sudo ip netns exec ns103 tcpdump -i ens6f0np0 -nn -s 0 -w ns103_to_ns104.pcap 'arp or icmp'
```

查看抓包文件：

```bash
tcpdump -nn -r ns101_to_ns102.pcap
```

## TCP 测速

可以使用 `iperf3` 做普通 TCP 带宽测试。

安装工具：

```bash
sudo apt update
sudo apt install -y iperf3 tcpdump ethtool ifstat
```

第一组链路中，`ns102` 作为服务端：

```bash
sudo ip netns exec ns102 iperf3 -s -B 10.0.0.102
```

`ns101` 作为客户端：

```bash
sudo ip netns exec ns101 iperf3 -c 10.0.0.102 -B 10.0.0.101 -P 8 -t 30
```

反向测试：

```bash
sudo ip netns exec ns101 iperf3 -c 10.0.0.102 -B 10.0.0.101 -P 8 -t 30 -R
```

双向测试：

```bash
sudo ip netns exec ns101 iperf3 -c 10.0.0.102 -B 10.0.0.101 -P 8 -t 30 --bidir
```

第二组链路中，`ns104` 作为服务端：

```bash
sudo ip netns exec ns104 iperf3 -s -B 10.0.0.104
```

`ns103` 作为客户端：

```bash
sudo ip netns exec ns103 iperf3 -c 10.0.0.104 -B 10.0.0.103 -P 8 -t 30
```

100G 网卡下，单 TCP 流通常很难跑满链路，所以建议使用 `-P 8`、`-P 16` 或 `-P 32` 多流测试。若多流数量增加后吞吐明显上升，说明瓶颈可能在单流 CPU、TCP 栈、队列或中断调度上。

测速过程中可以查看实时接口速率：

```bash
sudo ip netns exec ns101 ifstat -i ens3f0np0 1
sudo ip netns exec ns103 ifstat -i ens6f0np0 1
```

也可以查看网卡硬件统计：

```bash
sudo ip netns exec ns101 ethtool -S ens3f0np0 | grep -Ei 'rx|tx|err|drop|discard|crc'
sudo ip netns exec ns102 ethtool -S ens3f1np1 | grep -Ei 'rx|tx|err|drop|discard|crc'
```

## RDMA 与 IB 设备映射

在进行 IB/RDMA 打流之前，需要确认 RDMA 设备号和 Linux 网口之间的对应关系。

在 namespace 中执行：

```bash
sudo ip netns exec ns101 ibdev2netdev
sudo ip netns exec ns102 ibdev2netdev
sudo ip netns exec ns103 ibdev2netdev
sudo ip netns exec ns104 ibdev2netdev
```

示例对应关系：

```text
ns101: ens3f0np0 -> mlx5_2 -> 10.0.0.101
ns102: ens3f1np1 -> mlx5_3 -> 10.0.0.102
ns103: ens6f0np0 -> mlx5_? -> 10.0.0.103
ns104: ens6f1np1 -> mlx5_? -> 10.0.0.104
```

本次测试中，第一组使用：

```text
ens3f0np0 -> mlx5_2
ens3f1np1 -> mlx5_3
```

第二组需要根据 `ibdev2netdev` 的实际输出确认设备号。

查看 namespace 内 IP 地址：

```bash
sudo ip netns exec ns101 ip a
sudo ip netns exec ns102 ip a
```

查看 RDMA 设备：

```bash
sudo ip netns exec ns101 ibv_devices
sudo ip netns exec ns102 ibv_devices
```

查看设备状态：

```bash
sudo ip netns exec ns101 ibv_devinfo -d mlx5_2
sudo ip netns exec ns102 ibv_devinfo -d mlx5_3
```

重点关注：

```text
state: PORT_ACTIVE
link_layer: Ethernet
```

如果是 RoCE 场景，`link_layer` 通常为 `Ethernet`。

## RC 模式 IB 打流测试

安装测试工具：

```bash
sudo apt update
sudo apt install -y perftest rdma-core ibverbs-utils infiniband-diags
```

第一组链路中，`ns101` 作为 server：

```bash
sudo ip netns exec ns101 ib_send_bw   -d mlx5_2   -i 1   -p 65531   --report_gbits   --run_infinitely
```

`ns102` 作为 client：

```bash
sudo ip netns exec ns102 ib_send_bw   -d mlx5_3   -i 1   10.0.0.101   -p 65531   --report_gbits   --run_infinitely
```

这里的流量方向是：

```text
ns102 / mlx5_3 / 10.0.0.102  ->  ns101 / mlx5_2 / 10.0.0.101
```

如果只需要跑固定时间，例如 30 秒，可以使用：

```bash
sudo ip netns exec ns101 ib_send_bw   -d mlx5_2   -i 1   -p 65531   --report_gbits   -D 30
```

client 端：

```bash
sudo ip netns exec ns102 ib_send_bw   -d mlx5_3   -i 1   10.0.0.101   -p 65531   --report_gbits   -D 30
```

反向测试时，交换 server 和 client：

```bash
sudo ip netns exec ns102 ib_send_bw   -d mlx5_3   -i 1   -p 65531   --report_gbits   -D 30
```

```bash
sudo ip netns exec ns101 ib_send_bw   -d mlx5_2   -i 1   10.0.0.102   -p 65531   --report_gbits   -D 30
```

第二组链路的测试方式相同，只需要把设备名和 IP 替换为对应关系。例如假设：

```text
ens6f0np0 -> mlx5_4
ens6f1np1 -> mlx5_5
```

则可以使用：

```bash
sudo ip netns exec ns103 ib_send_bw   -d mlx5_4   -i 1   -p 65532   --report_gbits   -D 30
```

```bash
sudo ip netns exec ns104 ib_send_bw   -d mlx5_5   -i 1   10.0.0.103   -p 65532   --report_gbits   -D 30
```

这里第二组使用 `65532`，主要是为了并发测试时区分端口和日志。

## 提高 RDMA 打流压力

如果默认参数无法打满 100G，可以尝试增大消息大小：

```bash
-s 65536
```

或者增加 QP 数量：

```bash
-q 4
```

示例：

```bash
sudo ip netns exec ns101 ib_send_bw   -d mlx5_2   -i 1   -p 65531   --report_gbits   -s 65536   -q 4   -D 30
```

client 端：

```bash
sudo ip netns exec ns102 ib_send_bw   -d mlx5_3   -i 1   10.0.0.101   -p 65531   --report_gbits   -s 65536   -q 4   -D 30
```

可以按如下顺序逐步增加压力：

```text
-q 1
-q 2
-q 4
-q 8
```

不要一开始就设置过大的 QP 数量，否则不利于判断瓶颈来源。

## RoCE 抓包观察

在 RoCEv2 场景下，普通 `tcpdump` 可以看到 ARP、TCP 控制连接以及 UDP 4791 相关报文。

第一组链路抓包：

```bash
sudo ip netns exec ns101 tcpdump -i ens3f0np0 -nn -e   'arp or icmp or udp port 4791 or tcp port 65531'
```

保存抓包文件：

```bash
sudo ip netns exec ns101 tcpdump -i ens3f0np0 -nn -s 0 -w ib_ns101_ns102.pcap   'arp or udp port 4791 or tcp port 65531'
```

第二组链路抓包：

```bash
sudo ip netns exec ns103 tcpdump -i ens6f0np0 -nn -s 0 -w ib_ns103_ns104.pcap   'arp or udp port 4791 or tcp port 65532'
```

如果只能看到 TCP 控制连接，但看不到 UDP 4791，可能需要进一步检查 GID index、RoCE 模式、设备映射或 RDMA 数据路径。

## GID index 检查

RoCE 测试中，经常需要指定 GID index。可以查看 GID：

```bash
sudo ip netns exec ns101 show_gids
sudo ip netns exec ns102 show_gids
sudo ip netns exec ns103 show_gids
sudo ip netns exec ns104 show_gids
```

如果查到 IPv4 地址对应的 GID index 是 `3`，则 `ib_send_bw` 命令中加入：

```bash
-x 3
```

示例：

```bash
sudo ip netns exec ns101 ib_send_bw   -d mlx5_2   -i 1   -x 3   -p 65531   --report_gbits   -D 30
```

client 端同样加入 `-x 3`：

```bash
sudo ip netns exec ns102 ib_send_bw   -d mlx5_3   -i 1   -x 3   10.0.0.101   -p 65531   --report_gbits   -D 30
```

如果不确定 GID index，可以先不加 `-x` 测试；如果报 GID、route、connection 或 RDMA_CM 相关错误，再根据 `show_gids` 结果指定。

## 常见问题排查

如果 `ping` 通，但 `ib_send_bw` 不通，优先按以下顺序排查。

确认 RDMA 设备和网口映射：

```bash
sudo ip netns exec ns101 ibdev2netdev
sudo ip netns exec ns102 ibdev2netdev
```

确认 RDMA 设备状态：

```bash
sudo ip netns exec ns101 ibv_devinfo -d mlx5_2 | grep -E 'state|link_layer|active_mtu'
sudo ip netns exec ns102 ibv_devinfo -d mlx5_3 | grep -E 'state|link_layer|active_mtu'
```

确认 IP 层连通：

```bash
sudo ip netns exec ns101 ping -I 10.0.0.101 10.0.0.102
```

确认 GID index：

```bash
sudo ip netns exec ns101 show_gids
sudo ip netns exec ns102 show_gids
```

查看 RDMA namespace 模式：

```bash
rdma system show
```

查看 RDMA 设备：

```bash
rdma dev show
```

如果 namespace 中看不到 RDMA 设备，可以考虑检查 RDMA 设备是否需要显式移动到对应 namespace：

```bash
sudo rdma dev set mlx5_2 netns ns101
sudo rdma dev set mlx5_3 netns ns102
```

这一步不要贸然执行，只有在 namespace 中无法正常看到 RDMA 设备时再考虑。

## 后续接交换机后的测试思路

当前只是两根光纤点对点互联，用于确认网口隔离、链路状态、基础通信和 RDMA 打流能力。

后续四个网口接入交换机后，应确保交换机侧满足：

```text
四个端口在同一个 VLAN
未开启端口隔离
未配置 Private VLAN
未配置阻断互通的 ACL
未做 LACP/bond 聚合
```

接入交换机后，需要测试任意两两互通：

```bash
sudo ip netns exec ns101 ping -I 10.0.0.101 10.0.0.102
sudo ip netns exec ns101 ping -I 10.0.0.101 10.0.0.103
sudo ip netns exec ns101 ping -I 10.0.0.101 10.0.0.104
```

并通过抓包确认流量从物理口出去：

```bash
sudo ip netns exec ns101 tcpdump -i ens3f0np0 -nn -e 'arp or icmp'
```

如果 `ns101` 访问 `10.0.0.103` 时，`ens3f0np0` 上能看到 ARP 和 ICMP 报文，就可以确认流量确实经过物理口出到交换机，而不是走机内 local route。

## 小结

本次配置的核心思路是：不要把四个高速网口的 IP 放在同一个 Linux 默认网络栈中，而是将每个物理网口分别放入独立的 network namespace。

最终形成的隔离关系为：

```text
ens3f0np0 -> ns101 -> 10.0.0.101/24
ens3f1np1 -> ns102 -> 10.0.0.102/24
ens6f0np0 -> ns103 -> 10.0.0.103/24
ens6f1np1 -> ns104 -> 10.0.0.104/24
```

当前验证结果表明：

```text
四个网口已经从默认 namespace 中移走
四个 namespace 内 IP 配置正确
两组点对点光纤均可正常 ping 通
四个光口均为 100G Full Duplex，Link detected: yes
后续可以继续进行 iperf3 TCP 测速和 ib_send_bw RDMA 打流测试
```

这套方式适合在单台服务器上模拟多台独立主机的高速网卡通信行为，也适合后续接入交换机测试二层转发、RoCE/RDMA 打流、链路隔离和多端口并发吞吐。
