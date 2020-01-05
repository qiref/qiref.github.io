---
layout: post
title: RSpec shared_context and shared_examples
tags: RSpec shared_context shared_examples
---

撰寫 RSpec 測試時，首先要先設定環境(測試資料)，接下來才是撰寫測試腳本，常常會發生不同測試目標(controller, model...)所需的環境雷同(例如都需要建立 user)，每個測試目標都要寫一遍十分麻煩，且也不好維護，這時 RSpec 中的 shared_context 就幫上忙了，可以幫我們在不同目標設定測試環境。另外， shared_examples 測是可以在不同的目標中跑同樣的測試腳本，也可以減少相同的測試腳本，提供易維護性。範例：

```ruby
# RSpec shared_context and shared_examples

shared_context 'load class' do
  let(:greeting) { "Hello, I am class #{@class.name}" }
  before(:each) { @class = described_class }
end

shared_examples 'examples' do
  it 'set instance_variable @class' do
    puts greeting
    expect(@class).to eq(described_class)
  end
end

class A
end

class B
end

describe A do
  include_context 'load class'
  it_behaves_like 'examples'
  # Hello, I am class A
end

describe B do
  include_context 'load class'
  it_behaves_like 'examples'
  # Hello, I am class B
end
```

範例中透過 shared_context 去設定 instance_variable '@class' and helper 'greeting'，而 shared_examples 則使用了在 shared_context 中設定的參數。妥善利用 shared_context and shared_examples 可以讓代碼更加簡潔、易重複使用。

### 參考資料
* [RSpec Shared context](https://relishapp.com/rspec/rspec-core/v/3-7/docs/example-groups/shared-context)
* [RSpec Shared examples](https://relishapp.com/rspec/rspec-core/v/3-7/docs/example-groups/shared-examples)
