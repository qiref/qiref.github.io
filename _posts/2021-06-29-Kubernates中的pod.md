---
layout: post
title:  "Kubernates中的pod"
date:   2021-06-29 10:18:23 +0700
categories: [Kubernates]
tags:   Kubernates
comments: true
---

摘要：运行在Kubernates中的容器：pod。

------

## pod基本概念

pod是Kubernetes中最重要的概念，pod是Kubernetes中部署的最小单元，一个pod中可以有一个或多个容器，pod有自己独立的私有IP和主机名。

Kubernetes 集群中的 Pod 主要有两种用法：

* 运行单个容器的 Pod。"每个 Pod 一个容器"模型是最常见的 Kubernetes 用例； 在这种情况下，可以将 Pod 看作单个容器的包装器，并且 Kubernetes 直接管理 Pod，而不是容器。
* 运行多个协同工作的容器的 Pod。 Pod 可能封装由多个紧密耦合且需要共享资源的共处容器组成的应用程序。 这些位于同一位置的容器可能形成单个内聚的服务单元，一个pod中的容器共享网络和volume。

一般情况下，如果不是多个容器需要共用net或volume，尽可能地把不同的容器放到不同的pod中，新建一个pod不需要耗费很多资源，Kubernetes可以很方便地对pod进行管理和扩容、缩容等操作，这种方式可以更好地利用基础资源。




参考：

<https://kubernetes.io/zh/docs/concepts/workloads/pods/>

《Kubernetes in Action》

------