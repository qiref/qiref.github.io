---
title: "Flink源码-CompletableFuture异步编程"
date: 2025-12-25T12:05:41+08:00
toc: true
tags:
  - Flink
---

## 1. 基础概念

### 1.1 什么是 CompletableFuture

`CompletableFuture` 是 Java 8 引入的异步编程工具，它代表一个可能尚未完成的异步计算结果。与传统的 `Future` 相比，它支持：

- **非阻塞回调**：不需要调用 `get()` 阻塞等待
- **链式操作**：可以将多个异步操作串联起来
- **组合操作**：可以组合多个异步操作的结果
- **异常处理**：提供优雅的异常处理机制

### 1.2 同步 vs 异步对比

```java
// ==================== 同步方式 - 阻塞等待 ====================
public String processSync() {
    String result1 = step1();           // 阻塞 2 秒
    String result2 = step2(result1);    // 阻塞 2 秒
    String result3 = step3(result2);    // 阻塞 2 秒
    return result3;                     // 总耗时: 6 秒
}

// ==================== 异步方式 - 非阻塞 ====================
public CompletableFuture<String> processAsync() {
    return CompletableFuture
        .supplyAsync(() -> step1())              // 异步执行
        .thenApplyAsync(result1 -> step2(result1))  // 链式处理
        .thenApplyAsync(result2 -> step3(result2)); // 继续链式
    // 主线程立即返回，不阻塞
}
```

### 1.3 核心接口关系

```
                    ┌─────────────────┐
                    │     Future      │
                    └────────┬────────┘
                             │
              ┌──────────────┴─────────────┐
              │                            │
    ┌─────────┴─────────┐       ┌──────────┴──────────┐
    │  CompletionStage  │       │   CompletableFuture │
    │   (接口)           │◄------│   (实现类)           │
    └───────────────────┘       └─────────────────────┘
```

---

## 2. 创建 CompletableFuture

### 2.1 已完成的 Future

```java
// 创建一个已经完成的 Future（成功）
CompletableFuture<String> completed = CompletableFuture.completedFuture("result");
System.out.println(completed.isDone());  // true
System.out.println(completed.get());     // "result"

// 创建一个已经完成的 Future（失败）- Java 9+
CompletableFuture<String> failed = CompletableFuture.failedFuture(
    new RuntimeException("error"));

// Java 8 兼容写法
CompletableFuture<String> failedJava8 = new CompletableFuture<>();
failedJava8.completeExceptionally(new RuntimeException("error"));
```

### 2.2 异步执行有返回值的任务 - supplyAsync

```java
// 使用默认线程池（ForkJoinPool.commonPool()）
CompletableFuture<String> future1 = CompletableFuture.supplyAsync(() -> {
    System.out.println("执行线程: " + Thread.currentThread().getName());
    // 模拟耗时操作
    try {
        Thread.sleep(1000);
    } catch (InterruptedException e) {
        Thread.currentThread().interrupt();
    }
    return "async result";
});

// 使用自定义线程池
ExecutorService executor = Executors.newFixedThreadPool(4);
CompletableFuture<String> future2 = CompletableFuture.supplyAsync(() -> {
    return "custom executor result";
}, executor);
```

### 2.3 异步执行无返回值的任务 - runAsync

```java
// 无返回值的异步任务
CompletableFuture<Void> future = CompletableFuture.runAsync(() -> {
    System.out.println("执行异步任务，线程: " + Thread.currentThread().getName());
    // 执行一些操作，没有返回值
    doSomething();
});

// 等待完成
future.join();
```

### 2.4 手动创建并控制完成

```java
// 手动创建 CompletableFuture
CompletableFuture<String> manualFuture = new CompletableFuture<>();

// 在另一个线程中完成它
new Thread(() -> {
    try {
        Thread.sleep(2000);
        // 正常完成
        manualFuture.complete("manual result");
        
        // 或者异常完成
        // manualFuture.completeExceptionally(new RuntimeException("error"));
    } catch (InterruptedException e) {
        manualFuture.completeExceptionally(e);
    }
}).start();

// 主线程可以等待结果
String result = manualFuture.get();  // 阻塞等待
```

---

## 3. 链式处理

### 3.1 thenApply - 转换结果（同步）

```java
// thenApply: 对结果进行同步转换
// Function<T, U>: 接收 T 类型，返回 U 类型
CompletableFuture<String> future = CompletableFuture
    .supplyAsync(() -> 42)                          // Integer
    .thenApply(num -> num * 2)                      // Integer -> Integer
    .thenApply(num -> "Result: " + num);            // Integer -> String

System.out.println(future.get());  // "Result: 84"
```

### 3.2 thenApplyAsync - 转换结果（异步）

```java
// thenApplyAsync: 在异步线程中执行转换
ExecutorService executor = Executors.newFixedThreadPool(2);

CompletableFuture<String> future = CompletableFuture
    .supplyAsync(() -> {
        System.out.println("Step 1: " + Thread.currentThread().getName());
        return 42;
    })
    .thenApplyAsync(num -> {
        System.out.println("Step 2: " + Thread.currentThread().getName());
        return num * 2;
    }, executor)  // 使用自定义线程池
    .thenApplyAsync(num -> {
        System.out.println("Step 3: " + Thread.currentThread().getName());
        return "Result: " + num;
    });  // 使用默认线程池

executor.shutdown();
```

### 3.3 thenAccept - 消费结果（无返回值）

```java
// thenAccept: 消费结果，不返回新值
// Consumer<T>: 接收 T 类型，无返回值
CompletableFuture<Void> future = CompletableFuture
    .supplyAsync(() -> "Hello")
    .thenApply(s -> s + " World")
    .thenAccept(result -> {
        System.out.println("最终结果: " + result);
        // 可以在这里保存到数据库、发送通知等
    });

future.join();  // 等待完成
```

