---
comments: true
date: "2019-06-16T00:18:23Z"
tags: 
  - Java
title: SpringBoot中使用AOP
---

摘要：Spring中如何使用注解实现面向切面编程，以及如何使用自定义注解。

------

## 场景

比如用户登录，每个请求发起之前都会判断用户是否登录，如果每个请求都去判断一次，那就重复地做了很多事情，只要是有重复的地方，就有优化的空间。现在就把重复的地方抽取出来，暂且称之为 " 拦截器 "，然后每次请求之前就先经过" 拦截器 "，这个编程的思想就可以称之为面向切面编程。AOP(Aspect  Oriented Program)

最典型的应用就是事务管理和权限验证，还有日志统计，下文中的案例就是接口执行时间的统计。

## spring中使用AOP（基于注解）

不得不说注解是个很巧妙的设计，使用很少量的信息描述数据，这类数据称之为元数据，描述数据的数据。关于注解的理解，这里有个传送门：http://www.importnew.com/10294.html

下面的案例是在springBoot中进行的，直观地感受一下如何使用注解完成AOP。

``` java
@Service
public class UserService {

    public void getUser() {
        //To do something
        System.out.println("getUser() has been called");
        try {
            Thread.sleep(1000);
        } catch (InterruptedException e) {
            e.printStackTrace();
        }
    }
}
```

切面是这样定义的：

``` java

@Component
@Aspect
public class LoggerAspect {
    /**
     * getUser()执行之前执行
     */
    @Before("execution(* com.springboot.demo.service.UserService.getUser(..))")
    public void callBefore() {
        System.out.println("before call method");
        System.out.println("begin........................");
    }

    /**
     * getUser()执行之后执行
     */
    @After("execution(* com.springboot.demo.service.UserService.getUser(..))")
    public void callAfter() {
        System.out.println("after call method");
        System.out.println("end..............................");
    }
}

```


来个单元测试验证一下：

``` java
@RunWith(SpringRunner.class)
@SpringBootTest
public class UserServiceTest {

    @Autowired
    private UserService userService;

    @Test
    public void getUserTest() {
        userService.getUser();
    }
}
```

## 案例

假如有以下的业务场景: UserService业务类中有个getUser()这个方法，现在想统计一下这个方法的执行时间，可能需要测试这个接口的性能。通常做法是方法开始时获取系统当前时间，然后方法结束时获取当前时间，最后 excuteTime=endTime-startTime。

如果现在不仅是这个方法需要统计，还有getUserByName()、getUserById()需要统计，上述的方法明显很笨了。

使用AOP怎么解决？ 抽取公共部分为一个切面，方法执行前记录时间，然后执行目标方法，最后，目标方法执行完成之后再获取一次系统时间。

具体实现如下：在LoggerAspect中再写一个方法，记录getUser()方法的执行时间。

``` java

/**
 * 记录执行时间
 * @param point 切点
 * @return
 * @throws Throwable
 */
@Around("execution(* com.springboot.demo.service.UserService.getUser(..))")
public Object getMethodExecuteTime(ProceedingJoinPoint point) throws Throwable {
    System.out.println("---------------getMethodExecuteTime------------------");
    long startTime = System.currentTimeMillis();
    //调用目标方法
    Object result = point.proceed();
    long endTime = System.currentTimeMillis();
    long executeTime = endTime - startTime;
    System.out.println("executeTime=" + executeTime + "------------------");
    return result;
}
```

@Around将目标方法再次封装，控制了它的调用时机，以此来记录getUser()的执行时间。但是好像并没有达到记录UserService中的多个方法的执行时间的目的。

@Around("execution(* com.springboot.demo.service.UserService.getUser(..))")

其中指定了切点是getUser()这个方法，这里的表达式很丰富，可以设置为：

\*  com.springboot.demo.service.UserService.*(..)

表示UserService中的每一个方法都是切点，甚至可以是这样：

\*  com.springboot.demo.service.*.*(..)

表示service包下的所有类的所有方法都是切点，但是这样很明显不够灵活，如果能自定义地控制就更好了。

## 自定义一个注解

如果用一个注解标注某个方法需要记录其执行时间，岂不是更加优雅。

``` java
/**
 * @Description 标注某个方法需要记录执行时间
 * @Author YaoQi
 * @Date 2018/7/6 15:51
 */

@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
@Documented

public @interface Logger {
    String value() default "";
}

```
注解是用来描述数据的，上面的这个注解的意思是：这个注解将作用于方法，并且在运行时有效。但是这样只是标注了，如何读取这个标注的信息？

在LoggerAspect中加入这一个方法：

``` java

/**
 * @param point
 * @return
 * @throws Throwable
 */
@Around("@annotation(com.springboot.demo.annotation.Logger)")
public Object getMethodExecuteTimeForLogger(ProceedingJoinPoint point) throws Throwable {
    System.out.println("---------------getMethodExecuteTime------------------");
    long startTime = System.currentTimeMillis();
    Object result = point.proceed();
    long endTime = System.currentTimeMillis();
    long executeTime = endTime - startTime;
    System.out.println("executeTime=" + executeTime + "------------------");
    return result;
}

```

哪个方法需要记录执行时间就将@Logger放在对应的方法上：

``` java
@Logger
public void getUser() {
    System.out.println("getUser() has been called");
}
```
