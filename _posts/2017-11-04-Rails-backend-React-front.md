---
layout: post
title: Rails 後端 React 前端開發環境設置
tags: react rails
---

Rails 後端搭配 React 前端，有不少 gem 可以使用，[react-rails](https://github.com/reactjs/react-rails)、[react_on_rails](https://github.com/shakacode/react_on_rails)。react-rails 透過 rails 內建的 asset pipeline 完成 react jsx 編譯，react_on_rails 則透過 webpack 來進行編譯，使用上會有些許差異。

工作上使用版本較舊的 rails，搭配前述的 gem 都會被版本 dependency 限制住，想要使用最新的 react, webpack hot reloading, js es6 語法，就會因為被版本限制住而無法使用。採取的方法為前後端分離，後端為 rails project，前端為 node project，deploy 時再將編譯好的 js 檔案移到 rails asset 下。

## 環境建置 (前後端完全分離)

使用 [create-react-app](https://github.com/facebookincubator/create-react-app) 快速建立前端環境，預設會在 `localhost:3000` 起 webpack server，將 rails 起在 `localhost:4000` 提供 api 服務，在 `package.json` 檔內加上 `"proxy": "http://localhost:4000/"`，環境就建置好了！

## 環境建置 (舊有前端加入 react)

想在舊有的 rails 前端頁面加入 react 需做些設定。開啟 webpack dev server 後可以在 [localhost:3000/static/js/bundle.js](http://localhost:3000/static/js/bundle.js) 看到編譯好的 js 檔案，在欲加入 react 的頁面加上

```ruby
- if Rails.env.development?
    script(src="http://localhost:3000/static/js/bundle.js")
- else
    = javascript_include_tag 'filename.js'
```

開發時使用 webpack server 編譯的檔案，正式環境則使用編譯好的檔案。

設定完開啟頁面，在 console 發現錯無訊息 <br>
`The development server has disconnected. Refresh the page if necessary.`<br>
到 `/node_modules/react-dev-utils/webpackHotDevClient.js` 修改 hostname and port 設定，就可以正常 hot reload 了。

```javascript
// Connect to WebpackDevServer via a socket.
var connection = new SockJS(
  url.format({
    protocol: window.location.protocol,
    hostname: window.location.hostname, // change to 'localhost',
    port: window.location.port, // change to 3000
    // Hardcoded in WebpackDevServer
    pathname: '/sockjs-node',
  })
);
```

Deploy 時，先執行 `yarn build (or npm build)` 進行 js 編譯優化，檔案位於 `/build/static/js/main.[hash].js`，將檔案移至 rails asset 下的位置即可。
