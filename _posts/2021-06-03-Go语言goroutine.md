---
layout: post
title:  "Go语言goroutine"
date:   2021-06-3 21:18:23 +0700
categories: [Go]
tags:   Go
comments: true
---

摘要：Go语言goroutine

------

## goroutine协程

Go 协程 在执行上来说是轻量级的线程。go语言层面并不支持多进程或多线程，但是协程更好用，协程被称为用户态线程，不存在CPU上下文切换问题，效率非常高。

go语言中启动一个协程非常简单，只需要在执行函数前加上go关键字，就可以启用goroutine。

``` go
func main() {

	// 使用匿名函数启用goroutine
	go func() {
		fmt.Println("goroutine")
	}()

	// 调用函数启用goroutine
	go func1()
}

func func1() {
	fmt.Println("f1() was called.")
}

```

没错就是这么简单，在go语言中，goroutine会被放到运行队列runtime.runqput中，然后由调度器调度。并非是每一个协程都会有一个对应的线程去执行，协程比线程的粒度更细。

但是上述代码并不会有输出结果，因为还没等func1()函数执行完成，main()就已经执行完成了。所以在main()函数执行完成之前sleep一下就可以看到func1()的执行结果。

``` go
time.Sleep(time.Second * 1)
```

## WaitGroup

sleep肯定是不靠谱的，go语言中可以等待协程执行完成后再回到主线程。

``` go
// 定义全局变量
var WG = sync.WaitGroup{}

func main() {
	WG.Add(1)
	go func1()
	WG.Wait()
}

func func1() {
	fmt.Println("f1() was called.")
	WG.Done()
}
```
在调用func1()之前，调用全局变量WG.Add()方法，然后启用goroutine调用func1()，然后调用WG.Wait()函数进行等待，fun1()调用结束后，调用WG.Done()。
通过试验可以发现：Add()方法中的数值与Done()方法的数量应该保持一致。当Add(2)时，Done()方法应该执行两次。直到 WaitGroup 计数器恢复为 0； 即所有协程的工作都已经完成。
看源码可以发现，Done()与Add()实际上是一个函数。

``` go
// Done decrements the WaitGroup counter by one.
func (wg *WaitGroup) Done() {
	wg.Add(-1)
}
```

## 多个goroutine如何执行

``` go
func main() {
	loop := 5
	WG.Add(loop)
	for i := 0; i < loop; i++ {
		go func2(i)
	}
	WG.Wait()
}

// define func2
func func2(i int) {
	fmt.Println("func2() was called. i is : ", i)
	WG.Done()
}

// 运行结果：
//func2() was called. i is : 4
//func2() was called. i is : 2
//func2() was called. i is : 3
//func2() was called. i is : 0
//func2() was called. i is : 1
```
每个goroutine的运行并不规则，每个协程在并发执行。:thinking: 

从实现上，每一个goroutine都会加入队列中，然后这组协程由调度器通过各种调度策略进行调度。然后会开启多个线程去调度协程工作队列，
调度器最多可以创建 10000 个线程，但是其中大多数的线程都不会执行用户代码，大部分都进行调度工作，最多只会有 GOMAXPROCS 个活跃线程能够正常运行。在默认情况下，运行时会将 GOMAXPROCS 设置成当前机器的核数，我们也可以在程序中使用 runtime.GOMAXPROCS 来改变最大的活跃线程数。

``` go
func main() {
	runtime.GOMAXPROCS(1)
	fmt.Println(runtime.NumGoroutine())
	for i := 0; i < 10; i++ {
		go say("Hello World: " + strconv.Itoa(i))
	}
	fmt.Println(runtime.NumGoroutine())
	for {
	}
}

func say(s string) {
	println(s)
}
```

网上很多地方给出这个例子，并且说当`runtime.GOMAXPROCS(1)`的情况下，上述代码是不会运行的，只有当参数大于1时，才可以正常运行，但是该示例在go version go1.16.4 darwin/amd64 环境下可以正常运行，猜测是go协程调度策略新版本作了优化。

参考：

<https://zhuanlan.zhihu.com/p/74047342>
<http://books.studygolang.com/gobyexample/goroutines/>

------