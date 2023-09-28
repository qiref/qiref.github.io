---
title: "Chandy-Lamport 算法笔记"
date: 2023-05-08T22:38:42+08:00
tags:
  - Algorithm
  - Paper
pin: true
# bookComments: false
# bookSearchExclude: false
---

## 前言

Global Snapshot（Global State）：全局快照，分布式系统在 Failure Recovery 的时候非常有用，也是广泛应用在分布式系统，更多是分布式计算系统中的一种容错处理理论基础。

在 Chandy-Lamport 算法中，为了定义分布式系统的 Global Snapshot，先将分布式系统简化成有限个进程和进程之间的 channel 组成，也就是一个有向图 （GAG）：节点是进程，边是 channel。因为是分布式系统，也就是说，这些进程是运行在不同的物理机器上的。那么一个分布式系统的  Global Snapshot 就是有进程的状态和 channel 中的 message 组成，这个也是分布式快照算法需要记录的。因此，Chandy-Lamport 算法解决了分布式系统在 Failure Recovery 时，可以从  Global Snapshot 中恢复的问题；

## 算法过程

### 前提条件及定义

- process（Pn）：分布式系统中的进程，用 P1，P2，P3 表示；
- channel：分布式系统中，Pn 与 Pm 通信的管道，C12 表示从 P1 到 P2 的 channel，反之，C32 表示从 P3 到 P2的 channel；
- message：分布式系统中，Pn 与 Pm 之间发送的业务消息；M23 表示从 P2 到 P3 的 message；
- marker：在 Chandy-Lamport 算法中，Pn 与 Pm 之间发送的标记消息，不同于业务的 message，marker 是由 Chandy-Lamport 算法定义，用于帮助实现快照算法；
- snapshot/state：都表示快照，同时包括进程本身的状态和 message；下文中统一全局快照叫 snapshot，process 本地快照叫 state；

Chandy-Lamport 算法有一些前提条件：

1. 进程之间的 message 是有序的，也即FIFO channel；
2. 进程之间的 message 是可靠传递的；

### 算法步骤

1. Pn 中任意进程发起 snapshot，例如 P1 此时发起 snapshot；
    1. P1 首先保存本地的 state；
    2. P1 向 output channel 发送 marker 消息到其他进程（P2，P3）；
    3. P1 开始记录所有 input channel 的 message；？？？
2. P2 收到 marker 消息后；
    1. 如果 P2 还未记录本地的 state，也就是第一次收到 marker消息（例如收到 P1 marker 消息）；
        1. P2 开始记录本地 state；
        2. P2 将 input channel C12 置为空；？？？
        3. P2 向 output channel 发送 marker 消息（P1，P3）；
        4. P2 记录除 C12 之外的所有 input channel 的 message；
    2. 如果 P2 已经完成本地 state 记录，不是第一次收到 marker消息（例如收到 P3 marker 消息）；
        1. 记录 input channel C32 在收到 marker 消息之前的 message；
3. P1 P2 P3 收到 marker 消息并记录自己的 state 和 message；所有 state 都记录完成后，可以由某个服务器收集这些分散的快照，形成全局快照 （Global Snapshot），全局快照由每个进程的 state 和每个通道的 message 组成；

### 问题

为什么 P1 发起 snapshot 之后，要开始记录所有 input channel 的 message？

要回答这个问题，首先要明确，每一次的 snapshot 是从什么时候结束的，当最后一个 P 本地的 state 全部完成之后，才算是一次 snapshot；所以，在一次 snapshot 发起之后，到最后一个 P 完成本地 state，进程之间的增量 message 也会记录并保存到 state 中；

为什么 P2 开始记录本地 state 之后需要将 C12 置为空？

回答这个问题，需要理解算法中，marker 这个消息有什么作用，其实 marker 是为了分割每一次的 snapshot！ 相当于是 message 之间的分隔符，当 P2 记录本地 state 之后，说明 P2 此时已经从 C12 中得到一个 marker 消息，从 P1 → P2 的消息默认都已经被 P2 接收到，并且处理完成（已经保存到 P2 的本地 state 中），换句话说，从 C12 中 marker 之后的消息，是下一次 snapshot 的 message；

## 示例

背景说明，3 个进程 P1 P2 P3；每个进程在运行中会产生自身的 state 例如 P1（a,b）,每个进程之间还会产生message，例如 message (b->f);

![chandy-lamport-bg](/assets/img/chandy-lamport-bg.svg)

在 Chandy-Lamport 算法中，可以由任意进程发起 snapshot；假设这里 P1 先发起 Global Snapshot；

![chandy-lamport-P1](/assets/img/chandy-lamport-P1.svg)

P1 先记录自身的 state(a,b)，然后向 P2 P3 发送 marker，最后记录 input channel C21 C31

![chandy-lamport-P3](/assets/img/chandy-lamport-P3.svg)

假设 P3 先接收到 marker 消息，此时是 P3 第一次收到 marker 消息，P3 先开始记录自身的 state(i)，然后将 C13 置为空，然后向 P1 和 P2 发送 marker 消息，最后，P3 记录 C23 的消息；

![chandy-lamport-P2](/assets/img/chandy-lamport-P2.svg)

当 P2 接收到 marker 消息之后，此时 P2 也是第一次收到 marker 消息，P2 开始记录自身的 state(f,g,h)，然后将 C32 置为空（marker 消息来自于 P3），然后向 P1 P3 发送 marker 消息，最后，P2 记录 C12 的消息；

至此，所有的 marker 消息已经发出，剩余的过程就是处理非首次接受到 marker 消息的流程；

![chandy-lamport-P1'](/assets/img/chandy-lamport-P1'.svg)

当 P1 收到 P2 P3 的 marker 消息时，由于 P1 是 snapshot 的发起者，认为 P1 已经接受到 marker 消息，此时：
* 在 time1 时刻，接收到 P3 的 marker 消息，只需要记录 C31 的消息，此时 C31 为空；
* 在 time2 时刻，接收到 P2 的 marker 消息，只需要记录 C21 的消息，此时 channel 中有个消息 message（h->d）,因此，需要把 message（h->d）记录到 snapshot 中，P1 的工作完成了;

与 P1 同理，当 P2 P3 再次接收到 marker 消息时，只需要记录 channel 的消息就行，由于 P2 P3 后续过程没有消息传输，这里不再赘述； 当所有进程处理完所有 marker 消息之后，一次 snapshot 流程就结束了；

从结果上看，一次 snapshot 包括了 `state(a,b,f,g,h,i) + message（h->d）` , 由于 g 在 state 中，并且 h->d 是在一次 snapshot 中发生的，所以，h->d 也应该包含在这次 snapshot 中，这也就是 Chandy-Lamport 算法的精妙之处！

## 参考

[分布式系统的全局快照 - Yang Blog](https://yang.observer/2021/11/27/distributed-snapshots/)

[paper_reading/Chandy-Lamport.md at main · legendtkl/paper_reading · GitHub](https://github.com/legendtkl/paper_reading/blob/main/realtime-compute/Chandy-Lamport.md)

[Chandy–Lamport algorithm - Wikipedia](https://en.wikipedia.org/wiki/Chandy%E2%80%93Lamport_algorithm)