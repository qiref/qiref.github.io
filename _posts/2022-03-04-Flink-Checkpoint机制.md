---
layout: post
title:  "Flink-Checkpoint机制"
date:   2022-03-04 11:16:23 +0700
categories: [Flink]
tags:   Flink
comments: true
---

摘要： 如果把运行中的 Flink 程序比做一条河流，Checkpoint 就是一个相机，定期地对河流进行拍照，记录河水的状态。

------

- [Flink Job 重启策略](#flink-job-重启策略)
- [Flink Job 开启 Checkpoint](#flink-job-开启-checkpoint)
- [Checkpoint 流程](#checkpoint-流程)
- [Checkpoint barrier](#checkpoint-barrier)

## Flink Job 重启策略

在作业运行时，经常会由于各种不确定因素导致作业停止，网络，磁盘，外部依赖等等，Flink 内部提供多种作业重启的策略来减少运维成本，Flink 程序设置重启策略后，当作业停止时，Flink 可以重新拉起作业，常用的重启策略如下：

``` java
StreamExecutionEnvironment executionEnvironment = StreamExecutionEnvironment.getExecutionEnvironment();

// 默认重启策略，没有重启策略
executionEnvironment.setRestartStrategy(RestartStrategies.noRestart());

// 采用集群的重启策略，如果没有定义其他重启策略，默认选择固定延时重启策略。
executionEnvironment.setRestartStrategy(RestartStrategies.fallBackRestart());

// 采用集群的重启策略，如果没有定义其他重启策略，默认选择固定延时重启策略。
executionEnvironment.setRestartStrategy(RestartStrategies.fallBackRestart());

// 如果20 S 内，有1次错误，则终止作业，不满足则会重启作业，重启时间间隔为 5 S
executionEnvironment.setRestartStrategy(RestartStrategies.failureRateRestart(1, Time.seconds(20), Time.seconds(5)));

```

source 定义了一个 Tuple3 的数据源，index 一直自增，在 map 过程中，遇到 100 时抛出一个异常； 作业运行的结果是，当 index=100 时，作业失败，然后重启，重新开始运行：

``` java

public class MapFunc {

    public static MapFunction<Tuple3<String, Integer, Long>, Tuple2<String, Integer>> getMapFunc(Logger logger) {
        return new MapFunction<Tuple3<String, Integer, Long>, Tuple2<String, Integer>>() {
            @Override
            public Tuple2<String, Integer> map(Tuple3<String, Integer, Long> event) throws Exception {
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
        Logger logger = LoggerFactory.getLogger(NoRestartJob.class);
        StreamExecutionEnvironment executionEnvironment = StreamExecutionEnvironment.getExecutionEnvironment();
        executionEnvironment.setParallelism(1);

        // 默认重启策略，没有重启策略
        executionEnvironment.setRestartStrategy(RestartStrategies.fixedDelayRestart(2, Time.seconds(5)));

        // source
        DataStreamSource<Tuple3<String, Integer, Long>> source = executionEnvironment.addSource(SourceFunc.getSourceFunc(logger));
        // map operator
        SingleOutputStreamOperator<Tuple2<String, Integer>> operator = source.map(MapFunc.getMapFunc(logger));
        // sink
        operator.print();

        executionEnvironment.execute("not-restart");
    }
}
```

完整代码地址： <https://github.com/ArchieYao/flink-learning/tree/main/hello-world>


## Flink Job 开启 Checkpoint

在给 Flink 作业设置重启策略后，作业失败时会重新运行，此时，作业是从最开始的位置开始运行，每次重新启动后，上述示例中的 sum 都会从 0 开始；

在真实场景下，通常不需要作业又重新把历史数据都计算一次，因为可能会造成数据重复，Flink 中因此引入了 Checkpoint 机制，作业可以利用 Checkpoint 保存 sum 的值，在失败的地方重新启动，此时 sum 的值会从 Checkpoint 中读取，并持续累加。

``` java
// 重启尝试次数 2，每次重启间隔 5 S
executionEnvironment.setRestartStrategy(RestartStrategies.fixedDelayRestart(2, Time.seconds(5)));
// 每10ms进行一次 Checkpoint
executionEnvironment.enableCheckpointing(10);
```

## Checkpoint 流程

<img src="/assets/img/checkpoint-flow.png" width="70%">

Chekcpoint 是由 jobmanager 中的 CheckpointCoordinator 发起的，CheckpointCoordinator 是一个类，Flink 中具体描述如下：

``` java
// The checkpoint coordinator coordinates the distributed snapshots of operators and state.
// It triggers the checkpoint by sending the messages to the relevant tasks and collects the checkpoint acknowledgements.
```

CheckpointCoordinator 会调度task 进行 checkpoint，并接收来自 tasks 的 ack；

用于保存 Checkpoint state 和 meta 的容器称为 state backend，Flink 中自带几种 state backend：

* MemoryStateBackend 内存型（默认）
* FsStateBackend 文件系统，本地、hdfs、cos
* RocksDBStateBackend 数据库RocksDB，存储在TaskManager的data目录下，也可以同步到远程


## Checkpoint barrier

在 Flink 的 stream 中，每一次的 Checkpoint 被 barrier 分割：

<img src="/assets/img/stream_barriers.svg" width="80%">

当算子接收到不止一个 steam 时，barrier 到达算子的顺序会不一致，此时，算子会停止处理新的数据，等到剩余的 barrier 到达算子后，才开始进行 Checkpoint，这就是 `Barrier Alignment` 。

<img src="/assets/img/stream_aligning.svg" width="90%">

基于 Barrier Alignment，Checkpoint 产生两种模式：`EXACTLY_ONCE` `AT_LEAST_ONCE` ，当 Barrier Alignment 时，先到来的数据进行 buffer，就是 `EXACTLY_ONCE`，当先到来的数据先进行处理时，就是 `AT_LEAST_ONCE` 。

------
