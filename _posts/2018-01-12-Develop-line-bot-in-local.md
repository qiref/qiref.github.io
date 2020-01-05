---
layout: post
title: Develop line-bot in local !
subtitle:
tags: line-bot sinatra rerun
---

Line bot 官方教學介紹了如何把應用部署（deploy）到 Heroku 上，但是開發時如何在本地端（local）測試卻沒有著墨，本文介紹一下如何設定本地端的開發環境，我使用了 `sinatra` gem as server, `rerun` gem 來讀取每一次的修改。步驟如下

# Add dependencies to Gemfile

```ruby
  # Gemfile
  source 'https://rubygems.org'
  gem 'sinatra'
  gem 'line-bot-api'
  gem 'rerun'
```

執行 `bundle install` 安裝套件

# Add app.rb

```ruby
  # app.rb
  require 'sinatra'   # gem 'sinatra'
  require 'line/bot'  # gem 'line-bot-api'

  def client
    @client ||= Line::Bot::Client.new { |config|
      config.channel_secret = ENV["LINE_CHANNEL_SECRET"]
      config.channel_token = ENV["LINE_CHANNEL_TOKEN"]
    }
  end

  # index for test
  get '/' do
    'Hello world!'
  end

  # line-bot callback
  post '/callback' do
    body = request.body.read

    signature = request.env['HTTP_X_LINE_SIGNATURE']
    unless client.validate_signature(body, signature)
      error 400 do 'Bad Request' end
    end

    events = client.parse_events_from(body)

    events.each { |event|
      case event
      when Line::Bot::Event::Message
        case event.type
        when Line::Bot::Event::MessageType::Text
          message = {
            type: 'text',
            text: event.message['text']
          }
          client.reply_message(event['replyToken'], message)
        end
      end
    }

  "OK"
end
```

`ENV['LINE_CHANNEL_SECRET']`, `ENV['LINE_CHANNEL_TOKEN']` 記得修改，可以到 line-bot 後台取得，在後台顯示的欄位名稱分別為 `Channel secret`, `Channel access token`

# Start app in local

```sh
  rerun app.rb # 啟動 sinatra server, 一但檔案有修改會自動重啟
```

前往 `http://localhost:4567` ，網頁會顯示 Hello World!，可以任意修改 index 的內容，確認伺服器會讀取修改的內容。

# Download ngrok to expose local server

為了讓 local server 能被 line webhook 找到，前往 https://ngrok.com 下載 `ngrok`，下載後解壓縮，執行 `./ngrok http 4567` ，其中 4567  localhost 的 port，terminal 畫面會顯示：

```sh
ngrok by @inconshreveable                                                 (Ctrl+C to quit)

Session Status                online
Version                       2.2.8
Region                        United States (us)
Web Interface                 http://127.0.0.1:4040
Forwarding                    http://91e93df4.ngrok.io -> localhost:4567
Forwarding                    https://91e93df4.ngrok.io -> localhost:4567

Connections                   ttl     opn     rt1     rt5     p50     p90
                              3       0       0.00    0.00    35.17   35.45

HTTP Requests
-------------
```

# Set Line Webhook URL

記下前一步 Forwarding https://xxxx.ngrok.io 的位置，並到 line-bot 後台設定 Webhook URl，設定完記得 Verify ，成功就可以在本地端開發囉！ 例如修改 app.rb 中的

```ruby
  message = {
    type: 'text',
    # text: event.message['text]
    text: 'I am in local!'
  }
```

就可以看到 line-bot 的回傳 `I am in local!` 訊息。
