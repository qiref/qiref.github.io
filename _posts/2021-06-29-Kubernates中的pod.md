---
layout: post
title:  "Kubernates中的pod"
date:   2021-06-29 10:18:23 +0700
categories: [Kubernates]
tags:   Kubernates
comments: true
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

## pod常用命令

``` shell
kubectl describe po cluster-admin-0 -n default # 获取指定namespaces下的pod详情，可以看出container信息
kubectl get pods --all-namespaces # 获取所有namespaces下的pod
kubectl get pods -n default # -n 获取指定namaspaces下的pod
kubectl get pod podname -nkube-system -oyaml # 获取pod的详情，-oyaml 以yaml格式输出，也可以 -ojson
kubectl exec -it taskcenter-0 -c loglistener -noceanus /bin/bash # 进入某个pod下的cotainer
kubectl logs tke-log-agent-2687c -c loglistener # 获取某个pod下cotainer的log，也可以加 -f 参数，类似于 tail -f
```

参考：

<https://kubernetes.io/zh/docs/concepts/workloads/pods/>

《Kubernetes in Action》

------