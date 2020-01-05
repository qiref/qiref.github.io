---
layout: post
title: RSpec benchmark
subtitle: use RSpec to test algorithm's efficiency
tags: RSpec benchmark
---

演算法的寫法百百種，哪一種比較有效率，使用高階程式語言撰寫的話很難直接給出個答案，畢竟 API 內部怎麼實作的就去需要去了解 source code 了，不如直接設置個環境，讓每一種做法去跑跑看(黑箱測試)，同樣能得出答案，想說最近在寫 Rspec，就用 Rspec 來寫個 algorithms benchmark 。

# 測試演算法

演算法： 給定一個 product array, 使用 product_id 找出對應的 product。

可能解法：

1. Use array.select
1. Use array.find
1. Use hash (先建立以 product_id 為 key 的 hash，再利用此 hash 找出 product)

## 測試前環境設定 before(:all)

Set product array data and expected result，initial variables

```ruby
  before(:all) do
    @products = JSON.parse(File.read('product_list.json'))
    expected = @products.find {|p| p['id'] == target_id}
    @msg = []
  end
```

## 測試演算法前後設定 before(:each) and after(:each)

Set start_time before each test. Set end_time after each test then calculate algorithm consumed time. Save each test's result message.

```ruby
  before(:each) {@start_time = Time.now}
  after(:each) do
    @end_time = Time.now
    @msg << "Algorithm: '#{@algorithm}' complete in #{(@end_time - @start_time)*1000}ms"
  end
```

## 撰寫 algorithms

Implement algorithm and confirm the output result.

```ruby
  it '' do
    @algorithm = "Use array.select\t"
    result = @products.select {|p| p['id'] == target_id}.first
    expect(result).to eq(expected)
  end
```

## 測試完成後 after(:all)

Summarize data settings and algorithms' performance.

```ruby
  after(:all) do
    puts "\n\nData size: products: #{@products.size}".yellow
    @msg.each {|m| puts m.cyan}
  end
```

完整代碼：

```ruby
# We want to benchmark the time algorithms consumed to
# find a product with id in product array

require 'colorize' # colorize console out

expected = nil   # expected result
target_id = 5888 # target product id

describe 'Find product with id' do
  before(:all) do
    # set test data, read 2873 products data from file
    @products = JSON.parse(File.read('product_list.json'))
    expected = @products.find {|p| p['id'] == target_id}

    # message to be print
    @msg = []
  end

  # set start_time and end_time before/after each test
  # message is algorithm name with consumed time
  before(:each) {@start_time = Time.now}
  after(:each) do
    @end_time = Time.now
    @msg << "Algorithm: '#{@algorithm}' complete in #{(@end_time - @start_time)*1000}ms"
  end

  # Output benchmark result with data size and messages
  after(:all) do
    puts "\n\nData size: products: #{@products.size}".yellow
    @msg.each {|m| puts m.cyan}
  end

  # implement algorithm in each test
  it '' do
    @algorithm = "Use array.select\t"
    result = @products.select {|p| p['id'] == target_id}.first
    expect(result).to eq(expected)
  end

  it '' do
    @algorithm = "Use array.find\t"
    result = @products.find {|p| p['id'] == target_id}
    expect(result).to eq(expected)
  end

  it '' do
    @algorithm = "Use hash\t\t"
    cache = {}.tap do |hash|
      @products.each do |product|
        hash[product['id']] = product
      end
    end
    result = cache[target_id]
    expect(result).to eq(expected)
  end
end

# Output:
#
# Data size: products: 2873
# Algorithm: 'Use array.select  ' complete in 6.162ms
# Algorithm: 'Use array.find    ' complete in 0.127ms
# Algorithm: 'Use hash          ' complete in 5.6579999999999995ms
```

由結果可以看出三種 algorithms 的執行效率差異，當然每次執行時間都會略有差異，不過像 'use array.find' 的效率就遠比 'use array.select' or 'use hash' 好，可以確認 'use array.find' 是此情境下三種演算法中最好的解法。

透過 Rspec ，可以利用 callback 幫忙設定測試環境、設定測試前後及測試完成後的動作，每個 test 中只需專注在演算法內容就好。
