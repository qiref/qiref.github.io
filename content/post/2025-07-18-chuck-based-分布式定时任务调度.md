---
title: "2025 07 18 Chuck Based 分布式定时任务调度"
date: 2025-07-18T17:12:09+08:00
draft: true
---


## 问题背景

有个event表的数据，需要用定时任务定期处理，处理后状态改为已完成；
定时任务所在的程序是多实例的，希望能通过横向扩展，加速定时任务处理的吞吐量；

![原始问题](/assets/img/分布式任务调度-1.svg)


当 scheduler task 横向扩容，出现多个实例时，多个定时任务同时执行，为了保证同一时间只有一个实例执行定时任务，多个定时任务之间需要加锁，并发量不大的情况下，可以用数据库实现一个简单的分布式锁；

```sql
CREATE TABLE `locker` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT 'ID',
  `bizType` varchar(100) NOT NULL,
  `bizId` varchar(100) NOT NULL,
  `createTime` datetime DEFAULT CURRENT_TIMESTAMP,
  `updateTime` datetime DEFAULT CURRENT_TIMESTAMP,
  `unlockTime` datetime DEFAULT '0000-00-00 00:00:00',
  PRIMARY KEY (`id`),
  UNIQUE KEY `bizType` (`bizType`,`bizId`)
) ENGINE=InnoDB AUTO_INCREMENT=2593578 DEFAULT CHARSET=utf8mb3 COMMENT='locker';
```

1. 相同定时任务使用相同的 bizType+bizId；通过UNIQUE KEY 约束，同时只能有一个实例写入数据；写入成功则获取到锁；
2. 获取到锁时，写入一个过期时间，任务执行过程中，不断对锁进行续期；
3. 另起定时任务，扫描过期的锁进行清除；
4. 定时任务结束后，清除锁；

在这种场景下，多个定时任务进程中，同时只有一个实例执行；当原始问题中的 Event table 数据量很大，需要增加处理吞吐量时，无法通过横向扩容解决。


## 定时任务拆分

受 DBLog 论文启发，可以提前对数据进行分片，不同分片交给不同的实例进行处理，从而提高吞吐量；

具体思路如下:
1. 先对 event 表数据作拆分，按照特定的 chuck size，拆分为不同 chuck，写入到 chuck 表：
  ``` sql
CREATE TABLE `chuck` (
  `id` bigint(11) unsigned NOT NULL AUTO_INCREMENT,
  `event_start_pos` bigint(20) DEFAULT NULL,
  `event_end_pos` bigint(20) DEFAULT NULL,
  `status` int(11) DEFAULT NULL COMMENT '0:待执行；1：执行中；2：已完成',
  `version` int(11) DEFAULT NULL,
  `create_time` timestamp NULL DEFAULT NULL,
  `update_time` timestamp NULL DEFAULT NULL,
  `expired_time` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  ```
2. 多个 scheduler task 使用乐观锁竞争，从 chuck 表中读取一个分片，进行处理；处理完成后，修改分片状态，同时修改 event 表记录的状态；
  ``` sql
  select * FROM `chuck` where status=0
  update chuck set status=1,version=$version+1 where id = ? and version=?
  update chuck set status=2 where id = ?
  ```
3. 容错处理，需要有单独的定时任务处理过期的 chuck ，执行一个分片的 scheduler task 有可能挂掉，需要有个过期时间，超过一定时间，需要重新把过期的分片状态重新改为待执行；
  ``` sql
  select * FROM `chuck` where status=1 and  now()>expired_time
  update chuck set status=1 where id = ?
  ```

  