### 3.4 thenRun - 执行后续操作（不关心结果）

```java
// thenRun: 不关心前一步的结果，只是在完成后执行某些操作
// Runnable: 无参数，无返回值
CompletableFuture<Void> future = CompletableFuture
    .supplyAsync(() -> {
        System.out.println("执行主要任务");
        return "result";
    })
    .thenRun(() -> {
        System.out.println("任务完成，执行清理操作");
        // 清理资源、记录日志等
    });
```

### 3.5 thenCompose - 扁平化嵌套 Future（重要！）

```java
// 问题：thenApply 会产生嵌套的 CompletableFuture
CompletableFuture<CompletableFuture<String>> nested = CompletableFuture
    .supplyAsync(() -> "input")
    .thenApply(input -> asyncProcess(input));  // 返回 CompletableFuture<String>

// 解决：使用 thenCompose 扁平化
CompletableFuture<String> flattened = CompletableFuture
    .supplyAsync(() -> "input")
    .thenCompose(input -> asyncProcess(input));  // 自动扁平化

// 辅助方法
private CompletableFuture<String> asyncProcess(String input) {
    return CompletableFuture.supplyAsync(() -> "processed: " + input);
}
```

### 3.6 thenCompose vs thenApply

```java
// ==================== thenApply ====================
// 用于同步转换，lambda 返回普通值
CompletableFuture<String> f1 = CompletableFuture
    .supplyAsync(() -> 1)
    .thenApply(n -> "Number: " + n);  // 返回 String

// ==================== thenCompose ====================
// 用于异步转换，lambda 返回 CompletableFuture
CompletableFuture<String> f2 = CompletableFuture
    .supplyAsync(() -> 1)
    .thenCompose(n -> CompletableFuture.supplyAsync(() -> "Number: " + n));

// 类比 Stream API:
// thenApply  ≈ map()
// thenCompose ≈ flatMap()
```

### 3.7 Function.identity() 模式

```java
// 这是 Flink 中常见的模式
// 当 handleAsync 返回 CompletableFuture 时，需要扁平化

CompletableFuture<String> result = CompletableFuture
    .supplyAsync(() -> "input")
    .handleAsync((value, throwable) -> {
        if (throwable != null) {
            return CompletableFuture.completedFuture("error fallback");
        }
        return asyncProcess(value);  // 返回 CompletableFuture<String>
    })
    // handleAsync 返回 CompletableFuture<CompletableFuture<String>>
    // 使用 thenCompose(Function.identity()) 扁平化
    .thenCompose(Function.identity());  // 等价于 .thenCompose(f -> f)
```

---

## 4. 异常处理

### 4.1 exceptionally - 异常恢复

```java
// exceptionally: 只处理异常情况，正常情况直接传递
CompletableFuture<String> future = CompletableFuture
    .supplyAsync(() -> {
        if (Math.random() > 0.5) {
            throw new RuntimeException("Random error");
        }
        return "success";
    })
    .exceptionally(throwable -> {
        System.err.println("发生异常: " + throwable.getMessage());
        return "default value";  // 返回默认值
    });

System.out.println(future.get());  // "success" 或 "default value"
```

### 4.2 handle - 统一处理结果和异常

```java
// handle: 同时处理正常结果和异常
// BiFunction<T, Throwable, U>: 接收结果和异常，返回新值
CompletableFuture<String> future = CompletableFuture
    .supplyAsync(() -> {
        if (Math.random() > 0.5) {
            throw new RuntimeException("Random error");
        }
        return "success";
    })
    .handle((result, throwable) -> {
        if (throwable != null) {
            // 异常情况
            System.err.println("异常: " + throwable.getMessage());
            return "error: " + throwable.getMessage();
        }
        // 正常情况
        return "result: " + result;
    });
```

### 4.3 handleAsync - 异步处理结果和异常

```java
ExecutorService executor = Executors.newFixedThreadPool(2);

CompletableFuture<String> future = CompletableFuture
    .supplyAsync(() -> {
        System.out.println("主任务线程: " + Thread.currentThread().getName());
        return "data";
    })
    .handleAsync((result, throwable) -> {
        System.out.println("处理线程: " + Thread.currentThread().getName());
        if (throwable != null) {
            return "error";
        }
        return "processed: " + result;
    }, executor);  // 在指定线程池中执行

executor.shutdown();
```

### 4.4 whenComplete - 观察结果（不改变结果）

```java
// whenComplete: 观察结果和异常，但不改变它们
// BiConsumer<T, Throwable>: 接收结果和异常，无返回值
CompletableFuture<String> future = CompletableFuture
    .supplyAsync(() -> "result")
    .whenComplete((result, throwable) -> {
        if (throwable != null) {
            System.err.println("任务失败: " + throwable.getMessage());
        } else {
            System.out.println("任务成功: " + result);
        }
        // 注意：这里不能改变结果
    });

// whenComplete 返回的 Future 包含原始结果
System.out.println(future.get());  // "result"
```

### 4.5 异常处理链

```java
CompletableFuture<String> future = CompletableFuture
    .supplyAsync(() -> {
        throw new RuntimeException("Step 1 error");
    })
    .thenApply(result -> {
        System.out.println("Step 2");  // 不会执行
        return result + " step2";
    })
    .thenApply(result -> {
        System.out.println("Step 3");  // 不会执行
        return result + " step3";
    })
    .exceptionally(throwable -> {
        // 捕获之前所有步骤的异常
        System.err.println("捕获异常: " + throwable.getMessage());
        return "recovered";
    })
    .thenApply(result -> {
        System.out.println("Step 4: " + result);  // 会执行
        return result + " step4";
    });

System.out.println(future.get());  // "recovered step4"
```

