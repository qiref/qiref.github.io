---
layout: post
title: How to fix randomly failed test
subtitle:
tags: test rspec
---

Have you ever met the situation: sometimes continuous integration reports success, but sometimes it reports failure? The tests fail occasionally and it is hard to find the root cause. When running test individually, it seems every thing is all right. But when running all together, result becomes unpredictable. The cause is the order dependent on tests. Let's see an example.

Note: This article focus on tests run in random order. If tests are always run in the same order, the cause is beyond the scope.

### Unstable test example:

Suppose we have a class named `Calculator`, and what it does is add two numbers. We have `calculator_1_spec` to test `add` class method.

```ruby
# services/calculator.rb
class Calculator
  def self.add(x, y)
    x + y
  end
end

# spec/services/calculator_1_spec.rb
describe Calculator do
  it 'adds numbers' do
    expect(Calculator.add(1, 2)).to eq 3
  end
end
```

In another day, we add another spec `calculator_2_spec`. The spec monkey patching `Calculator.add` then test it. Although that monkey patching makes no sense, it just represents a bug in tests. In the real world, the bug may be caused by changing global setting, constant rewriting or something else.

```ruby
# spec/services/calculator_2_spec.rb
describe Calculator do
  it 'monkey patching adds numbers' do
    # monkey patching Calculator, which will affect examples that are executed after this test
    def Calculator.add(x, y)
      x - y
    end

    expect(Calculator.add(1, 2)).to eq -1
  end
end
```

Run `calculator_2_spec` and `calculator_1_spec` individually, both tests will pass. Run `calculator_1_spec` first then `calculator_2_spec`, the tests pass, too. Only when running `calculator_2_spec` first then `calculator_1_spec`, the tests will fail. This type of bug is order dependent.

There may be thousands of tests in an application. It is impossible to run all the combination of order manually. Thanks to `RSpec`, it handle this for us. We can run `rspec` with `--bisect` option to find the minimal set of examples that reproduce the same failures.

RSpec will repeatedly run subsets of tests in order to isolate the minimal set of tests that reproduce the same failures. If there are many tests, it takes a long time to run. Press `Ctrl + C` to abort it and it will provide the most minimal reproduction commands it has discovered so far. The result of the example is:

```sh
rspec --seed 39150 --bisect
Bisect started using options: "--seed 39150"
Running suite to find failures... (9.74 seconds)
Starting bisect with 1 failing example and 45 non-failing examples.
Checking that failure(s) are order-dependent... failure appears to be order-dependent

Round 1: bisecting over non-failing examples 1-45 .. ignoring examples 24-45 (4.59 seconds)
Round 2: bisecting over non-failing examples 1-23 .. ignoring examples 13-23 (4.12 seconds)
Round 3: bisecting over non-failing examples 1-12 .. ignoring examples 7-12 (3.43 seconds)
Round 4: bisecting over non-failing examples 1-6 . ignoring examples 1-3 (1.48 seconds)
Round 5: bisecting over non-failing examples 4-6 .. ignoring example 6 (2.91 seconds)
Round 6: bisecting over non-failing examples 4-5 .. ignoring example 5 (2.85 seconds)
Bisect complete! Reduced necessary non-failing examples from 45 to 1 in 20.77 seconds.

The minimal reproduction command is:
  rspec './spec/services/calculator_1_spec.rb[1:1]' './spec/services/calculator_2_spec.rb[1:1]' --seed 39150
```

The result shows the minimal reproduction command. That help us focus on these files and the executed order to locate the bug.

### Reference

RSpec Bisect https://relishapp.com/rspec/rspec-core/docs/command-line/bisect