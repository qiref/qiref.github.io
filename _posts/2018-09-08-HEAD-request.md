---
layout: post
title: HEAD request
subtitle:
tags: HEAD request
---

The HTTP `HEAD` method requests the headers of the specified resource. It is useful to get the information such as content type and content length before deciding to download a large resource.

I have a problem to handle image uploaded from user through url. It is a gif about 20 MB, which is over 2 MB limit in specification. I use gem [carrierwave](https://github.com/carrierwaveuploader/carrierwave) to handle file upload things. Carrierwave also provide a validation in file size. But the validation is happened after the file is downloaded in server. It takes my server almost 40 seconds to download the 20 MB gif and my server cannot process any request in that period. User's browser also shows 503 service temporarily unavailable.

Every things seems bad, but thanks to HEAD request, it saves my world! We can make a `HEAD` request and get the content length. Then we can decide whether to download it or not.

## HEAD request with Curl

```sh
curl -I https://cdn.pixabay.com/photo/2018/08/27/23/30/pumpkin-3636243_960_720.jpg

HTTP/2 200
server: nginx/1.13.5
date: Sat, 08 Sep 2018 12:44:53 GMT
content-type: image/jpeg
content-length: 136029
last-modified: Mon, 27 Aug 2018 21:31:05 GMT
etag: "5b846d99-2135d"
cache-control: no-cache, must-revalidate
accept-ranges: bytes
```

## HEAD request with Ruby

```ruby
require 'net/http'

uri = URI('https://cdn.pixabay.com/photo/2018/08/27/23/30/pumpkin-3636243_960_720.jpg')

http = Net::HTTP.new(uri.host, uri.port)
http.use_ssl = true if uri.scheme = 'https'
headers = http.head(uri.path)

headers.content_type
# => "image/jpeg"
headers.content_length
# => 136029
```

### Reference

HEAD https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods/HEAD
