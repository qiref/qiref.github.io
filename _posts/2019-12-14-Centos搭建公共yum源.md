---
layout: post
title:  "centos搭建公共yum源"
date:   2020-01-04 00:18:23 +0700
categories: [linux]
---

本文内容：将中缀表达式转化为后缀表达式。
------

部署yum私服
上传centos镜像文件到服务器

```sh
mount -t iso9660 -o loop
centos-7-x86_64-dvd-1511.iso /mnt/cdrom/
```

（卸载：umoutn /mnt/cdrom)

挂载成功！
将软件链接到http服务发布路径下
确定当前服务器是否安装了httpd服务

``` sh 
ln -s /mnt/cdrom/ /var/www/html/CentOS7 
```

检查http服务

``` sh 
systemctl status httpd.service 
```

启动HTTP服务器

``` sh
systemctl enable httpd.service
systemctl start httpd.service
```

界面查看

``` sh
cd /etc/yum.repos.d/
mkdir bak
mv centos-* bak
vi CentOS-Base.repo

[base]
name=CentOS-$releasever - Base
baseurl=http://192.168.67.15/CentOS7/
gpgcheck=1
gpgkey=file:///etc/pki/rpm-gpg/RPM-GPG-KEY-CentOS-7
```

分发到所有服务器

``` sh
scp -r /etc/yum.repos.d/  hadoop-01:/etc/
scp -r /etc/yum.repos.d/  hadoop-02:/etc/
```
检查是否正成功安装yum 源

```sh
yum clean all
yum makecache
yum list
``

>**版权声明**：本作品采用<a rel="license" href="http://creativecommons.org/licenses/by-nc-sa/4.0/">[CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/)进行许可，转载请注明出处。
>
>**作者**： YaoQi.
>
>**时间**： 2020-01-04 00:18:23.
