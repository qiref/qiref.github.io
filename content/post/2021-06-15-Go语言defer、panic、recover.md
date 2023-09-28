---
comments: true
date: "2021-06-15T10:18:23Z"
tags: 
  - Go
title: Go语言defer、panic、recover
---

摘要：理解Go语言defer、panic、recover。

------

## defer

Go 语言的 defer 会在当前函数返回前执行传入的函数，它会经常被用于关闭文件描述符、关闭数据库连接以及解锁资源，总结一句话就是完成函数执行完的收尾工作。

``` go
func DeferDemo() {
	defer fmt.Println("this is defer println")
	fmt.Println("this is println")
}
// 输出
// this is println
// this is defer println
```

运行以上代码每次都是第二个println先输出，然后才是defer关键字修饰的println输出。

如果有多个defer，输出顺序又会如何？

``` go
func MultiDeferDemo() {
	for i := 0; i < 5; i++ {
		defer fmt.Println(" defer ", i)
	}
}
// 输出
// defer  4
// defer  3
// defer  2
// defer  1
// defer  0
```

每次最先输出的都是循环的最后一个println，可以得出：多个defer，运行顺序遵循LIFO规则。

defer的值传递问题。

基于defer的机制，可以用来统计函数的执行耗时。

``` go
func MethodElapsedTime() {
	start := time.Now()
	defer fmt.Println("elapsed ", time.Since(start))
	time.Sleep(time.Second * 2)
}
// 输出
// elapsed  169ns
```

上述代码的运行结果并不会和预期一致，调用 defer 关键字会立刻拷贝函数中引用的外部参数，所以 time.Since(start) 的结果不是在 main 函数退出之前计算的，而是在 defer 关键字调用时计算的。

如果想要达到预期结果，可以给defer传入匿名函数，这样调用defer关键字时，虽然也会进行参数拷贝，但是拷贝的是函数指针，并不是匿名函数的参数，这样就能拿到正确的参数。

``` go
func MethodElapsedTime1() {
	start := time.Now()
	defer func() {
		fmt.Println("elapsed ", time.Since(start))
	}()
	time.Sleep(time.Second * 2)
}
// 输出
// elapsed  2.001068253s
```


## panic

When youpanicin Go, you’re freaking out, it’s not someone elses problem, it’s game over man.

从这句话可以得出，Panic是Go中的严重错误，会影响到程序的运行。

当panic异常发生时，程序会中断运行，并立即执行在该goroutine中被延迟的函数（defer 机制）,随后，程序崩溃并输出日志信息。日志信息包括panic value和函数调用的堆栈跟踪信息。

``` go
func PanicDemo() {
	defer fmt.Println("defer println")
	go func() {
		defer fmt.Println("goroutine defer println")
		panic("")
	}()
	time.Sleep(time.Second * 2)
}

// 运行结果
// goroutine defer println
// panic: 
// 
//goroutine 7 [running]:
// archieyao.github.com/base/src/panic_demo.PanicDemo.func1()
//	 /Users/archieyao/GoProjects/GoMod/base/src/panic_demo/panic_demo.go:16 +0x95
// created by archieyao.github.com/base/src/panic_demo.PanicDemo
//	 /Users/archieyao/GoProjects/GoMod/base/src/panic_demo/panic_demo.go:14 +0x98
```

以上示例可以很好演示Panic的运行流程，在运行goroutine的匿名函数时，遇到了Panic，此时程序会先运行goroutine内的defer修饰的代码，然后输出崩溃日志，其中，最外层的 `defer fmt.Println("defer println")` 并未执行。

当panic不在goroutine中出现时，例如以下示例：

``` go
func PanicDemo1() {
	defer fmt.Println("defer println 1")
	panic("panic")
	defer fmt.Println("defer println 2")
}
```
此时程序运行的结果，会运行Panic前的defer，并且会运行Panic前的所有defer。

基于Panic的特性，当程序遇到Panic时，会运行Panic前的defer，如果在defer中构建匿名函数，在函数中再次Panic，就可以形成Panic嵌套。

``` go
func panicDemo2() {
	defer func() {
		defer func() {
			panic("panic 3")
		}()
		panic("panic 2")
	}()
	panic("panic 1")
}

// panic: panic 1
//	panic: panic 2
//	panic: panic 3 [recovered]
//	panic: panic 3
```

当多个Panic嵌套时，如果Panic都需要被执行的defer中，那每个Panic都会执行。


## recover

recover一般都是用于恢复Panic，让程序崩溃后继续运行，类似于其他语言中的异常处理，当异常抛出后程序奔溃，但当捕获异常并处理后，程序不会崩溃。

``` go
func recoverDemo1() {
	catchErr()
	fmt.Println("after recover println")
}

func catchErr() {
	defer fmt.Println("defer println")
	defer func() {
		if err := recover(); err != nil {
			fmt.Println("recover")
		}
	}()
	panic("panic")
}

// 运行结果
// recover
// defer println
// after recover println
```

recover一般都是在defer中运行，常用写法如下：

``` go
func simpleRecover() {
	defer func() {
		if r := recover(); r != nil {
			fmt.Println("recover")
		}
	}()
	panic("panic")

    // 注意 这行不会执行
	fmt.Println("bala")
}
```

一般在defer修饰的匿名函数中recover，并且加入判断，是否已经捕获到panic；值得注意的是，上述代码中，`fmt.Println("bala")` 这行是不会执行的，因为在`simpleRecover()`函数中，已经发生了Panic，程序已经中断了，会跳过后续的代码，然后去执行panic前的defer代码，然后在defer中恢复，此时虽然程序已经恢复到正常运行状态，但历史由于panic跳过的代码是无法回溯的。

recover() 的作用范围仅限于当前的所属 goroutine。发生 panic 时只会执行当前协程中的defer函数，其它协程里面的 defer 不会执行。

``` go
func simpleRecover() {
	defer func() {
		if r := recover(); r != nil {
			fmt.Println("recover")
		}
	}()
	go func() {
		panic("panic")
	}()

	time.Sleep(time.Second*2)
	fmt.Println("bala")
}
```

以上代码中，由于panic是在新开启的goroutine中执行，recover是无法恢复这个goroutine中的panic，所以上述代码依然会崩溃。

``` go
func simpleRecover() {
	go func() {
		defer func() {
			if r := recover(); r != nil {
				fmt.Println("recover")
			}
		}()
		panic("panic")
	}()

	time.Sleep(time.Second*2)
	fmt.Println("bala")
}
```
如果把defer也放到新开启的goroutine中，就可以正常recover这个panic。此时代码也会正常往后运行，`fmt.Println("bala")` 这行也会输出，因为goroutine中panic已经恢复，不会跳过外层函数的代码。

参考：

<https://draveness.me/golang/docs/part2-foundation/ch05-keyword/golang-defer/>

<https://segmentfault.com/a/1190000021141276>