### 4.6 异常类型处理

```java
CompletableFuture<String> future = CompletableFuture
    .supplyAsync(() -> {
        throw new IllegalArgumentException("Invalid argument");
    })
    .handle((result, throwable) -> {
        if (throwable != null) {
            // 获取真正的异常（去除 CompletionException 包装）
            Throwable cause = throwable.getCause();
            if (cause == null) {
                cause = throwable;
            }
            
            if (cause instanceof IllegalArgumentException) {
                return "参数错误: " + cause.getMessage();
            } else if (cause instanceof IOException) {
                return "IO错误: " + cause.getMessage();
            } else {
                return "未知错误: " + cause.getMessage();
            }
        }
        return result;
    });
```

---

## 5. 组合多个异步操作

### 5.1 thenCombine - 合并两个 Future 的结果

```java
// thenCombine: 等待两个 Future 都完成，然后合并结果
CompletableFuture<String> future1 = CompletableFuture.supplyAsync(() -> {
    sleep(1000);
    return "Hello";
});

CompletableFuture<String> future2 = CompletableFuture.supplyAsync(() -> {
    sleep(1500);
    return "World";
});

CompletableFuture<String> combined = future1.thenCombine(future2, (s1, s2) -> {
    return s1 + " " + s2;
});

System.out.println(combined.get());  // "Hello World"（约 1.5 秒后）
```

### 5.2 thenAcceptBoth - 消费两个 Future 的结果

```java
// thenAcceptBoth: 类似 thenCombine，但没有返回值
CompletableFuture<String> future1 = CompletableFuture.supplyAsync(() -> "User");
CompletableFuture<Integer> future2 = CompletableFuture.supplyAsync(() -> 25);

CompletableFuture<Void> result = future1.thenAcceptBoth(future2, (name, age) -> {
    System.out.println(name + " is " + age + " years old");
});

result.join();
```

### 5.3 runAfterBoth - 两个都完成后执行

```java
// runAfterBoth: 两个 Future 都完成后执行操作，不关心结果
CompletableFuture<String> future1 = CompletableFuture.supplyAsync(() -> "task1");
CompletableFuture<String> future2 = CompletableFuture.supplyAsync(() -> "task2");

CompletableFuture<Void> result = future1.runAfterBoth(future2, () -> {
    System.out.println("两个任务都完成了");
});
```

### 5.4 applyToEither - 任一完成即处理

```java
// applyToEither: 哪个先完成就用哪个的结果
CompletableFuture<String> future1 = CompletableFuture.supplyAsync(() -> {
    sleep(2000);
    return "slow result";
});

CompletableFuture<String> future2 = CompletableFuture.supplyAsync(() -> {
    sleep(1000);
    return "fast result";
});

CompletableFuture<String> result = future1.applyToEither(future2, s -> {
    return "Winner: " + s;
});

System.out.println(result.get());  // "Winner: fast result"
```

### 5.5 acceptEither - 任一完成即消费

```java
// acceptEither: 哪个先完成就消费哪个的结果
CompletableFuture<String> future1 = CompletableFuture.supplyAsync(() -> {
    sleep(2000);
    return "slow";
});

CompletableFuture<String> future2 = CompletableFuture.supplyAsync(() -> {
    sleep(1000);
    return "fast";
});

future1.acceptEither(future2, result -> {
    System.out.println("First completed: " + result);
});
```

### 5.6 allOf - 等待所有完成

```java
// allOf: 等待所有 Future 完成
CompletableFuture<String> f1 = CompletableFuture.supplyAsync(() -> "Result1");
CompletableFuture<String> f2 = CompletableFuture.supplyAsync(() -> "Result2");
CompletableFuture<String> f3 = CompletableFuture.supplyAsync(() -> "Result3");

// allOf 返回 CompletableFuture<Void>
CompletableFuture<Void> allFuture = CompletableFuture.allOf(f1, f2, f3);

// 等待所有完成后，收集结果
CompletableFuture<List<String>> resultsFuture = allFuture.thenApply(v -> {
    return Stream.of(f1, f2, f3)
        .map(CompletableFuture::join)
        .collect(Collectors.toList());
});

List<String> results = resultsFuture.get();
System.out.println(results);  // [Result1, Result2, Result3]
```

### 5.7 anyOf - 任一完成即返回

```java
// anyOf: 任一 Future 完成就返回
CompletableFuture<String> f1 = CompletableFuture.supplyAsync(() -> {
    sleep(3000);
    return "slow";
});

CompletableFuture<String> f2 = CompletableFuture.supplyAsync(() -> {
    sleep(1000);
    return "fast";
});

CompletableFuture<String> f3 = CompletableFuture.supplyAsync(() -> {
    sleep(2000);
    return "medium";
});

// anyOf 返回 CompletableFuture<Object>
CompletableFuture<Object> anyFuture = CompletableFuture.anyOf(f1, f2, f3);

System.out.println(anyFuture.get());  // "fast"
```

### 5.8 批量处理模式

```java
// 批量处理多个异步任务
public <T> CompletableFuture<List<T>> sequence(List<CompletableFuture<T>> futures) {
    return CompletableFuture
        .allOf(futures.toArray(new CompletableFuture[0]))
        .thenApply(v -> futures.stream()
            .map(CompletableFuture::join)
            .collect(Collectors.toList()));
}

// 使用示例
List<CompletableFuture<String>> futures = Arrays.asList(
    CompletableFuture.supplyAsync(() -> "A"),
    CompletableFuture.supplyAsync(() -> "B"),
    CompletableFuture.supplyAsync(() -> "C")
);

CompletableFuture<List<String>> resultFuture = sequence(futures);
List<String> results = resultFuture.get();  // [A, B, C]
```

