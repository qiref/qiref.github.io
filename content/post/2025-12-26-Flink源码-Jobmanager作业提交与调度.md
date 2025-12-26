---
title: "Flink源码 Jobmanager作业提交与调度"
date: 2025-12-26T11:39:10+08:00
toc: true
tags:
  - Flink
---

详细梳理 Flink 中从 Client 提交作业到任务在 TaskManager 上执行的完整流程。

## 1. 整体流程概览

```
Client 提交 JobGraph
       ↓
REST API (JobSubmitHandler)    -- 接收 HTTP 请求，解析 JobGraph
       ↓
Dispatcher.submitJob()         -- 作业提交入口，创建 JobManagerRunner
       ↓
JobManagerRunner.start()       -- 启动 Leader 选举
       ↓
grantLeadership()              -- 获得 Leadership
       ↓
JobMasterServiceProcess        -- 创建 JobMaster
       ↓
JobMaster.onStart()            -- JobMaster 启动，触发调度
       ↓
SchedulerBase.startScheduling  -- 创建 ExecutionGraph，开始调度
       ↓
SchedulingStrategy             -- 调度策略，决定任务调度顺序
       ↓
ExecutionDeployer              -- 分配 Slot，部署任务
       ↓
TaskManagerGateway             -- RPC 调用，提交任务到 TaskManager
       ↓
TaskExecutor.submitTask()      -- 创建 Task，启动执行线程
       ↓
Task.run()                     -- 执行用户代码
```

---

## 2. 核心类和文件位置

### 2.1 作业提交相关

- **JobSubmitHandler** - `flink-runtime/.../rest/handler/job/JobSubmitHandler.java` - REST API 处理作业提交
- **Dispatcher** - `flink-runtime/.../dispatcher/Dispatcher.java` - 作业提交入口，管理多个作业
- **JobManagerRunner** - `flink-runtime/.../jobmaster/JobManagerRunner.java` - 管理单个作业的生命周期
- **JobMasterServiceLeadershipRunner** - `flink-runtime/.../jobmaster/JobMasterServiceLeadershipRunner.java` - Leader 选举和 JobMaster 创建

### 2.2 调度核心类

- **JobMaster** - `flink-runtime/.../jobmaster/JobMaster.java` - 作业主节点，管理单个作业
- **SchedulerNG** - `flink-runtime/.../scheduler/SchedulerNG.java` - 调度器接口
- **SchedulerBase** - `flink-runtime/.../scheduler/SchedulerBase.java` - 调度器基类
- **DefaultScheduler** - `flink-runtime/.../scheduler/DefaultScheduler.java` - 默认调度器实现

### 2.3 执行图相关类

- **ExecutionGraph** - `flink-runtime/.../executiongraph/ExecutionGraph.java` - 执行图接口
- **DefaultExecutionGraph** - `flink-runtime/.../executiongraph/DefaultExecutionGraph.java` - 执行图实现
- **ExecutionJobVertex** - `flink-runtime/.../executiongraph/ExecutionJobVertex.java` - 对应 JobVertex 的运行时表示
- **ExecutionVertex** - `flink-runtime/.../executiongraph/ExecutionVertex.java` - 单个并行子任务的运行时表示
- **Execution** - `flink-runtime/.../executiongraph/Execution.java` - 一次执行尝试

### 2.4 调度策略和部署类

- **SchedulingStrategy** - `flink-runtime/.../scheduler/strategy/SchedulingStrategy.java` - 调度策略接口
- **PipelinedRegionSchedulingStrategy** - `flink-runtime/.../scheduler/strategy/PipelinedRegionSchedulingStrategy.java` - 流水线区域调度策略
- **ExecutionDeployer** - `flink-runtime/.../scheduler/ExecutionDeployer.java` - 执行部署器接口
- **DefaultExecutionDeployer** - `flink-runtime/.../scheduler/DefaultExecutionDeployer.java` - 默认执行部署器

### 2.5 TaskManager 相关

- **TaskExecutor** - `flink-runtime/.../taskexecutor/TaskExecutor.java` - TaskManager 主类
- **Task** - `flink-runtime/.../taskmanager/Task.java` - 任务执行实例
- **StreamTask** - `flink-streaming-java/.../runtime/tasks/StreamTask.java` - 流式任务执行

