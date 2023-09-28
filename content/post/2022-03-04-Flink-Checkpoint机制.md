---
comments: true
date: "2022-03-04T11:16:23Z"
tags: 
  - Flink
title: Flink Checkpoint机制
---

摘要： 如果把运行中的 Flink 程序比做一条河流，Checkpoint 就是一个相机，定期地对河流进行拍照，记录河水的状态。本文以自顶向下的视角，从理论到实现，分析 Flink 中的 Checkpoint 机制；

------

- [理论基础](#理论基础)
  - [asynchronous barrier snapshotting](#asynchronous-barrier-snapshotting)
  - [算法步骤](#算法步骤)
- [算法在 Flink 中的实现](#算法在-flink-中的实现)
  - [Flink Checkpoint 整体流程](#flink-checkpoint-整体流程)
  - [Flink Checkpoint Barrier Alignment](#flink-checkpoint-barrier-alignment)
- [Flink Checkpoint 使用](#flink-checkpoint-使用)
  - [Flink Job 重启策略](#flink-job-重启策略)
  - [Flink Job 开启 Checkpoint](#flink-job-开启-checkpoint)

## 理论基础

### asynchronous barrier snapshotting
Flink Checkpoint 机制是异步屏障快照（asynchronous barrier snapshotting, ABS）算法的一种实现，而 ABS 算法基于 [Chandy-Lamport](https://archieyao.github.io/posts/2023-05-08-chandy-lamport%E7%AE%97%E6%B3%95/) 的变种，但数据模型是还是基于  Chandy-Lamport；

在 flink 中，作业算子被抽象为 DAG，节点为 operator，边是每一个 operator 的 stream（channel），与 Chandy-Lamport 的数据模型正好吻合；

ABS 算法把 Chandy-Lamport 中的 marker 消息换成了 barrier，作用是一致的，都是切分 snapshot；

ABS 算法 中 asynchronous 是异步的意思，当算子收齐 barrier 并触发快照之后，不会等待快照数据全部写入状态后端，而是一边后台写入，一边立刻继续处理数据流，并将 barrier 发送到下游，实现了最小化延迟。当然，引入异步性之后，所有有状态的算子都需要上报 ack，否则 JobManager 就无法确认一次 snapshot 是否完成。

### 算法步骤
* Source算子接收到JobManager产生的屏障，生成自己状态的快照（其中包含数据源对应的offset/position信息），并将屏障广播给下游所有数据流；
* 下游非 Source 的算子从它的某个输入数据流接收到屏障后，会阻塞这个输入流，继续接收其他输入流，直到所有输入流的屏障都到达。一旦算子收齐了所有屏障，它就会生成自己状态的快照，并继续将屏障广播给下游所有数据流；
* Sink算子接收到屏障之后会向 JobManager 确认，所有Sink都确认收到屏障标记着这一周期checkpoint过程结束，快照成功。

如果算子只有一个输入流的话，问题就比较简单，只需要在收到屏障之后立即做快照。但是如果有多个输入流，就必须要等待收到所有屏障才能做快照，以避免将检查点 n 与检查点 n + 1 的数据混淆。这个等待的过程就叫做对齐（alignment），见下图；

## 算法在 Flink 中的实现

在 Flink 的 stream 中，每一次的 Checkpoint 被 barrier 分割：

![stream-barriers](/assets/img/stream_barriers.svg)


当算子接收到不止一个 steam 时，barrier 到达算子的顺序会不一致，此时，算子会停止处理新的数据，等到剩余的 barrier 到达算子后，才开始进行 Checkpoint，这就是 `Barrier Alignment` 。

![stream-aligning](/assets/img/stream_aligning.svg)




### Flink Checkpoint 整体流程

![Checkpoint 流程](/assets/img/checkpoint-flow.svg)

Chekcpoint 是由 jobmanager 中的 CheckpointCoordinator 发起的，CheckpointCoordinator 是一个类，Flink 中具体描述如下：

``` java
// The checkpoint coordinator coordinates the distributed snapshots of operators and state.
// It triggers the checkpoint by sending the messages to the relevant tasks and 
// collects the checkpoint acknowledgements.
```

CheckpointCoordinator 会调度task 进行 checkpoint，并接收来自 tasks 的 ack；

用于保存 Checkpoint state 和 meta 的容器称为 state backend，Flink 中自带几种 state backend：

* MemoryStateBackend 内存型（默认）
* FsStateBackend 文件系统，本地、hdfs、cos
* RocksDBStateBackend 数据库RocksDB，存储在TaskManager的data目录下，也可以同步到远程


### Flink Checkpoint Barrier Alignment

基于 Barrier Alignment，Checkpoint 产生两种模式：`EXACTLY_ONCE` `AT_LEAST_ONCE` ；

当 Barrier Alignment 时，先到来的数据进行 buffer，就是 `EXACTLY_ONCE`，当先到来的数据先进行处理时，就是 `AT_LEAST_ONCE` 。

从Flink 1.11开始，Checkpoint 可以是非对齐的。 Unaligned checkpoints 包含 In-flight 数据(例如，存储在缓冲区中的数据)作为 Checkpoint State的一部分，允许 Checkpoint Barrier 跨越这些缓冲区。因此，Checkpoint 时长变得与当前吞吐量无关，因为 Checkpoint Barrier 实际上已经不再嵌入到数据流当中。 使用  Unaligned checkpoints 也会带来新的代价，State 中会保存数据，这样会增加 State 的负担；

如果到算子背压是由于 Checkpoint 周期过长（Barrier Alignment）时，此时建议使用  Unaligned checkpoint；

``` java
StreamExecutionEnvironment env = StreamExecutionEnvironment.getExecutionEnvironment();
// 启用非对齐 Checkpoint
env.getCheckpointConfig().enableUnalignedCheckpoints();
```

## Flink Checkpoint 使用

### Flink Job 重启策略

在作业运行时，经常会由于各种不确定因素导致作业停止，网络，磁盘，外部依赖等等，Flink 内部提供多种作业重启的策略来减少运维成本，Flink 程序设置重启策略后，当作业停止时，Flink 可以重新拉起作业，常用的重启策略如下：

``` java
StreamExecutionEnvironment executionEnvironment =
        StreamExecutionEnvironment.getExecutionEnvironment();
// 默认重启策略，没有重启策略
executionEnvironment.setRestartStrategy(RestartStrategies.noRestart());
// 采用集群的重启策略，如果没有定义其他重启策略，默认选择固定延时重启策略。
executionEnvironment.setRestartStrategy(RestartStrategies.fallBackRestart());
// 采用集群的重启策略，如果没有定义其他重启策略，默认选择固定延时重启策略。
executionEnvironment.setRestartStrategy(RestartStrategies.fallBackRestart());
// 如果20 S 内，有1次错误，则终止作业，不满足则会重启作业，重启时间间隔为 5 S
executionEnvironment.setRestartStrategy(
        RestartStrategies.failureRateRestart(1, Time.seconds(20), Time.seconds(5)));
```

source 定义了一个 Tuple3 的数据源，index 一直自增，在 map 过程中，遇到 100 时抛出一个异常； 作业运行的结果是，当 index=100 时，作业失败，然后重启，重新开始运行：

``` java

public class MapFunc {
    public static MapFunction<Tuple3<String, Integer, Long>, Tuple2<String, Integer>> getMapFunc(
            Logger logger) {
        return new MapFunction<Tuple3<String, Integer, Long>, Tuple2<String, Integer>>() {
            @Override
            public Tuple2<String, Integer> map(Tuple3<String, Integer, Long> event)
                    throws Exception {
                if (event.f1 % 100 == 0) {
                    logger.error("event.f1 more than 100. value : " + event.f1);
                    throw new RuntimeException("event.f1 more than 100.");
                }
                return new Tuple2<>(event.f0, event.f1);
            }
        };
    }
}

// 运行作业
public class FixedDelayRestartJob {

    public static void main(String[] args) throws Exception {
        Logger logger = LoggerFactory.getLogger(FixedDelayRestartJob.class);
        StreamExecutionEnvironment executionEnvironment =
                StreamExecutionEnvironment.getExecutionEnvironment();
        executionEnvironment.setParallelism(1);
        // 重启尝试次数 2，每次重启间隔 5 S
        executionEnvironment.setRestartStrategy(
                RestartStrategies.fixedDelayRestart(2, Time.seconds(5)));
        // source
        DataStreamSource<Tuple3<String, Integer, Long>> source =
                executionEnvironment.addSource(SourceFunc.getSourceFunc(logger));
        // map operator
        SingleOutputStreamOperator<Tuple2<String, Integer>> operator =
                source.map(MapFunc.getMapFunc(logger));
        // sink
        operator.print();
        executionEnvironment.execute("not-restart");
    }
}
```

### Flink Job 开启 Checkpoint

在给 Flink 作业设置重启策略后，作业失败时会重新运行，此时，作业是从最开始的位置开始运行，每次重新启动后，上述示例中的 sum 都会从 0 开始；

在真实场景下，通常不需要作业又重新把历史数据都计算一次，因为可能会造成数据重复，Flink 中因此引入了 Checkpoint 机制，作业可以利用 Checkpoint 保存 sum 的值，在失败的地方重新启动，此时 sum 的值会从 Checkpoint 中读取，并持续累加。

``` java
// 重启尝试次数 2，每次重启间隔 5 S
executionEnvironment.setRestartStrategy(RestartStrategies.fixedDelayRestart(2, Time.seconds(5)));
// 每10ms进行一次 Checkpoint
executionEnvironment.enableCheckpointing(10);
```

完整代码地址： <https://github.com/ArchieYao/flink-learning/tree/main/hello-world>

------

参考：

[https://nightlies.apache.org/flink/flink-docs-release-1.16/zh/docs/ops/state/checkpointing_under_backpressure/](https://nightlies.apache.org/flink/flink-docs-release-1.16/zh/docs/ops/state/checkpointing_under_backpressure/)
