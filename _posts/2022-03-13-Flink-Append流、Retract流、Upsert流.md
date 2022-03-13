---
layout: post
title:  "Flink-Flink-Append流、Retract流、Upsert流"
date:   2022-03-04 11:16:23 +0700
categories: [Flink]
tags:   Flink
comments: true
---

摘要： 介绍 Flink 中 Append流、Retract流、Upsert流的含义。

------

- [Append流](#Append流)
- [Retract流](#Retract流)
- [Upsert流](#Upsert流)

## Append流

在 Append 流中，仅通过 `INSERT` 操作修改的动态表，可以通过输出插入的行转换为流。

## Retract流

 retract 流包含两种类型的 message： add messages 和 retract messages 。
 
 通过将INSERT 操作编码为 add message、将 `DELETE` 操作编码为 retract message、将 `UPDATE` 操作编码为更新(先前)行的 retract message 和更新(新)行的 add message，将动态表转换为 retract 流。

|  OPERATOR   | ENCODE  |
|  ----   | ----  |
| insert  | add |
| update  | retract -> add |
| delete  | retract |


## Upsert流

upsert 流包含两种类型的 message： upsert messages 和delete messages。

转换为 upsert 流的动态表需要(可能是组合的)唯一键。通过将 `INSERT` 和 `UPDATE` 操作编码为 upsert message，将 `DELETE` 操作编码为 delete message ，将具有唯一键的动态表转换为流。消费流的算子需要知道唯一键的属性，以便正确地应用 message。与 retract 流的主要区别在于 `UPDATE` 操作是用单个 message 编码的，因此效率更高。

|  OPERATOR   | ENCODE  |
|  ----   | ----  |
| insert  | upsert |
| update  | upsert |
| delete  | delete |

* 将动态表转为datastream时，仅支持append 流与retract流。

* 将动态表输出到外部系统时，支持Append、Retract以及Upsert模式


<https://nightlies.apache.org/flink/flink-docs-release-1.12/zh/dev/table/streaming/dynamic_tables.html>

------