---

## 3. 阶段一：Client 提交作业

### 3.1 REST 请求路由机制

Client 提交作业时，HTTP 请求经过以下路由过程到达 Dispatcher：

```
HTTP POST /jobs
    ↓
Netty ChannelPipeline   -- Flink REST Server 基于 Netty 实现
    ↓
RouterHandler           -- 根据 URL 匹配对应的 Handler
    ↓
LeaderRetrievalHandler  -- 获取当前 Leader (DispatcherGateway)
    ↓
AbstractRestHandler     -- 通用 REST 处理逻辑
    ↓
JobSubmitHandler        -- 具体处理作业提交
    ↓
gateway.submitJob()     -- 调用 DispatcherGateway RPC
    ↓
Dispatcher.submitJob()  -- Dispatcher 实现 DispatcherGateway 接口
```

**关键类继承关系：**

```java
JobSubmitHandler
    extends AbstractRestHandler<DispatcherGateway, ...>
        extends AbstractHandler<T, R, M>
            extends LeaderRetrievalHandler<T>
```

**LeaderRetrievalHandler 获取 Dispatcher 的核心逻辑：**

```java
// LeaderRetrievalHandler.java
@Override
protected void channelRead0(ChannelHandlerContext ctx, RoutedRequest routedRequest) {
    // 通过 GatewayRetriever 获取当前 Leader（Dispatcher）
    OptionalConsumer<? extends T> optLeaderConsumer =
            OptionalConsumer.of(leaderRetriever.getNow());
    
    optLeaderConsumer.ifPresent(gateway -> {
        // gateway 就是 DispatcherGateway，指向当前 Leader Dispatcher
        respondAsLeader(ctx, routedRequest, gateway);
    });
}
```

**GatewayRetriever 的作用：**
- `GatewayRetriever<DispatcherGateway>` 负责追踪 Dispatcher Leader
- 当 Dispatcher 发生 Leader 切换时，GatewayRetriever 会自动更新
- 确保 REST 请求总是发送到当前 Leader Dispatcher

### 3.2 REST API 入口 - JobSubmitHandler

```java
// JobSubmitHandler.java
@Override
protected CompletableFuture<JobSubmitResponseBody> handleRequest(
        HandlerRequest<JobSubmitRequestBody> request,
        DispatcherGateway gateway) {  // gateway 由 LeaderRetrievalHandler 传入
    
    // 1. 获取上传的文件
    final Collection<File> uploadedFiles = request.getUploadedFiles();
    
    // 2. 加载 JobGraph（反序列化）
    CompletableFuture<JobGraph> jobGraphFuture = loadJobGraph(requestBody, nameToFile);
    
    // 3. 上传 JAR 文件到 BlobServer
    CompletableFuture<JobGraph> finalizedJobGraphFuture =
            uploadJobGraphFiles(gateway, jobGraphFuture, jarFiles, artifacts, configuration);
    
    // 4. 提交作业到 Dispatcher（RPC 调用）
    CompletableFuture<Acknowledge> jobSubmissionFuture =
            finalizedJobGraphFuture.thenCompose(
                    jobGraph -> gateway.submitJob(jobGraph, timeout));
    
    return jobSubmissionFuture.thenCombine(
            jobGraphFuture,
            (ack, jobGraph) -> new JobSubmitResponseBody("/jobs/" + jobGraph.getJobID()));
}
```

### 3.3 Dispatcher 接收作业

```java
// Dispatcher.java
@Override
public CompletableFuture<Acknowledge> submitJob(JobGraph jobGraph, Time timeout) {
    final JobID jobID = jobGraph.getJobID();
    
    log.info("Received JobGraph submission '{}' ({}).", jobGraph.getName(), jobID);
    
    // 检查作业是否已存在
    if (jobManagerRunnerRegistry.isRegistered(jobID)) {
        return FutureUtils.completedExceptionally(
                DuplicateJobSubmissionException.of(jobID));
    }
    
    // 内部提交作业
    return internalSubmitJob(jobGraph);
}

private CompletableFuture<Acknowledge> internalSubmitJob(JobGraph jobGraph) {
    log.info("Submitting job '{}' ({}).", jobGraph.getName(), jobGraph.getJobID());
    
    // 持久化并运行作业
    return waitForTerminatingJob(jobGraph.getJobID(), jobGraph, this::persistAndRunJob)
            .handle((ignored, throwable) -> handleTermination(jobGraph.getJobID(), throwable))
            .thenCompose(Function.identity());
}
```

