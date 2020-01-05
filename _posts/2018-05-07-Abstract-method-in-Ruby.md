---
layout: post
title: Abstract method in Ruby
subtitle:
tags: abstract-method
---

Abstract method (or interface) defined the method (interface) that should be implemented in the child class. In ruby, there is no abstract method or interface. But we can do some trick to achieve the same goal.

```ruby
class AbstractClass
  def public_method
    abstract_method
  end

  private

  def abstract_method
    raise NotImplementedError, 'You should implement abstract_method when extend AbstractClass'
  end
end

Child.new.public_method
# => NotImplementedError (You should implement abstract_method when extend AbstractClass)

class Child < AbstractClass
  private

  def abstract_method
    'implemented method'
  end
end

ChildB.new.public_method
# => "implemented method"
```

Define abstract_method or interface in the AbstractClass, and raise the method. The child need to override the abstract_method, otherwise the `NotImplementedError` will raise. Abstract class gives others the information of what they should do when they extend the class. The module also can define abstract_method, just change `extend` to `include`.

```ruby
module AbstractModule
  def public_method
    abstract_method
  end

  private

  def abstract_method
    raise NotImplementedError, 'You should implement abstract_method when include AbstractModule'
  end
end

class Child
  include AbstractModule
end

Child.new.public_method
# => NotImplementedError (You should implement abstract_method when include AbstractModule)

class Child
  include AbstractModule

  private

  def abstract_method
    'implemented method'
  end
end

Child.new.public_method
# => implemented method
```