---

## 6. 结合线程池

### 6.1 默认线程池

```java
// 默认使用 ForkJoinPool.commonPool()
CompletableFuture<String> future = CompletableFuture.supplyAsync(() -> {
    System.out.println("线程: " + Thread.currentThread().getName());
    // 输出类似: ForkJoinPool.commonPool-worker-1
    return "result";
});
```

### 6.2 自定义线程池

```java
// 创建自定义线程池
ExecutorService customExecutor = Executors.newFixedThreadPool(4, r -> {
    Thread t = new Thread(r);
    t.setName("custom-thread-" + t.getId());
    t.setDaemon(true);
    return t;
});

// 使用自定义线程池
CompletableFuture<String> future = CompletableFuture.supplyAsync(() -> {
    System.out.println("线程: " + Thread.currentThread().getName());
    return "result";
}, customExecutor);

// 链式操作也可以指定线程池
CompletableFuture<String> result = future
    .thenApplyAsync(s -> s.toUpperCase(), customExecutor)
    .thenApplyAsync(s -> s + "!", customExecutor);

// 记得关闭线程池
customExecutor.shutdown();
```

### 6.3 不同类型的线程池

```java
// 1. 固定大小线程池 - 适合 CPU 密集型任务
ExecutorService fixedPool = Executors.newFixedThreadPool(
    Runtime.getRuntime().availableProcessors());

// 2. 缓存线程池 - 适合短期异步任务
ExecutorService cachedPool = Executors.newCachedThreadPool();

// 3. 单线程池 - 保证顺序执行
ExecutorService singlePool = Executors.newSingleThreadExecutor();

// 4. 调度线程池 - 支持延迟和周期性任务
ScheduledExecutorService scheduledPool = Executors.newScheduledThreadPool(2);

// 5. 自定义 ThreadPoolExecutor
ThreadPoolExecutor customPool = new ThreadPoolExecutor(
    4,                      // 核心线程数
    8,                      // 最大线程数
    60L,                    // 空闲线程存活时间
    TimeUnit.SECONDS,       // 时间单位
    new LinkedBlockingQueue<>(100),  // 工作队列
    new ThreadPoolExecutor.CallerRunsPolicy()  // 拒绝策略
);
```

### 6.4 Flink 风格的线程池使用

```java
public class FlinkStyleExecutor {
    
    // 主线程执行器 - 保证线程安全
    private final Executor mainThreadExecutor;
    
    // IO 执行器 - 用于 IO 密集型操作
    private final ExecutorService ioExecutor;
    
    // 计算执行器 - 用于 CPU 密集型操作
    private final ExecutorService computeExecutor;
    
    public FlinkStyleExecutor() {
        // 主线程执行器（单线程，保证顺序）
        this.mainThreadExecutor = Executors.newSingleThreadExecutor(
            r -> new Thread(r, "main-thread"));
        
        // IO 执行器（多线程，处理阻塞 IO）
        this.ioExecutor = Executors.newCachedThreadPool(
            r -> new Thread(r, "io-thread-" + System.currentTimeMillis()));
        
        // 计算执行器（固定大小，处理 CPU 密集任务）
        this.computeExecutor = Executors.newFixedThreadPool(
            Runtime.getRuntime().availableProcessors(),
            r -> new Thread(r, "compute-thread-" + System.currentTimeMillis()));
    }
    
    public CompletableFuture<String> processData(String input) {
        return CompletableFuture
            // IO 操作：读取数据
            .supplyAsync(() -> {
                System.out.println("IO 读取, 线程: " + Thread.currentThread().getName());
                return readFromDatabase(input);
            }, ioExecutor)
            // 计算操作：处理数据
            .thenApplyAsync(data -> {
                System.out.println("计算处理, 线程: " + Thread.currentThread().getName());
                return processData(data);
            }, computeExecutor)
            // 主线程：更新状态
            .thenApplyAsync(result -> {
                System.out.println("更新状态, 线程: " + Thread.currentThread().getName());
                updateState(result);
                return result;
            }, mainThreadExecutor);
    }
    
    private String readFromDatabase(String input) { return "data-" + input; }
    private String processData(String data) { return "processed-" + data; }
    private void updateState(String result) { /* 更新状态 */ }
    
    public void shutdown() {
        ((ExecutorService) mainThreadExecutor).shutdown();
        ioExecutor.shutdown();
        computeExecutor.shutdown();
    }
}
```

### 6.5 线程池选择策略

```java
// 根据任务类型选择合适的线程池
public class ExecutorSelector {
    
    private final ExecutorService cpuBoundExecutor;
    private final ExecutorService ioBoundExecutor;
    
    public ExecutorSelector() {
        // CPU 密集型：线程数 = CPU 核心数
        int cpuCores = Runtime.getRuntime().availableProcessors();
        this.cpuBoundExecutor = Executors.newFixedThreadPool(cpuCores);
        
        // IO 密集型：线程数 = CPU 核心数 * 2（或更多）
        this.ioBoundExecutor = Executors.newFixedThreadPool(cpuCores * 2);
    }
    
    // CPU 密集型任务
    public <T> CompletableFuture<T> submitCpuTask(Supplier<T> task) {
        return CompletableFuture.supplyAsync(task, cpuBoundExecutor);
    }
    
    // IO 密集型任务
    public <T> CompletableFuture<T> submitIoTask(Supplier<T> task) {
        return CompletableFuture.supplyAsync(task, ioBoundExecutor);
    }
}
```

---