### 3.4 启动 JobManagerRunner

```java
// Dispatcher.java
private void runJob(JobManagerRunner jobManagerRunner, ExecutionType executionType) {
    // 1. 启动 JobManagerRunner
    jobManagerRunner.start();
    jobManagerRunnerRegistry.register(jobManagerRunner);
    
    // 2. 监听作业完成（异步）
    final CompletableFuture<CleanupJobState> cleanupJobStateFuture =
        jobManagerRunner.getResultFuture()
            .handleAsync((result, throwable) -> {
                if (result != null) {
                    return handleJobManagerRunnerResult(result, executionType);
                } else {
                    return CompletableFuture.completedFuture(
                        jobManagerRunnerFailed(jobId, JobStatus.FAILED, throwable));
                }
            }, getMainThreadExecutor())
            .thenCompose(Function.identity());
    
    // 3. 清理作业
    cleanupJobStateFuture.thenCompose(
        cleanupJobState -> removeJob(jobId, cleanupJobState));
}
```

---

## 4. 阶段二：Leader 选举和 JobMaster 创建

### 4.1 JobMasterServiceLeadershipRunner 启动

```java
// JobMasterServiceLeadershipRunner.java
@Override
public void start() throws Exception {
    LOG.debug("Start leadership runner for job {}.", getJobID());
    // 启动 Leader 选举
    leaderElection.startLeaderElection(this);
}
```

### 4.2 获得 Leadership

```java
// JobMasterServiceLeadershipRunner.java
@Override
public void grantLeadership(UUID leaderSessionID) {
    runIfStateRunning(
        () -> startJobMasterServiceProcessAsync(leaderSessionID),
        "starting a new JobMasterServiceProcess");
}

private void createNewJobMasterServiceProcess(UUID leaderSessionId) {
    LOG.info("Creating new JobMasterServiceProcess for job {}", getJobID());
    
    // 创建 JobMasterServiceProcess（内部会创建 JobMaster）
    jobMasterServiceProcess = jobMasterServiceProcessFactory.create(leaderSessionId);
}
```

### 4.3 创建 JobMaster

```java
// DefaultJobMasterServiceProcess.java
public DefaultJobMasterServiceProcess(...) {
    // 异步创建 JobMasterService（即 JobMaster）
    this.jobMasterServiceFuture =
        jobMasterServiceFactory.createJobMasterService(leaderSessionId, this);
    
    jobMasterServiceFuture.whenComplete((jobMasterService, throwable) -> {
        if (throwable != null) {
            resultFuture.complete(
                JobManagerRunnerResult.forInitializationFailure(...));
        } else {
            registerJobMasterServiceFutures(jobMasterService);
        }
    });
}
```

---

## 5. 阶段三：JobMaster 启动和调度器初始化

### 5.1 JobMaster 构造函数

```java
// JobMaster.java
public JobMaster(...) throws Exception {
    // ... 初始化各种服务 ...
    
    // 创建调度器（核心！）
    this.schedulerNG = createScheduler(
            slotPoolServiceSchedulerFactory,
            executionDeploymentTracker,
            jobManagerJobMetricGroup,
            jobStatusListener);
}
```

### 5.2 JobMaster 启动

```java
// JobMaster.java
@Override
protected void onStart() throws Exception {
    try {
        startJobExecution();
    } catch (Exception e) {
        handleJobMasterError(e);
    }
}

private void startJobExecution() throws Exception {
    // 1. 验证 JobMaster 正在运行
    validateRunsInMainThread();
    
    // 2. 启动 JobMaster 服务
    startJobMasterServices();
    
    // 3. 重连 ResourceManager
    reconnectToResourceManager(
            new FlinkException("Starting JobMaster component."));
    
    // 4. 开始调度！
    startScheduling();
}
```

