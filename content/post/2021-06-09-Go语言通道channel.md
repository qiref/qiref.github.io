---
comments: true
date: "2021-06-09T21:18:23Z"
tags: 
  - Go
title: Go语言channel
---

摘要：Go语言中，协程之间通过channel相互通信，可以从一个Go协程将值发送到通道，然后在别的协程中接收。

------

## channel 定义

定义channel的语法为：make(chan val-type)，val-type就是需要传递值的类型。 `chan1 <- val` 表示将val发送到channel chann1中， `r := <- chann1`表示从chann1中读取消息。

``` go
func Ping(c *chan string, s string) {
    *c <- s
}

func Pong(c *chan string) string {
    return <-*c
}

// main
func main() {

    c := make(chan string)
    go Ping(&c, "ping")
    go func() {
        pong := Pong(&c)
        fmt.Println(pong)
    }()

    time.Sleep(time.Second * 2)
}

// 结果
// ping
```

需要注意的是，向通道中发送消息和从通道中接收消息，都是阻塞的，如果发送和接收不是成对出现，就会发生错误。
将上文中代码改成这样：

``` go
c := make(chan string)
Ping(&c, "ping")
//go func() {
//    pong := Pong(&c)
//    fmt.Println(pong)
//}()

time.Sleep(time.Second * 2)

//fatal error: all goroutines are asleep - deadlock!
```

## channel方向

``` go
func pong(ping <-chan string, pong chan<- string) {
    msg := <-ping
    pong <- msg
}
```

在chan的定义中，箭头的方向是固定的，` <- `箭头方向只能向左。
* ` <-chan ` 表示该channel只能用于接收消息，不能用其发送消息。
* ` chan<- ` 表示该channel只能用于发送消息，不能用其接收消息。

## channel缓冲

默认通道是 无缓冲 的，这意味着只有在对应的接收（<- chan）通道准备好接收时，才允许进行发送（chan <-）。可缓存通道允许在没有对应接收方的情况下，缓存限定数量的值。

``` go
messages := make(chan string, 2)
messages <- "1"
messages <- "2"
```
make 构建一个channel时，可以指定缓冲区大小，当channel中超过2个元素时，就会报错。


## channel同步

``` go
func work(done chan bool) {
    fmt.Println("working ...")
    time.Sleep(time.Second * 3)
    fmt.Println("done")

    done <- true
}

// main
done := make(chan bool)
go work(done)
<-done

// 输出
// working ...
// done
```
程序将在接收到通道中 work() 发出的通知前一直阻塞，如果把 <- done 这行代码从序中移除，程序甚至会在work()还没开始运行时就结束了。

## channel遍历

for 和 range为基本的数据结构提供了迭代的功能。我们也可以使用这个语法来遍历从通道中取得的值。

``` go
func loop(c chan string) {
    fmt.Println("range over chan start.")
    for s := range c {
        fmt.Println(s)
    }
    fmt.Println("range over chan end.")
}

// main
chanForRange := make(chan string, 3)
chanForRange <- "l"
chanForRange <- "m"
chanForRange <- "n"
close(chanForRange)
loop(chanForRange)

// 输出结果
// range over chan start.
// l
// m
// n
// range over chan end.

```

这里遍历需要关闭chanForRange，否则chanForRange会一直等待输入，但后续没有往channel中写入消息，会导致成型陷入死锁。

可以看出，在channel关闭后，依然可以遍历channel。

## select 

Go 语言中的 select 能够让 Goroutine 同时等待多个 Channel 可读或者可写，在多个文件或者 Channel状态改变之前，select 会一直阻塞当前线程或者 Goroutine。

```go
c1 := make(chan string)
c2 := make(chan string)

go func() {
    time.Sleep(time.Second * 1)
    c1 <- "1"
}()

go func() {
    time.Sleep(time.Second * 1)
    c2 <- "2"
}()

for i := 0; i < 2; i++ {
    select {
    case msg1 := <-c1:
        fmt.Println(i)
        fmt.Println("receive msg1 : ", msg1)
    case msg2 := <-c2:
        fmt.Println(i)
        fmt.Println("receive msg2 : ", msg2)
    }
}

// 运行结果：
// 0
// receive msg1 :  1
// 1
// receive msg2 :  2

```

这里每一次循环都会进入一次select，然后会执行其中的一个case，如果没有进入case，程序就会出现死锁；因此这里的循环次数需要和channel发送消息的次数一致，因为select默认会阻塞。

``` go
for i := 0; i < 5; i++ {
    select {
    case msg1 := <-c1:
        fmt.Println(i)
        fmt.Println("receive msg1 : ", msg1)
    case msg2 := <-c2:
        fmt.Println(i)
        fmt.Println("receive msg2 : ", msg2)
    default:
        fmt.Println("default")
    }
}
```

select配上default之后，当case条件不满足时，select就不会陷入阻塞。

## 多协程执行任务, 并收集执行结果

``` go
import (
    "fmt"
    "sync"
    "testing"
    "time"
)

func TestMain(t *testing.T) {
    rstChan := make(chan map[string]int, 5) // 这里必须指定 chan 的容量
    var wg sync.WaitGroup
    for i := 0; i < 5; i++ {
        i := i
        wg.Add(1)
        go func() { // 模拟执行任务
            defer wg.Done()
            if i%2 == 0 { // 模拟任务执行失败的场景, 会出现不往 rstChan 写入消息的情况
                m := make(map[string]int)
                m[fmt.Sprintf("%d", i)] = i
                time.Sleep(time.Second * 3)
                rstChan <- m
            }
        }()
    }
    fmt.Println("wait")
    wg.Wait()
    fmt.Println("wait finish")

    size := len(rstChan) // 提前读取 rstChan size, 消费数据 len(rstChan) 会改变
    for j := 0; j < size; j++ {
        item := <-rstChan
        fmt.Println(item)
    }
    defer close(rstChan)
    fmt.Println("done")
}

// 输出
=== RUN   TestMain
wait
wait finish
map[2:2]
map[4:4]
map[0:0]
done
--- PASS: TestMain (3.00s)
PASS
ok      awesome-test/src/main    3.002s
```