## 7. 结合 Runnable 和 Callable

### 7.1 Runnable 转 CompletableFuture

```java
// Runnable: 无返回值
Runnable task = () -> {
    System.out.println("执行任务");
    // 执行一些操作
};

// 方式 1: 使用 runAsync
CompletableFuture<Void> future1 = CompletableFuture.runAsync(task);

// 方式 2: 使用自定义线程池
ExecutorService executor = Executors.newFixedThreadPool(2);
CompletableFuture<Void> future2 = CompletableFuture.runAsync(task, executor);

// 方式 3: 手动包装
CompletableFuture<Void> future3 = new CompletableFuture<>();
executor.submit(() -> {
    try {
        task.run();
        future3.complete(null);
    } catch (Exception e) {
        future3.completeExceptionally(e);
    }
});
```

### 7.2 Callable 转 CompletableFuture

```java
// Callable: 有返回值，可抛出异常
Callable<String> callable = () -> {
    Thread.sleep(1000);
    return "callable result";
};

// 方式 1: 使用 supplyAsync（推荐）
CompletableFuture<String> future1 = CompletableFuture.supplyAsync(() -> {
    try {
        return callable.call();
    } catch (Exception e) {
        throw new CompletionException(e);
    }
});

// 方式 2: 手动包装
CompletableFuture<String> future2 = new CompletableFuture<>();
ExecutorService executor = Executors.newSingleThreadExecutor();
executor.submit(() -> {
    try {
        String result = callable.call();
        future2.complete(result);
    } catch (Exception e) {
        future2.completeExceptionally(e);
    }
});

// 方式 3: 工具方法
public static <T> CompletableFuture<T> fromCallable(
        Callable<T> callable, Executor executor) {
    CompletableFuture<T> future = new CompletableFuture<>();
    executor.execute(() -> {
        try {
            future.complete(callable.call());
        } catch (Throwable t) {
            future.completeExceptionally(t);
        }
    });
    return future;
}
```

### 7.3 Future 转 CompletableFuture

```java
// 传统 Future
ExecutorService executor = Executors.newSingleThreadExecutor();
Future<String> legacyFuture = executor.submit(() -> {
    Thread.sleep(1000);
    return "legacy result";
});

// 转换为 CompletableFuture（需要轮询或阻塞）
// 方式 1: 阻塞转换（不推荐，会阻塞线程）
CompletableFuture<String> cf1 = CompletableFuture.supplyAsync(() -> {
    try {
        return legacyFuture.get();
    } catch (Exception e) {
        throw new CompletionException(e);
    }
});

// 方式 2: 轮询转换
public static <T> CompletableFuture<T> fromFuture(
        Future<T> future, ScheduledExecutorService scheduler) {
    CompletableFuture<T> cf = new CompletableFuture<>();
    pollFuture(future, cf, scheduler);
    return cf;
}

private static <T> void pollFuture(
        Future<T> future, CompletableFuture<T> cf, 
        ScheduledExecutorService scheduler) {
    if (future.isDone()) {
        try {
            cf.complete(future.get());
        } catch (Exception e) {
            cf.completeExceptionally(e);
        }
    } else {
        scheduler.schedule(() -> pollFuture(future, cf, scheduler), 
            10, TimeUnit.MILLISECONDS);
    }
}
```

### 7.4 CompletableFuture 与 Runnable 链式组合

```java
// 在异步链中插入 Runnable
CompletableFuture<String> future = CompletableFuture
    .supplyAsync(() -> "step1")
    .thenApply(s -> {
        System.out.println("处理: " + s);
        return s + "-step2";
    })
    // 插入一个不关心结果的操作
    .whenComplete((result, error) -> {
        // 这里可以执行 Runnable 风格的操作
        Runnable logTask = () -> System.out.println("日志记录: " + result);
        logTask.run();
    })
    .thenApply(s -> s + "-step3");
```

### 7.5 批量执行 Runnable

```java
// 批量执行多个 Runnable 并等待全部完成
public CompletableFuture<Void> runAll(List<Runnable> tasks, Executor executor) {
    CompletableFuture<?>[] futures = tasks.stream()
        .map(task -> CompletableFuture.runAsync(task, executor))
        .toArray(CompletableFuture[]::new);
    
    return CompletableFuture.allOf(futures);
}

// 使用示例
List<Runnable> tasks = Arrays.asList(
    () -> System.out.println("Task 1"),
    () -> System.out.println("Task 2"),
    () -> System.out.println("Task 3")
);

ExecutorService executor = Executors.newFixedThreadPool(3);
runAll(tasks, executor).join();
executor.shutdown();
```

---

## 8. 高级模式

### 8.1 超时处理

```java
// Java 9+ 方式
CompletableFuture<String> future = CompletableFuture
    .supplyAsync(() -> {
        sleep(5000);  // 模拟长时间操作
        return "result";
    })
    .orTimeout(2, TimeUnit.SECONDS)  // 2 秒超时
    .exceptionally(throwable -> {
        if (throwable.getCause() instanceof TimeoutException) {
            return "timeout fallback";
        }
        return "error fallback";
    });

// Java 8 兼容方式
public static <T> CompletableFuture<T> withTimeout(
        CompletableFuture<T> future, long timeout, TimeUnit unit) {
    
    CompletableFuture<T> timeoutFuture = new CompletableFuture<>();
    
    ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(1);
    scheduler.schedule(() -> {
        timeoutFuture.completeExceptionally(
            new TimeoutException("Operation timed out after " + timeout + " " + unit));
    }, timeout, unit);
    
    return future.applyToEither(timeoutFuture, Function.identity());
}

// 使用示例
CompletableFuture<String> original = CompletableFuture.supplyAsync(() -> {
    sleep(5000);
    return "result";
});

CompletableFuture<String> withTimeout = withTimeout(original, 2, TimeUnit.SECONDS)
    .exceptionally(e -> "timeout fallback");
```

