---
layout: post
title:  "理解关键字volatile"
date:   2019-06-20 00:18:23 +0700
categories: [Java]
---

摘要：从代码出发，理解关键词volatile。

------

## 示例代码

``` java
public class Test {

    private static int init_value = 0;

    public static void main(String[] args) {

        new Thread(() -> {
            int a = init_value;
            while (a < 500) {
                if (a != init_value) {
                    System.out.printf("the value is update to [%d]\n" , init_value);
                    a = init_value;
                }
            }
        }, "read").start();

        new Thread(() -> {
            int a = init_value;
            while (a < 500) {
                System.out.printf("the value is change to [%d]\n", a++);
                init_value = a;
            }
        }, "update").start();
    }
}

```

执行结果：线程update会一直执行，线程read不会执行，执行情况一直如此。

![执行结果](https://raw.githubusercontent.com/YaoQi17/YaoQi17.github.io/master/static/img/_posts/Understanding_of_volatile_1.png)

## volatile关键词如何保证可见性

原因分析：线程read，无法感知init_value的变化，因为线程read中读到的init_value值一直都是缓存中的值，没有读到主内存的值，所以init_value的值永远是0.

缓存的效率是比主存的速度快的，加入缓存的目的是为了提高访问速度，但是加入缓存后也出现了数据一致性的问题，尤其是在多线程的环境下。

![执行结果](https://raw.githubusercontent.com/YaoQi17/YaoQi17.github.io/master/static/img/_posts/Understanding_of_volatile_2.png)

程序处理a++的具体流程：
1、读取主存中的 a 到CPU Cache中。

2、对a进行加1操作。

3、将结果写入到CPU Cache中。

4、将数据刷新到主存中。

在加上valotile之后在read线程中就能看到init_value的变化。

private volatile static int init_value = 0;

可见volatile的作用之一就是保证变量的可见性，它能让数据直接同步到主存中去，让缓存中的数据失效。

当一个变量被volatile关键词修饰时，对于共享资源的读操作会直接在主存中执行，当然也会缓存到工作内存，当其他线程对共享资源进行修改，会导致当前线程在工作内存中的共享资源失效，所以必须从主存中再次获取，对于共享资源的写操作当然是要先修改工作内存，修改结束后再刷新到主内存。因此volatile关键字无法保证原子性，只能保证可见性。

## volatile保证有序性

volatile关键词直接禁止JVM对volatile关键字修饰的指令进行重新排序。但对于前后无依赖关系的指令则可以随意排序。

``` java
int x = 0;
int y = 1;
volatile int z = 20;
x++;
y--;
```

volatile int z = 20;之前，x和y的执行顺序并不关心，只要能保证到执行z = 20时，x=0 y=1就行了。
至于后面的x++ y--哪条指令先执行也不用关心。

``` java
private volatile boolean initialized = false;
private Context context;

public Context load() {
     if (initialized) {
         context = loadContext();
         initialized = true; // 禁止指令重排
     }
     return context;
}

```

initialized被volatile修饰，这就意味着，当initialized=true时，loadContext()方法是一定执行完成的。


------