---

## 6. 阶段四：JobGraph 转换为 ExecutionGraph

### 6.1 转换时机

在 `SchedulerBase` 构造函数中，JobGraph 被转换为 ExecutionGraph：

```java
// SchedulerBase.java
public SchedulerBase(...) throws Exception {
    // 创建并恢复 ExecutionGraph
    this.executionGraph = createAndRestoreExecutionGraph(
            completedCheckpointStore,
            checkpointsCleaner,
            checkpointIdCounter,
            initializationTimestamp,
            mainThreadExecutor,
            jobStatusListener,
            vertexParallelismStore);
}
```

### 6.2 ExecutionGraph 构建

```java
// DefaultExecutionGraphBuilder.java
public static DefaultExecutionGraph buildGraph(
        JobGraph jobGraph, ...) {
    
    // 1. 创建 JobInformation
    final JobInformation jobInformation = new JobInformation(...);
    
    // 2. 创建 ExecutionGraph 实例
    final DefaultExecutionGraph executionGraph = new DefaultExecutionGraph(...);
    
    // 3. 初始化各个 JobVertex
    for (JobVertex vertex : jobGraph.getVertices()) {
        vertex.initializeOnMaster(...);
    }
    
    // 4. 将 JobGraph 的顶点附加到 ExecutionGraph
    executionGraph.attachJobGraph(sortedTopology);
    
    return executionGraph;
}
```

### 6.3 数据结构转换关系

```
JobGraph (用户提交)              ExecutionGraph (运行时)
─────────────────              ────────────────────

JobVertex                ──►   ExecutionJobVertex
  │                            │
  ├── parallelism = 4          ├── ExecutionVertex[0] → Execution
  │                            ├── ExecutionVertex[1] → Execution
  │                            ├── ExecutionVertex[2] → Execution
  │                            └── ExecutionVertex[3] → Execution
  │
JobEdge (数据交换)       ──►   IntermediateResult
                              └── IntermediateResultPartition[]
```

---

## 7. 阶段五：调度器启动调度

### 7.1 触发调度

```java
// JobMaster.java
private void startScheduling() {
    schedulerNG.startScheduling();
}
```

### 7.2 SchedulerBase.startScheduling()

```java
// SchedulerBase.java
@Override
public final void startScheduling() {
    mainThreadExecutor.assertRunningInMainThread();
    
    // 1. 注册作业指标
    registerJobMetrics(...);
    
    // 2. 启动所有 Operator Coordinator
    operatorCoordinatorHandler.startAllOperatorCoordinators();
    
    // 3. 调用子类实现的调度方法
    startSchedulingInternal();
}
```

### 7.3 DefaultScheduler.startSchedulingInternal()

```java
// DefaultScheduler.java
@Override
protected void startSchedulingInternal() {
    log.info("Starting scheduling with scheduling strategy [{}]",
            schedulingStrategy.getClass().getName());
    
    // 1. 将 ExecutionGraph 状态转换为 RUNNING
    transitionToRunning();
    
    // 2. 调用调度策略开始调度
    schedulingStrategy.startScheduling();
}
```

---

## 8. 阶段六：调度策略决定调度顺序

### 8.1 PipelinedRegionSchedulingStrategy

这是 Flink 默认的调度策略，基于流水线区域（Pipelined Region）进行调度。

```java
// PipelinedRegionSchedulingStrategy.java
@Override
public void startScheduling() {
    // 1. 找出所有源头区域
    final Set<SchedulingPipelinedRegion> sourceRegions =
            IterableUtils.toStream(schedulingTopology.getAllPipelinedRegions())
                    .filter(this::isSourceRegion)
                    .collect(Collectors.toSet());
    
    // 2. 调度这些源头区域
    maybeScheduleRegions(sourceRegions);
}
```

### 8.2 ScheduleRegion