### 8.2 重试机制

```java
// 带重试的异步操作
public static <T> CompletableFuture<T> retryAsync(
        Supplier<CompletableFuture<T>> supplier,
        int maxRetries,
        long delayMs,
        Predicate<Throwable> retryOn) {
    
    return supplier.get().handle((result, throwable) -> {
        if (throwable == null) {
            return CompletableFuture.completedFuture(result);
        }
        
        if (maxRetries > 0 && retryOn.test(throwable)) {
            System.out.println("重试中... 剩余次数: " + maxRetries);
            sleep(delayMs);
            return retryAsync(supplier, maxRetries - 1, delayMs, retryOn);
        }
        
        CompletableFuture<T> failed = new CompletableFuture<>();
        failed.completeExceptionally(throwable);
        return failed;
    }).thenCompose(Function.identity());
}

// 使用示例
AtomicInteger attempts = new AtomicInteger(0);

CompletableFuture<String> result = retryAsync(
    () -> CompletableFuture.supplyAsync(() -> {
        int attempt = attempts.incrementAndGet();
        System.out.println("尝试 #" + attempt);
        if (attempt < 3) {
            throw new RuntimeException("模拟失败");
        }
        return "成功";
    }),
    5,      // 最大重试次数
    1000,   // 重试间隔（毫秒）
    e -> e instanceof RuntimeException  // 重试条件
);

System.out.println(result.get());  // "成功"
```

### 8.3 指数退避重试

```java
public static <T> CompletableFuture<T> retryWithBackoff(
        Supplier<CompletableFuture<T>> supplier,
        int maxRetries,
        long initialDelayMs,
        double multiplier) {
    
    return retryWithBackoffInternal(supplier, maxRetries, initialDelayMs, multiplier, 0);
}

private static <T> CompletableFuture<T> retryWithBackoffInternal(
        Supplier<CompletableFuture<T>> supplier,
        int maxRetries,
        long currentDelayMs,
        double multiplier,
        int currentAttempt) {
    
    return supplier.get().handle((result, throwable) -> {
        if (throwable == null) {
            return CompletableFuture.completedFuture(result);
        }
        
        if (currentAttempt < maxRetries) {
            System.out.printf("重试 #%d，等待 %dms%n", currentAttempt + 1, currentDelayMs);
            sleep(currentDelayMs);
            
            long nextDelay = (long) (currentDelayMs * multiplier);
            return retryWithBackoffInternal(
                supplier, maxRetries, nextDelay, multiplier, currentAttempt + 1);
        }
        
        CompletableFuture<T> failed = new CompletableFuture<>();
        failed.completeExceptionally(throwable);
        return failed;
    }).thenCompose(Function.identity());
}

// 使用示例
CompletableFuture<String> result = retryWithBackoff(
    () -> CompletableFuture.supplyAsync(() -> {
        throw new RuntimeException("总是失败");
    }),
    3,       // 最大重试 3 次
    100,     // 初始延迟 100ms
    2.0      // 每次延迟翻倍: 100ms -> 200ms -> 400ms
);
```

### 8.4 断路器模式

```java
public class CircuitBreaker {
    
    private enum State { CLOSED, OPEN, HALF_OPEN }
    
    private final int failureThreshold;
    private final long resetTimeoutMs;
    
    private State state = State.CLOSED;
    private int failureCount = 0;
    private long lastFailureTime = 0;
    
    public CircuitBreaker(int failureThreshold, long resetTimeoutMs) {
        this.failureThreshold = failureThreshold;
        this.resetTimeoutMs = resetTimeoutMs;
    }
    
    public <T> CompletableFuture<T> execute(Supplier<CompletableFuture<T>> supplier) {
        if (state == State.OPEN) {
            if (System.currentTimeMillis() - lastFailureTime > resetTimeoutMs) {
                state = State.HALF_OPEN;
            } else {
                CompletableFuture<T> failed = new CompletableFuture<>();
                failed.completeExceptionally(
                    new RuntimeException("Circuit breaker is OPEN"));
                return failed;
            }
        }
        
        return supplier.get()
            .whenComplete((result, throwable) -> {
                if (throwable != null) {
                    recordFailure();
                } else {
                    recordSuccess();
                }
            });
    }
    
    private synchronized void recordFailure() {
        failureCount++;
        lastFailureTime = System.currentTimeMillis();
        if (failureCount >= failureThreshold) {
            state = State.OPEN;
            System.out.println("断路器打开！");
        }
    }
    
    private synchronized void recordSuccess() {
        failureCount = 0;
        state = State.CLOSED;
    }
}

// 使用示例
CircuitBreaker breaker = new CircuitBreaker(3, 5000);

for (int i = 0; i < 10; i++) {
    breaker.execute(() -> CompletableFuture.supplyAsync(() -> {
        throw new RuntimeException("服务不可用");
    })).exceptionally(e -> {
        System.out.println("错误: " + e.getMessage());
        return null;
    }).join();
}
```

### 8.5 限流器

