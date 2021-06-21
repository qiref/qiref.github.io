---
layout: post
title:  "Go语言实现httpServer"
date:   2021-06-21 10:18:23 +0700
categories: [Go]
tags:   Go
comments: true
---

摘要：使用Go语言原生包实现Http Server。

------

## 启动一个Http Server 

使用Go语言原生的net/http库可以很简单实现一个http server。

``` go
log.Println("start server")
if err := http.ListenAndServe(":8080", nil); err != nil {
	log.Println("start server on 8080")
}
log.Fatal("start server failed.")
```

没错，只要这么几行代码，就开启了一个http server，监听8080端口。

## 接收Http请求

### http.HandleFunc

开启了Http server后，无法处理Http请求这个就是个空的Server，下面给它加上处理Http Request的能力。

``` go
func init() {
	log.Println("start server")
	http.HandleFunc("/hello_world", HelloWorld)
	if err := http.ListenAndServe(":8080", nil); err != nil {
		log.Println("start server on 8080")
	}
	log.Fatal("start server failed.")
}

func HelloWorld(w http.ResponseWriter, r *http.Request) {
	_, err := w.Write([]byte("hello world"))
	if err != nil {
		log.Println(err)
	}
}
```

`http.HandleFunc("/hello_world", HelloWorld)` 这行代码指定了一个路由对应的方法，然后访问<http://127.0.0.1:8080/hello_world> 可以得到hello world的字符串，这段字符串也是`HelloWorld(w http.ResponseWriter, r *http.Request)` 函数的输出。

### http.Handle

``` go
func init() {
	log.Println("start server")
	http.HandleFunc("/hello_world", HelloWorld)
	http.Handle("/test_handle", &TestHandleStruct{content: "test handle"})
	if err := http.ListenAndServe(":8080", nil); err != nil {
		log.Println("start server on 8080")
	}
	log.Fatal("start server failed.")
}

type TestHandleStruct struct {
	content string
}

// 实现 Handler interface
func (handle *TestHandleStruct) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	_, err := fmt.Fprintf(w, handle.content)
	if err != nil {
		log.Fatal("response failed")
	}
}
```

还有一种方式可以实现处理http request，就是实现Handle接口，实现接口需要借助TestHandleStruct结构体去实现，定义结构体的方法实现接口方法`ServeHTTP(w http.ResponseWriter, r *http.Request)`

然后访问<http://127.0.0.1:8080/test_handle> 就可以得到test handle字符串。

其实这两种实现方式底层都是一样的：

``` go
// Handle registers the handler for the given pattern
// in the DefaultServeMux.
// The documentation for ServeMux explains how patterns are matched.
func Handle(pattern string, handler Handler) { DefaultServeMux.Handle(pattern, handler) }

// HandleFunc registers the handler function for the given pattern
// in the DefaultServeMux.
// The documentation for ServeMux explains how patterns are matched.
func HandleFunc(pattern string, handler func(ResponseWriter, *Request)) {
	DefaultServeMux.HandleFunc(pattern, handler)
}
```


------