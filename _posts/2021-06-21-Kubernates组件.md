---
layout: post
title:  "Kubernates组件"
date:   2021-06-21 10:18:23 +0700
categories: [Kubernates]
tags:   Kubernates
comments: true
---

摘要：Kubernates基础概念及其组件。

------

Kubernetes是一个开源的容器编排引擎，用来对容器化应用进行自动化部署、扩缩容和管理，简称K8s，K8s 这个缩写是因为k和s之间有八个字符。Google 在 2014 年开源了 Kubernetes 项目。

![执行结果]({{ "/assets/img/components-of-kubernetes.svg" | relative_url }})

## 控制面组件

### kube-apiserver

apiserver是 Kubernetes 控制面的组件， 该组件公开了 Kubernetes API。

### etcd

etcd 是兼具一致性和高可用性的键值数据库，可以作为保存 Kubernetes 所有集群数据的后台数据库。

### kube-scheduler

负责监视新创建的、未指定运行节点（node）的 Pods，选择节点让 Pod 在上面运行。

调度决策考虑的因素包括单个 Pod 和 Pod 集合的资源需求、硬件/软件/策略约束、亲和性和反亲和性规范、数据位置、工作负载间的干扰和最后时限。

### kube-controller-manager 

从逻辑上讲，每个控制器都是一个单独的进程， 但是为了降低复杂性，它们都被编译到同一个可执行文件，并在一个进程中运行。

这些控制器包括:

* 节点控制器（Node Controller）: 负责在节点出现故障时进行通知和响应
* 任务控制器（Job controller）: 监测代表一次性任务的 Job 对象，然后创建 Pods 来运行这些任务直至完成
* 端点控制器（Endpoints Controller）: 填充端点(Endpoints)对象(即加入 Service 与 Pod)
* 服务帐户和令牌控制器（Service Account & Token Controllers）: 为新的命名空间创建默认帐户和 API 访问令牌

### cloud-controller-manager

云控制器管理器是指嵌入特定云的控制逻辑的 控制平面组件。 云控制器管理器允许您链接集群到云提供商的应用编程接口中， 并把和该云平台交互的组件与只和您的集群交互的组件分离开。
cloud-controller-manager 仅运行特定于云平台的控制回路。 如果你在自己的环境中运行 Kubernetes，或者在本地计算机中运行学习环境， 所部署的环境中不需要云控制器管理器。

与 kube-controller-manager 类似，cloud-controller-manager 将若干逻辑上独立的 控制回路组合到同一个可执行文件中，供你以同一进程的方式运行。 你可以对其执行水平扩容（运行不止一个副本）以提升性能或者增强容错能力。

下面的控制器都包含对云平台驱动的依赖：

* 节点控制器（Node Controller）: 用于在节点终止响应后检查云提供商以确定节点是否已被删除
* 路由控制器（Route Controller）: 用于在底层云基础架构中设置路由
* 服务控制器（Service Controller）: 用于创建、更新和删除云提供商负载均衡器

## Node 组件

维护运行的 Pod 并提供 Kubernetes 运行环境。

### kubelet

一个在集群中每个节点（node）上运行的代理。 它保证容器（containers）都 运行在 Pod 中。

kubelet 接收一组通过各类机制提供给它的 PodSpecs，确保这些 PodSpecs 中描述的容器处于运行状态且健康。 kubelet 不会管理不是由 Kubernetes 创建的容器。

### kube-proxy 

kube-proxy 是集群中每个节点上运行的网络代理， 实现 Kubernetes 服务（Service） 概念的一部分。

kube-proxy 维护节点上的网络规则。这些网络规则允许从集群内部或外部的网络会话与 Pod 进行网络通信。

如果操作系统提供了数据包过滤层并可用的话，kube-proxy 会通过它来实现网络规则。否则， kube-proxy 仅转发流量本身。



来源：<https://kubernetes.io/zh/docs/concepts/overview/components/>

------