```java
// PipelinedRegionSchedulingStrategy.java
private void scheduleRegion(final SchedulingPipelinedRegion region) {
    // 1. 检查区域内所有顶点都处于 CREATED 状态
    checkState(areRegionVerticesAllInCreatedState(region));
    
    // 2. 标记区域已调度
    scheduledRegions.add(region);
    
    // 3. 调用 SchedulerOperations 分配 Slot 并部署
    schedulerOperations.allocateSlotsAndDeploy(
            regionVerticesSorted.get(region));
}
```

---

## 9. 阶段七：Slot 分配和任务部署

### 9.1 DefaultScheduler.allocateSlotsAndDeploy()

```java
// DefaultScheduler.java
@Override
public void allocateSlotsAndDeploy(final List<ExecutionVertexID> verticesToDeploy) {
    // 1. 记录顶点版本
    final Map<ExecutionVertexID, ExecutionVertexVersion> requiredVersionByVertex =
            executionVertexVersioner.recordVertexModifications(verticesToDeploy);
    
    // 2. 获取需要部署的 Execution 列表
    final List<Execution> executionsToDeploy =
            verticesToDeploy.stream()
                    .map(this::getCurrentExecutionOfVertex)
                    .collect(Collectors.toList());
    
    // 3. 调用 ExecutionDeployer 进行部署
    executionDeployer.allocateSlotsAndDeploy(executionsToDeploy, requiredVersionByVertex);
}
```

### 9.2 DefaultExecutionDeployer.allocateSlotsAndDeploy()

```java
// DefaultExecutionDeployer.java
@Override
public void allocateSlotsAndDeploy(
        final List<Execution> executionsToDeploy,
        final Map<ExecutionVertexID, ExecutionVertexVersion> requiredVersionByVertex) {
    
    // 1. 验证执行状态
    validateExecutionStates(executionsToDeploy);
    
    // 2. 状态转换：CREATED -> SCHEDULED
    transitionToScheduled(executionsToDeploy);
    
    // 3. 为每个 Execution 分配 Slot
    final Map<ExecutionAttemptID, ExecutionSlotAssignment> executionSlotAssignmentMap =
            allocateSlotsFor(executionsToDeploy);
    
    // 4. 创建部署句柄
    final List<ExecutionDeploymentHandle> deploymentHandles =
            createDeploymentHandles(...);
    
    // 5. 等待所有 Slot 分配完成，然后部署
    waitForAllSlotsAndDeploy(deploymentHandles);
}
```

### 9.3 Execution.deploy() - 核心部署方法

```java
// Execution.java
public void deploy() throws JobException {
    // 1. 获取分配的 Slot
    final LogicalSlot slot = assignedResource;
    
    // 2. 状态转换：SCHEDULED -> DEPLOYING
    if (!transitionState(previous, DEPLOYING)) {
        throw new IllegalStateException("Cannot deploy task");
    }
    
    // 3. 创建 TaskDeploymentDescriptor
    final TaskDeploymentDescriptor deployment =
            vertex.getExecutionGraphAccessor()
                    .getTaskDeploymentDescriptorFactory()
                    .createDeploymentDescriptor(...);
    
    // 4. 获取 TaskManagerGateway
    final TaskManagerGateway taskManagerGateway = slot.getTaskManagerGateway();
    
    // 5. 异步提交任务到 TaskManager
    CompletableFuture.supplyAsync(
            () -> taskManagerGateway.submitTask(deployment, rpcTimeout),
            executor)
        .thenCompose(Function.identity())
        .whenCompleteAsync((ack, failure) -> {
            if (failure == null) {
                vertex.notifyCompletedDeployment(this);
            } else {
                markFailed(failure);
            }
        }, jobMasterMainThreadExecutor);
}
```

---

## 10. 阶段八：TaskManager 执行任务

### 10.0 RPC 调用链：TaskManagerGateway 到 TaskExecutor

在 `Execution.deploy()` 中调用 `taskManagerGateway.submitTask()`，这里的 RPC 调用链如下：

```
taskManagerGateway.submitTask(deployment, rpcTimeout)
    ↓
RpcTaskManagerGateway.submitTask() -- TaskManagerGateway 的实现类
    ↓
taskExecutorGateway.submitTask()   -- TaskExecutorGateway RPC 代理
    ↓
[Akka/Pekko RPC 网络传输]           -- 跨进程 RPC 调用
    ↓
TaskExecutor.submitTask()          -- TaskExecutor 实现 TaskExecutorGateway
```

