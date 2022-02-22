---
layout: post
title:  "Flink-WordCount"
date:   2022-02-22 18:16:23 +0700
categories: [Flink]
tags:   Flink
comments: true
---

摘要：Flink 从零开始，下载集群并运行 WordCount Job。 完整代码地址： <https://github.com/ArchieYao/flink-learning/tree/main/hello-world>

------

## Flink 本地模式集群安装

运行Flink，需提前安装好 Java 8 或者 Java 11。

``` shell
wget https://dlcdn.apache.org/flink/flink-1.14.3/flink-1.14.3-bin-scala_2.12.tgz
tar -zxvf flink-1.14.3-bin-scala_2.12.tgz
cd flink-1.14.3
./bin/start-cluster.sh
```

运行成功后，可以在 IP:8081 访问 Flink-UI

## Flink Word Count job

source 是多段文本，类型： DataSource<String> ，经过 flatMap，切分为每个单词，然后转换为：(val,n) 的数据，然后根据 val 分组统计，得出 sum(n) 的值。

``` java
public static void main(String[] args) throws Exception {
        // 创建Flink任务运行环境
        final ExecutionEnvironment executionEnvironment = ExecutionEnvironment.getExecutionEnvironment();

        // 创建DataSet，数据是一行一行文本
        DataSource<String> text = executionEnvironment.fromElements(
                "Licensed to the Apache Software Foundation (ASF) under one",
                "or more contributor license agreements.  See the NOTICE file",
                "distributed with this work for additional information",
                "regarding copyright ownership.  The ASF licenses this file",
                "to you under the Apache License, Version 2.0 (the"
        );

        // 通过Flink内置转换函数进行计算
        AggregateOperator<Tuple2<String, Integer>> sum = text.flatMap(new 
		FlatMapFunction<String, Tuple2<String, Integer>>() {
            @Override
            public void flatMap(String value, Collector<Tuple2<String, Integer>> collector) throws Exception {
                String[] split = value.split("\\W+");
                for (String s : split) {
                    if (s.length() > 0) {
                        collector.collect(new Tuple2<>(s, 1));
                    }
                }
            }
        }).groupBy(0).sum(1);

        // 打印结果
        sum.print();
    }
```

Job 可以直接运行，也可以提交到 Flink 集群中运行。

``` shell
mvn clean package -DskipTests -Dcheckstyle.skip=true -Drat.skip=true

# 值得注意的是，在 pom 中，应该指定 Job 的 main class。
<plugin>
    <groupId>org.apache.maven.plugins</groupId>
    <artifactId>maven-jar-plugin</artifactId>
    <version>2.5</version>
    <configuration>
        <archive>
            <manifest>
                <mainClass>archieyao.github.io.WordCount</mainClass>
            </manifest>
        </archive>
    </configuration>
</plugin>

./bin/flink run -j hello-world-1.0-SNAPSHOT.jar
```


------
