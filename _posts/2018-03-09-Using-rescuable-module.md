---
layout: post
title: Using rescuable module
subtitle:
tags: rescuable
---

[ActiveSupport::Rescuable](http://api.rubyonrails.org/classes/ActiveSupport/Rescuable.html) support easier exception handling. That's often appears in controllers. For example:

```ruby
class ApplicationController < ActionController::Base
  rescue_from ActiveRecord::RecordNotFound, with: :not_found

  private

  def not_found
    head :not_found
  end
end
```

If we want to use Rescuable module, just include it in class, and make code more clean. Use service object as an example.

```ruby
class Service
  include ActiveSupport::Rescuable

  rescue_from ActiveRecord::RecordNotFound, with: :error_handler
  rescue_from AnotherError, with: :another_error_handler

  class Error < StandardError; end

  def initialize(params)
    @params = params
  end

  def execute
    # business logic here
  end

  private

  def error_handler
    # handle error here, maybe raise your custom error
    raise Service::Error, 'message'
  end
end

# usage:
class SomeController < ActionController::Base
  def some_action
    Service.new(params).execute
    head :ok
  rescue Service::Error => exception
    Rails.logger.error exception
    head :not_found
  end
end
```

Use service seems complicate the code, but it extract business logic from controller. The responsibility of controller is handle routeing service, service error and response status. The service handles the business logic.
