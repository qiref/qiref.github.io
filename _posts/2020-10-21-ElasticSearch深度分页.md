---
layout: post
title:  "ElasticSearch深度分页"
date:   2020-10-27 10:18:23 +0700
categories: [ElasticSearch]
tags:  ElasticSearch
comments: true
---

## 深度分页问题

当使用ElasticSearch进行深度分页时，会导致无法返回数据。

```
GET a75dce0dd75c4da0aecd90585fe064a0b-2020-09/_search
{
  "from": 10000, 
  "size": 20, 
  "query": {
    "match_all": {}
  }
}
```

报错结果如下：

```
Result window is too large, from + size must be less than or equal to: [10000] but was [10020]. See the scroll api for a more efficient way to request large data sets. This limit can be set by changing the [index.max_result_window] index level setting.

```

错误信息的意思是结果窗口过大，超过10000最大的限制，并且给出“more efficient way”，使用scroll api。

## scoll api

scoll api 原理就是把每一个数据集分为多个批次，然后缓存住下一批的数据，每次只需要通过批次的ID就能拿到下一批的数据。

```
GET a75dce0dd75c4da0aecd90585fe064a0b-2020-09/_search?scroll=1m
{
  "size": 100,
  "query": {
    "match_all": {}
  }
}
```

结果：

```
{
  "_scroll_id" : "DnF1ZXJ5VGhlbkZldGNoBQAAAAAA11ERFjhvNzdOZmNKUXRhT1g2UGNkWGU0ZEEAAAAAANdREhY4bzc3TmZjSlF0YU9YNlBjZFhlNGRBAAAAAACzOyMWN184MGl2QkZReTZSaG1iMk4wQzR2ZwAAAAAAvLxKFlBxSjZCbmhPVEppOHhDV255YW1MOVEAAAAAALy8SRZQcUo2Qm5oT1RKaTh4Q1dueWFtTDlR",
  "took" : 14,
  "timed_out" : false,
  "_shards" : {
    "total" : 5,
    "successful" : 4,
    "skipped" : 0,
    "failed" : 1,
    
    ...
```

然后找下一批：

```
GET /_search/scroll
{
  "scroll":"1m",
  "scroll_id":"DnF1ZXJ5VGhlbkZldGNoBQAAAAAAG53JFmRtR1BkSFVxVEx1N0tIS25OU1hSOWcAAAAAANVRbxY0SXFwUkFXQlN3LVNHV3FBY051SjBnAAAAAADZvrIWbzVzb3RHUTJRUC1zNFhuaU5ZbDVlUQAAAAAA1VFwFjRJcXBSQVdCU3ctU0dXcUFjTnVKMGcAAAAAANm-sxZvNXNvdEdRMlFQLXM0WG5pTllsNWVR"
}
```

其实局限性很高，而且很复杂，主要总结为三点：

1. 缓存时间问题，缓存时间1m，然后超过这个时间再去找下一批就会报错。
2. 找下一批的过程问题，找下一批查询语句就完全换了，甚至不需要设置index，通过scrollid就能直接找到下一批数据。
3. 不支持跳页，限定死了一个批次后就只能使用这个窗口大小了。


## search_after

search_after是通过排序字段将数据进行排序，分页就根据最后一条数据的排序字段，找到下一页的起始位置。

```
GET a75dce0dd75c4da0aecd90585fe064a0b-2020-09/_search
{
  "size": 20, 
    "query": {
    "match": {
      "text": "情况"
    }
  },
  "sort": [
    {
      "_id":{
        "order": "desc"
      }
    }
  ]
}
```

在加上排序字段后，在搜索的结果中都存在sort的字段：

```
"sort" : [
          "9138a157c4b34b77"
        ]
```

然后找下一页就将这个字段值传给search_after, 值得注意的是：当使用search_after时，from需要设置为0或者-1。

```
GET a75dce0dd75c4da0aecd90585fe064a0b-2020-09/_search
{
  "size": 20, 
    "query": {
    "match": {
      "commonText.cn": "情况"
    }
  },
  "sort": [
    {
      "_id":{
        "order": "desc"
      }
    }
  ],
  "search_after":[
    "913867bebd26d6db"
  ]
    
}
```

通过以上的使用方式，问题就来了：

1. 如果通过```_id```去排序，那么默认按照```_score```倒序排序的顺序就被打乱了，那么这里的```match```还有什么作用呢？
2. 这里都是通过```sort```后的值去找下一页，那么上一页怎么办？
3. 跳页怎么解决？

* 问题一

解决这个问题多尝试一下就可以了，```sort```是可以接收多个排序字段的，既然这里可以用```_id```去排序，那也可以用```_score```字段去排序，但同时，也需要在```search_after```中加上```_score```的值。

```
GET a75dce0dd75c4da0aecd90585fe064a0b-2020-09/_search
{
  "size": 100, 
  "query": {
    "match": {
      "commonText.cn": "情况"
    }
  },
  "sort": [
    {
      "_score": {
        "order": "desc"
      },
      "_id":{
        "order": "desc"
      }
    }
  ],
  "search_after":[
     6.022893,
    "95d24ddd72c32fff"
    ]
}
```

在尝试解决这个问题时，发现```search_after```中最多只能接收两个参数，所以局限性就有了，超过2个字段排序，这个```search_after```就无法使用了。

* 问题二

如何找上一页？ ```search_after```找下一页是通过上一页最后一条数据```sort```字段的值，那上一页就需要找到上上一页的```sort```字段的值，依次类推，因此，在使用```search_after```时，如果想往前跳N页，需要记住前N+1页的```sort```字段的值，但不建议这个N过大。

* 问题三

跳页可以通过调大```size```参数，假如跳N页，就```size```的值为 ```N*size```，然后取结果集中的后```size```条，就能达到跳页效果，但不建议这个N过大。

------

