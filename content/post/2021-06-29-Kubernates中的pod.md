---
comments: true
date: "2021-06-29T10:18:23Z"
tags: 
  - Kubernates
title: Kubernates中的pod
---

摘要：运行在Kubernates中的容器：pod。由于不能将多个进程聚集在一个单独的容器中，我们需要一种更高级的结构将容器绑定在一起，将它们作为一个单元进行管理，这就是pod诞生的原因。

------

## pod基本概念

pod是Kubernetes中最重要的概念，pod是Kubernetes中部署的最小单元，一个pod中可以有一个或多个容器，pod有自己独立的私有IP和主机名。

Kubernetes 集群中的 Pod 主要有两种用法：

* 运行单个容器的 Pod。"每个 Pod 一个容器"模型是最常见的 Kubernetes 用例； 在这种情况下，可以将 Pod 看作单个容器的包装器，并且 Kubernetes 直接管理 Pod，而不是容器。
* 运行多个协同工作的容器的 Pod。 Pod 可能封装由多个紧密耦合且需要共享资源的共处容器组成的应用程序。 这些位于同一位置的容器可能形成单个内聚的服务单元，一个pod中的容器共享网络和volume，并且pod中的容器共享相同的命名空间。（由于一个pod中的容器共享网络，因此也就共享端口和IP。）

一般情况下，如果不是多个容器需要共用net或volume，尽可能地把不同的容器放到不同的pod中，新建一个pod不需要耗费很多资源，Kubernetes可以很方便地对pod进行管理和扩容、缩容等操作，这种方式可以更好地利用基础资源。

总结来说，pod就是逻辑上的主机。

## pod生命周期

* Pending：表示pod已经被同意创建，正在等待kube-scheduler选择合适的节点创建，一般是在准备镜像；
* Running：表示pod中所有的容器已经被创建，并且至少有一个容器正在运行或者是正在启动或者是正在重启；
* Succeeded：表示所有容器已经成功终止，并且不会再启动；
* Failed：表示pod中所有容器都是非0（不正常）状态退出；
* Unknown：表示无法读取Pod状态，通常是kube-controller-manager无法与Pod通信。

### 创建pod流程

1. 客户端提交Pod的配置信息（可以是yaml文件定义好的信息）到kube-apiserver；
2. Apiserver收到指令后，通知给controller-manager创建一个资源对象；
3. Controller-manager通过api-server将pod的配置信息存储到ETCD数据中心中；
4. Kube-scheduler检测到pod信息会开始调度预选，会先过滤掉不符合Pod资源配置要求的节点，然后开始调度调优，主要是挑选出更适合运行pod的节点，然后将pod的资源配置单发送到node节点上的kubelet组件上。
5. Kubelet根据scheduler发来的资源配置单运行pod，运行成功后，将pod的运行信息返回给scheduler，scheduler将返回的pod运行状况的信息存储到etcd数据中心。

### 删除pod流程

1. pod从service的endpoint列表中被移除；
2. 如果该pod定义了一个停止前的钩子，其会在pod内部被调用，停止钩子一般定义了如何优雅的结束进程；
3. 进程被发送TERM信号（kill -14）；
4. 当超过优雅退出的时间后，Pod中的所有进程都会被发送SIGKILL信号（kill -9）。

## pod常用命令

``` shell
kubectl describe po cluster-admin-0 -n default # 获取指定namespaces下的pod详情，可以看出container信息
kubectl get pods --all-namespaces # 获取所有namespaces下的pod
kubectl get pods -n default # -n 获取指定namaspaces下的pod
kubectl get pod podname -nkube-system -oyaml # 获取pod的详情，-oyaml 以yaml格式输出，也可以 -ojson
kubectl exec -it taskcenter-0 -c loglistener -noceanus /bin/bash # 进入某个pod下的cotainer
kubectl logs tke-log-agent-2687c -c loglistener # 获取某个pod下cotainer的log，也可以加 -f 参数，类似于 tail -f
```

## 创建pod的方式

pod本身不具备故障重启以及副本等功能，一般使用其他的资源创建pod。

* ReplicaSet 替代 ReplicationController，可以始终保持所需数量的pod副本正在运行，ReplicaSet具备更强的selector expression。
* DaemonSet可以确保每个节点都运行一个pod实例，而ReplicaSet 和 ReplicationController 会将pod随机安排到集群节点。
* Job可以创建批处理任务，可以在Job中运行一个或多个pod，周期性运行或在某个时间运行的Job可以通过CronJob实现。

参考：

<https://kubernetes.io/zh/docs/concepts/workloads/pods/>

《Kubernetes in Action》

------