**关键类关系：**

```
TaskManagerGateway (接口)        -- JobMaster 侧的抽象
    ↓ 实现
RpcTaskManagerGateway           -- 持有 TaskExecutorGateway 引用
    ↓ 委托
TaskExecutorGateway (RPC 接口)   -- Flink RPC 定义的远程接口
    ↓ 实现
TaskExecutor                    -- TaskManager 主类，实现 TaskExecutorGateway
```

**RpcTaskManagerGateway 核心代码：**

```java
// RpcTaskManagerGateway.java
public class RpcTaskManagerGateway implements TaskManagerGateway {
    
    private final TaskExecutorGateway taskExecutorGateway;  // RPC 代理
    private final JobMasterId jobMasterId;
    
    @Override
    public CompletableFuture<Acknowledge> submitTask(TaskDeploymentDescriptor tdd, Time timeout) {
        // 委托给 TaskExecutorGateway，这是一个 RPC 调用
        return taskExecutorGateway.submitTask(tdd, jobMasterId, timeout);
    }
}
```

### 10.1 TaskExecutor.submitTask()

```java
// TaskExecutor.java
@Override
public CompletableFuture<Acknowledge> submitTask(
        TaskDeploymentDescriptor tdd, JobMasterId jobMasterId, Time timeout) {
    
    // 1. 创建 Task 对象
    final Task task = new Task(
            tdd,
            memoryManager,
            ioManager,
            networkEnvironment,
            ...);
    
    // 2. 注册 Task
    taskSlotTable.addTask(task);
    
    // 3. 启动 Task 执行线程
    task.startTaskThread();
    
    return CompletableFuture.completedFuture(Acknowledge.get());
}
```

### 10.2 Task.run()

```java
// Task.java
@Override
public void run() {
    try {
        // 1. 切换状态：DEPLOYING -> RUNNING
        transitionState(ExecutionState.DEPLOYING, ExecutionState.RUNNING);
        
        // 2. 初始化任务
        invokable = loadAndInstantiateInvokable(
                userCodeClassLoader, nameOfInvokableClass);
        
        // 3. 执行任务（调用用户代码）
        invokable.invoke();  // ← 用户代码在这里执行！
        
        // 4. 任务完成
        transitionState(ExecutionState.RUNNING, ExecutionState.FINISHED);
        
    } catch (Throwable t) {
        transitionState(ExecutionState.RUNNING, ExecutionState.FAILED);
    }
}
```

---

## 11. Task 状态流转

### 11.1 ExecutionState 枚举

```java
// ExecutionState.java
public enum ExecutionState {
    CREATED,       // 初始状态
    SCHEDULED,     // 已调度，等待 Slot
    DEPLOYING,     // 正在部署到 TaskManager
    INITIALIZING,  // 正在初始化
    RUNNING,       // 运行中
    FINISHED,      // 成功完成
    CANCELING,     // 正在取消
    CANCELED,      // 已取消
    FAILED,        // 失败
    RECONCILING;   // 协调中
}
```

### 11.2 状态转换图

```
CREATED                  -- 初始状态
    ↓ allocateSlotsAndDeploy()
SCHEDULED                -- 已调度，等待 Slot
    ↓ Execution.deploy()
DEPLOYING                -- 正在部署到 TaskManager
    ↓
INITIALIZING             -- Task 在 TaskManager 上初始化
    ↓
RUNNING                  -- Task 开始处理数据
    ↓
    ├──→ FINISHED        -- 成功完成
    ├──→ CANCELING       -- 取消中
    │       ↓
    │    CANCELED        -- 已取消
    └──→ FAILED          -- 失败
```

---

## 12. 完整调用链

