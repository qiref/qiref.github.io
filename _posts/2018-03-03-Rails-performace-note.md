---
layout: post
title: Rails Performance Note
subtitle:
tags: rails performance
---

Note when reading book `The Complete Guild to Rails Performance`.

# ActiveRecord

* Operations on many records
  ```ruby
  # bad
  Rubygem.all.each { | g |
    g.name.upcase!
    g.save
  end

  # good
  # default load 1000 records and update it one by one (1000 SQL UPDATE)
  Rubygem.all.find_each do |g|
    g.name.upcase!
    g.save
  end

  # good
  # default load 1000 records and update it all in one time (1 SQL UPDATE)
  Rubygem.where("downloads > 100").in_batches do |relation|
    relation.update_all(popular_gem: true)
  end

  # Note: Model.update will trigger callback, while Model.update_all skip callbacks
  ```
* N+1 query
* Replace Query Methods With Enumerable
  ```ruby
    # bad
    gem_count = Rubygem.count
    gem_names = Rubygem.pluck(:name)
    "There are #{gem_count} gems, list: #{gem_names}"

    # good
    gem_names = Rubygem.pluck(:name)
    "There are #{gem_names.count} gems, list: #{gem_names}"
  ```
* Select Only What You Need
  ```ruby
    # target: get all gem names
    # bad
    Rubygem.all.map(&name)

    # good
    Rubygem.all.select(:name).map(&name)

    # better
    Rubygem.pluck :name
  ```
* Take it Easy With Lazy Loading
  * `eager_load`, use `LEFT OUTER JOIN`
  * `preload`, the slowest of all the eager loading method
  * `includes`, decide for you to use `eager_load` or `preload`
* Do Math In The Database
  ```ruby
    # bad
    downloads = Rubygem.pluck(:download)
    average = downloads.sum / downloads.count

    # good
    Rubygem.average(:download).to_i
  ```
  Other methods in [`ActiveRecord::Calculations`](http://api.rubyonrails.org/classes/ActiveRecord/Calculations.html) : `average, calculate, count, ids, maximum, minimum, pluck, sum`
* Don't Use Many Queries When One Will Do
  * bulk insert data: use gem [`activerecord-import`](https://github.com/zdennis/activerecord-import)
  * `update_all`, `destroy_all` will do one SQL statement

# Background Job

* Idempotent
  ```ruby
    class UserSignupMailJob < ActiveJob::Base
      queue_as :default

      around_perform do |job, block|
        user = job.arguments.first
        user.with_lock do
          return if user.signup_email_sent
          if block.call
            user.update_attributes(signup_email_sent: true)
          else
            retry_now # or implement your own backoff procedure
          end
        end
      end

      def perform(user)
        UserMailer.signup_email(to: user).deliver
      end
    end
  ```