```java
public class RateLimiter {
    
    private final Semaphore semaphore;
    private final ExecutorService executor;
    
    public RateLimiter(int maxConcurrent) {
        this.semaphore = new Semaphore(maxConcurrent);
        this.executor = Executors.newCachedThreadPool();
    }
    
    public <T> CompletableFuture<T> execute(Supplier<T> task) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                semaphore.acquire();
                try {
                    return task.get();
                } finally {
                    semaphore.release();
                }
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                throw new CompletionException(e);
            }
        }, executor);
    }
    
    public void shutdown() {
        executor.shutdown();
    }
}

// 使用示例
RateLimiter limiter = new RateLimiter(3);  // 最多 3 个并发

List<CompletableFuture<String>> futures = IntStream.range(0, 10)
    .mapToObj(i -> limiter.execute(() -> {
        System.out.println("执行任务 " + i + "，线程: " + 
            Thread.currentThread().getName());
        sleep(1000);
        return "Result " + i;
    }))
    .collect(Collectors.toList());

futures.forEach(f -> System.out.println(f.join()));
limiter.shutdown();
```

---

## 9. Flink 中的实际应用

### 9.1 JobManagerRunner 结果处理模式

```java
// Flink 源码中的典型模式
final CompletableFuture<CleanupJobState> cleanupJobStateFuture =
    jobManagerRunner
        .getResultFuture()  // 获取作业结果 Future
        .handleAsync(       // 异步处理结果和异常
            (jobManagerRunnerResult, throwable) -> {
                // 1. 验证状态一致性
                Preconditions.checkState(
                    jobManagerRunnerRegistry.isRegistered(jobId) &&
                    jobManagerRunnerRegistry.get(jobId) == jobManagerRunner,
                    "Job entry must be bound to JobManagerRunner lifetime.");

                // 2. 根据结果或异常进行不同处理
                if (jobManagerRunnerResult != null) {
                    // 正常完成，返回另一个 CompletableFuture
                    return handleJobManagerRunnerResult(
                        jobManagerRunnerResult, executionType);
                } else {
                    // 异常情况，返回已完成的 Future
                    return CompletableFuture.completedFuture(
                        jobManagerRunnerFailed(jobId, JobStatus.FAILED, throwable));
                }
            },
            getMainThreadExecutor())  // 在主线程执行器中执行
        .thenCompose(Function.identity());  // 扁平化嵌套的 Future
```

### 9.2 模拟 Flink 作业提交流程

```java
public class FlinkJobSubmissionDemo {
    
    private final ExecutorService executorService = 
        Executors.newFixedThreadPool(4);
    
    // 模拟作业提交
    public CompletableFuture<JobID> submitJob(JobGraph jobGraph) {
        // 步骤 1: 异步序列化 JobGraph
        CompletableFuture<Path> jobGraphFileFuture = 
            CompletableFuture.supplyAsync(() -> {
                System.out.println("序列化 JobGraph，线程: " + 
                    Thread.currentThread().getName());
                return serializeJobGraph(jobGraph);
            }, executorService);
        
        // 步骤 2: 准备请求体
        CompletableFuture<JobSubmitRequest> requestFuture = 
            jobGraphFileFuture.thenApply(jobGraphFile -> {
                System.out.println("准备请求体，线程: " + 
                    Thread.currentThread().getName());
                return prepareRequest(jobGraphFile, jobGraph);
            });
        
        // 步骤 3: 发送请求
        CompletableFuture<JobSubmitResponse> submissionFuture = 
            requestFuture.thenCompose(request -> {
                System.out.println("发送请求，线程: " + 
                    Thread.currentThread().getName());
                return sendRequest(request);
            });
        
        // 步骤 4: 提取 JobID
        return submissionFuture
            .thenApply(response -> {
                System.out.println("提交成功: " + response.getJobId());
                return response.getJobId();
            })
            .whenComplete((jobId, error) -> {
                if (error != null) {
                    System.err.println("提交失败: " + error.getMessage());
                }
            });
    }
    
    // 模拟方法
    private Path serializeJobGraph(JobGraph jobGraph) {
        sleep(500);
        return Path.of("/tmp/jobgraph-" + jobGraph.getJobID() + ".bin");
    }
    
    private JobSubmitRequest prepareRequest(Path jobGraphFile, JobGraph jobGraph) {
        return new JobSubmitRequest(jobGraphFile, jobGraph.getJobID());
    }
    
    private CompletableFuture<JobSubmitResponse> sendRequest(JobSubmitRequest request) {
        return CompletableFuture.supplyAsync(() -> {
            sleep(1000);  // 模拟网络延迟
            return new JobSubmitResponse(request.getJobId());
        }, executorService);
    }
    
    // 内部类
    static class JobGraph {
        private final JobID jobId = new JobID();
        public JobID getJobID() { return jobId; }
    }
    
    static class JobID {
        private final String id = UUID.randomUUID().toString();
        @Override public String toString() { return id; }
    }
    
    static class JobSubmitRequest {
        private final Path jobGraphFile;
        private final JobID jobId;
        
        JobSubmitRequest(Path jobGraphFile, JobID jobId) {
            this.jobGraphFile = jobGraphFile;
            this.jobId = jobId;
        }
        
        public JobID getJobId() { return jobId; }
    }
    
    static class JobSubmitResponse {
        private final JobID jobId;
        
        JobSubmitResponse(JobID jobId) { this.jobId = jobId; }
        public JobID getJobId() { return jobId; }
    }
    
    public void shutdown() {
        executorService.shutdown();
    }
}
```

### 9.3 带重试的请求发送

