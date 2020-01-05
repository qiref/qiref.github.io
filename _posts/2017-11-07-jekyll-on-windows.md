---
layout: post
title: Jekyll on Windows
tags: jekyll windows
---

之前 fork 了 [barryclark/jekyll-now](https://github.com/barryclark/jekyll-now)，很輕鬆的就能開始自己的 blog ，但 blog theme 的調整總不能一直在 github 上調整，還是 local 測試方便些，就開始嘗試如何在 windows 上跑起 jekyll server。

根據 Jekyll 官網的 [Jekyll on Windows](https://jekyllrb.com/docs/windows/) 教學，使用 Bash on Ubuntu on Windows，執行 `gem install jekyll bundler`，然後可以執行 `jekyll server` 開啟 server，中間跳了卻少某些 gem 的錯誤訊息，照著指示安裝沒問題，但最後一個問題: 

```
Incremental build: disabled. Enable with --incremental
    Generating...
    done in 0.417 seconds.
    Auto-regeneration may not work on some Windows versions.
    Please see: https://github.com/Microsoft/BashOnWindows/issues/216           
    If it does not work, please upgrade Bash on Windows or run Jekyll with --no-watch.
```

是 windows 執行 jekyll 才會發生的問題，在執行 `gem install wdm` 安裝額外的 gem，原因可參考 [jekyll-windows](http://jekyll-windows.juthilo.com/4-wdm-gem/)，然後執行 `jekyll server --force-polling` 即可。

### 參考資料
* [Jekyll on Windows](https://jekyllrb.com/docs/windows/)
* [Run Jekyll on Windows](http://jekyll-windows.juthilo.com/4-wdm-gem/)
* [jekyll server not working on windows subsystem for linux](https://github.com/jekyll/jekyll/issues/5233)
