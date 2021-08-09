---
layout: post
title:  "Git-rebase用法.md"
date:   2021-08-09 00:18:23 +0700
categories: [Git]
tags:  Git
comments: true
---

摘要：Git rebase 的使用方法。

------

## commit 合并

当多个commit存在时，提交MR会出现很多的commit，review会很困难，这时可以将多个commit合并为一个commit。

命令说明：

``` shell
git rebase -i  [startpoint]  [endpoint] 
```

其中-i的意思是--interactive，即弹出交互式的界面让用户编辑完成合并操作，[startpoint] [endpoint] 则指定了一个编辑区间，如果不指定[endpoint]，则该区间的终点默认是当前分支HEAD所指向的commit(注：该区间指定的是一个前开后闭的区间)。
在查看到了log日志后，我们运行以下命令：

``` shell
git rebase -i 36224db
or
git rebase -i HEAD~3 # 合并最近三次commit

```
每一个commit id 前面的pick表示指令类型，git 为我们提供了以下几个命令:
pick：保留该commit（缩写:p）
reword：保留该commit，但我需要修改该commit的注释（缩写:r）
edit：保留该commit, 但我要停下来修改该提交(不仅仅修改注释)（缩写:e）
squash：将该commit和前一个commit合并（缩写:s）
fixup：将该commit和前一个commit合并，但我不要保留该提交的注释信息（缩写:f）
exec：执行shell命令（缩写:x）
drop：我要丢弃该commit（缩写:d）



### 示例

``` shel
git log

commit 4ab2734f3380fbdace8620f461cd04c7993b6b0b (HEAD -> master)
Author: archieyao <archieyao@tencent.com>
Date:   Mon Aug 9 16:38:25 2021 +0800

    add something 2

commit 60d0bbbe094c0b93903ab995879d30246bbf331e
Author: archieyao <archieyao@tencent.com>
Date:   Mon Aug 9 16:38:02 2021 +0800

    add something 1

commit 1c3c12316449cf4f340c68e22c70caa60178ba5c
Author: archieyao <archieyao@tencent.com>
Date:   Mon Aug 9 16:37:43 2021 +0800

    add something

commit 7a9ab6f445ce0c7525a5dce3ca15fe600282553b
Author: archieyao <archieyao@tencent.com>
Date:   Mon Aug 9 09:31:11 2021 +0800

    [update] readme
```



现在合并最近三次的commit。



``` shell
git rebase -i 7a9ab6f445ce0c7525a5dce3ca15fe600282553b

pick 1c3c123 add something
s 60d0bbb add something 1
s 4ab2734 add something 2

# Rebase 7a9ab6f..4ab2734 onto 7a9ab6f (3 commands)
#
# Commands:
# p, pick <commit> = use commit
# r, reword <commit> = use commit, but edit the commit message
# e, edit <commit> = use commit, but stop for amending
# s, squash <commit> = use commit, but meld into previous commit
# f, fixup <commit> = like "squash", but discard this commit's log message
# x, exec <command> = run command (the rest of the line) using shell
# b, break = stop here (continue rebase later with 'git rebase --continue')
# d, drop <commit> = remove commit
# l, label <label> = label current HEAD with a name
# t, reset <label> = reset HEAD to a label
# m, merge [-C <commit> | -c <commit>] <label> [# <oneline>]
# .       create a merge commit using the original merge commit's
# .       message (or the oneline, if no original merge commit was
# .       specified). Use -c <commit> to reword the commit message.
#
# These lines can be re-ordered; they are executed from top to bottom.
#
# If you remove a line here THAT COMMIT WILL BE LOST.
#
# However, if you remove everything, the rebase will be aborted.
```



然后继续编辑，选择commit message，删除后两次的commit message。

``` shell
# This is a combination of 3 commits.
# This is the 1st commit message:

add something

# This is the commit message #2:

add something 1 # 删除这行

# This is the commit message #3:

add something 2  # 删除这行

# Please enter the commit message for your changes. Lines starting
# with '#' will be ignored, and an empty message aborts the commit.
#
# Date:      Mon Aug 9 16:37:43 2021 +0800
#
# interactive rebase in progress; onto 7a9ab6f
# Last commands done (3 commands done):
#    squash 60d0bbb add something 1
#    squash 4ab2734 add something 2
# No commands remaining.
# You are currently rebasing branch 'master' on '7a9ab6f'.
#
# Changes to be committed:
#       modified:   README.md
```



保存退出后，可以看到输出信息：



``` shel
[detached HEAD 98eef0d] add something
 Date: Mon Aug 9 16:37:43 2021 +0800
 1 file changed, 8 insertions(+)
Successfully rebased and updated refs/heads/master.
```



## 同步master代码

开发时，从master上checkout一个dev分支，开发一段时间后，master上的代码有更新，这时从master上拉取更新。

``` shell
git rebase origin master
# 等价于 git pull origin master --rebase
git rebase --continue
git rebase --abort
```

在rebase的过程中，也许会出现冲突(conflict)，在这种情况，Git会停止rebase并会让你去解决冲突；

在解决完冲突后，用```git-add```去更新这些内容的索引(index)， 然后，你无需执行 git-commit,只要执行: ``` git rebase --continue ```这样git会继续应用(apply)余下的补丁。

在任何时候，你可以用``` git rebase --abor```t来终止rebase的行动，并且"mywork" 分支会回到rebase开始前的状态。

git merge 与 git rebase 的最终效果是一致的，但git merge会产生合并记录，使用git rebase 会让分支看起来没有合并一样。




------