```java
public class RetriableRequestSender {
    
    private final RestClient restClient;
    private final int maxRetries;
    private final Predicate<Throwable> retryPredicate;
    
    public RetriableRequestSender(RestClient restClient, int maxRetries) {
        this.restClient = restClient;
        this.maxRetries = maxRetries;
        this.retryPredicate = throwable -> 
            throwable instanceof IOException ||
            throwable instanceof TimeoutException;
    }
    
    public <T> CompletableFuture<T> sendRetriableRequest(
            String url, Object request, Class<T> responseType) {
        
        return retry(
            () -> restClient.sendRequest(url, request, responseType),
            maxRetries,
            retryPredicate);
    }
    
    private <T> CompletableFuture<T> retry(
            Supplier<CompletableFuture<T>> operation,
            int retriesLeft,
            Predicate<Throwable> shouldRetry) {
        
        return operation.get()
            .handle((result, throwable) -> {
                if (throwable == null) {
                    return CompletableFuture.completedFuture(result);
                }
                
                Throwable cause = throwable.getCause() != null ? 
                    throwable.getCause() : throwable;
                
                if (retriesLeft > 0 && shouldRetry.test(cause)) {
                    System.out.println("请求失败，重试中... 剩余次数: " + retriesLeft);
                    return retry(operation, retriesLeft - 1, shouldRetry);
                }
                
                CompletableFuture<T> failed = new CompletableFuture<>();
                failed.completeExceptionally(throwable);
                return failed;
            })
            .thenCompose(Function.identity());
    }
    
    // 模拟 RestClient
    static class RestClient {
        public <T> CompletableFuture<T> sendRequest(
                String url, Object request, Class<T> responseType) {
            return CompletableFuture.supplyAsync(() -> {
                // 模拟请求
                return null;
            });
        }
    }
}
```

---

## 10. 最佳实践

### 10.1 避免阻塞

```java
// ❌ 错误：在异步链中阻塞
CompletableFuture<String> bad = CompletableFuture
    .supplyAsync(() -> "step1")
    .thenApply(s -> {
        // 不要在这里调用 get() 或 join()
        String other = anotherFuture.get();  // 阻塞！
        return s + other;
    });

// ✅ 正确：使用 thenCompose 组合
CompletableFuture<String> good = CompletableFuture
    .supplyAsync(() -> "step1")
    .thenCompose(s -> anotherFuture.thenApply(other -> s + other));
```

### 10.2 正确处理异常

```java
// ❌ 错误：忽略异常
CompletableFuture<String> bad = CompletableFuture
    .supplyAsync(() -> {
        throw new RuntimeException("error");
    });
// 异常被吞掉，没有任何处理

// ✅ 正确：始终处理异常
CompletableFuture<String> good = CompletableFuture
    .supplyAsync(() -> {
        throw new RuntimeException("error");
    })
    .exceptionally(e -> {
        log.error("操作失败", e);
        return "fallback";
    });
```

### 10.3 使用合适的线程池

```java
// ❌ 错误：所有操作使用默认线程池
CompletableFuture.supplyAsync(() -> blockingIoOperation());  // 可能阻塞公共线程池

// ✅ 正确：IO 操作使用专用线程池
ExecutorService ioExecutor = Executors.newCachedThreadPool();
CompletableFuture.supplyAsync(() -> blockingIoOperation(), ioExecutor);
```

### 10.4 避免过长的链式调用

```java
// ❌ 难以阅读和调试
CompletableFuture<String> bad = cf
    .thenApply(...)
    .thenCompose(...)
    .thenApply(...)
    .thenCompose(...)
    .thenApply(...)
    .thenCompose(...)
    .thenApply(...);

// ✅ 拆分成有意义的方法
CompletableFuture<String> good = cf
    .thenCompose(this::validateInput)
    .thenCompose(this::processData)
    .thenCompose(this::saveResult);
```

### 10.5 资源清理

```java
// ✅ 使用 whenComplete 确保资源清理
CompletableFuture<String> future = CompletableFuture
    .supplyAsync(() -> {
        Resource resource = acquireResource();
        try {
            return process(resource);
        } finally {
            // 这里的清理可能不会执行（如果是异步的）
        }
    })
    .whenComplete((result, error) -> {
        // 无论成功还是失败都会执行
        releaseResource();
    });
```


## 附录：常用方法速查表

| 方法 | 描述 | 返回类型 |
|------|------|----------|
| `supplyAsync(Supplier)` | 异步执行有返回值的任务 | `CompletableFuture<T>` |
| `runAsync(Runnable)` | 异步执行无返回值的任务 | `CompletableFuture<Void>` |
| `thenApply(Function)` | 同步转换结果 | `CompletableFuture<U>` |
| `thenApplyAsync(Function)` | 异步转换结果 | `CompletableFuture<U>` |
| `thenCompose(Function)` | 扁平化嵌套 Future | `CompletableFuture<U>` |
| `thenAccept(Consumer)` | 消费结果 | `CompletableFuture<Void>` |
| `thenRun(Runnable)` | 执行后续操作 | `CompletableFuture<Void>` |
| `handle(BiFunction)` | 处理结果和异常 | `CompletableFuture<U>` |
| `exceptionally(Function)` | 异常恢复 | `CompletableFuture<T>` |
| `whenComplete(BiConsumer)` | 观察完成（不改变结果） | `CompletableFuture<T>` |
| `thenCombine(CF, BiFunction)` | 合并两个 Future | `CompletableFuture<V>` |
| `allOf(CF...)` | 等待所有完成 | `CompletableFuture<Void>` |
| `anyOf(CF...)` | 任一完成 | `CompletableFuture<Object>` |

---

## 参考资料

- [Java CompletableFuture 官方文档](https://docs.oracle.com/javase/8/docs/api/java/util/concurrent/CompletableFuture.html)
- [Flink 源码 - RestClusterClient](https://github.com/apache/flink/blob/master/flink-clients/src/main/java/org/apache/flink/client/program/rest/RestClusterClient.java)
- [Flink 源码 - Dispatcher](https://github.com/apache/flink/blob/master/flink-runtime/src/main/java/org/apache/flink/runtime/dispatcher/Dispatcher.java)

---

*本文档基于 Flink 1.19 源码分析编写*