```
Client 提交作业
    ↓
JobSubmitHandler.handleRequest()   -- REST API 入口
    ↓
Dispatcher.submitJob()             -- 作业提交入口
    ↓
Dispatcher.runJob()                -- 启动 JobManagerRunner
    ↓
JobMasterServiceLeadershipRunner
  .start()                         -- 启动 Leader 选举
    ↓
grantLeadership()                  -- 获得 Leadership
    ↓
JobMasterServiceProcess.create()   -- 创建 JobMaster
    ↓
JobMaster.onStart()                -- JobMaster 启动
    ↓
startJobExecution()                -- 启动作业执行
    ↓
startScheduling()                  -- 触发调度
    ↓
SchedulerBase.startScheduling()    -- 注册指标，启动 Coordinator
    ↓
DefaultScheduler
  .startSchedulingInternal()       -- ExecutionGraph → RUNNING
    ↓
PipelinedRegionSchedulingStrategy
  .startScheduling()               -- 识别源头区域
    ↓
scheduleRegion()                   -- 调度单个区域
    ↓
DefaultScheduler
  .allocateSlotsAndDeploy()        -- 获取 Execution 列表
    ↓
DefaultExecutionDeployer
  .allocateSlotsAndDeploy()        -- CREATED → SCHEDULED，分配 Slot
    ↓
waitForAllSlotsAndDeploy()         -- 异步等待 Slot 分配完成
    ↓
deployAll()                        -- 遍历所有 DeploymentHandle
    ↓
Execution.deploy()                 -- SCHEDULED → DEPLOYING，创建 TDD
    ↓
taskManagerGateway.submitTask()    -- RPC 调用
    ↓
TaskExecutor.submitTask()          -- 创建 Task
    ↓
Task.startTaskThread()             -- 启动任务线程
    ↓
Task.run() → invokable.invoke()    -- 执行用户代码
```

---

## 13. 关键接口和实现

### 13.1 类图关系

```
Dispatcher                   -- 作业提交入口
    ↓
JobManagerRunner             → JobMasterServiceLeadershipRunner
    ↓
JobMasterServiceProcess      → DefaultJobMasterServiceProcess
    ↓
JobMaster                    -- RpcEndpoint
    ↓
SchedulerNG                  -- 接口
    ↓
SchedulerBase                -- 抽象类
    ↓
DefaultScheduler
    ├── SchedulingStrategy   → PipelinedRegionSchedulingStrategy
    ├── ExecutionDeployer    → DefaultExecutionDeployer
    └── ExecutionGraph
            ├── ExecutionJobVertex → ExecutionVertex → Execution
            └── IntermediateResult
```

### 13.2 组件职责

- **Dispatcher** - 接收作业提交，管理多个 JobManagerRunner（集群级别）
- **JobManagerRunner** - 管理单个作业的生命周期，Leader 选举（作业级别）
- **JobMaster** - 管理单个作业的调度、执行、容错（作业级别）
- **Scheduler** - 调度任务，管理 ExecutionGraph（作业级别）
- **TaskExecutor** - 执行具体任务（集群级别）

---

## 14. 调试指南

### 14.1 关键断点位置

- **作业提交** - `JobSubmitHandler.handleRequest()` - REST API 入口
- **作业提交** - `Dispatcher.submitJob()` - 核心提交逻辑
- **Leader 选举** - `JobMasterServiceLeadershipRunner.grantLeadership()` - 获得 Leadership
- **JobMaster 启动** - `JobMaster.onStart()` - JobMaster 启动回调
- **调度启动** - `JobMaster.startScheduling()` - 调度入口
- **调度策略** - `PipelinedRegionSchedulingStrategy.startScheduling()` - 调度策略启动
- **Slot 分配** - `DefaultExecutionDeployer.allocateSlotsAndDeploy()` - 分配 Slot 并部署
- **任务部署** - `Execution.deploy()` - 部署单个任务
- **TaskManager** - `TaskExecutor.submitTask()` - TaskManager 接收任务
- **任务执行** - `Task.run()` - 任务执行主循环 |

### 14.2 关键日志

```
# 作业提交
"Received JobGraph submission '{}' ({})."
"Submitting job '{}' ({})."

# 调度开始
"Starting scheduling with scheduling strategy [{}]"

# 区域调度
"Scheduling pipelined region"

# Slot 分配
"Allocating slot for execution"

# 任务部署
"Deploying {} to {}"
```

---

*本文档基于 Flink 1.19 源码分析编写*