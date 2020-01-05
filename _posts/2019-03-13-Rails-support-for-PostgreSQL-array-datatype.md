---
layout: post
title: Rails support for PostgreSQL array datatype
subtitle:
tags: postgres rails
---

Since PostgreSQL 9.3, rails support array datatype. It is convenient to store array of data in one column. For example, product has many tags. We can store tags in one column. Let's create a products table.

```ruby
# db/migrate/20140207133952_create_products.rb
create_table :products do |t|
  t.string :tags, array: true
end
add_index :tags, :tags, using: 'gin'
```

Use cases:

1. Query products which fulfill any of the given tags
1. Query products which fulfill all of the given tags

```ruby
# app/models/product.rb
class Product < ApplicationRecord
  scope :with_tags, ->(tags, operator: :any) do
    if operator == :any
      # any tag fulfill
      where('tags && ARRAY[?]::varchar[]', tags)
    else
      # operator == :equal, all tags fulfill
      where('tags = ARRAY[?]::varchar[]', tags)
    end
  end
end

# Usage
Product.create(tags: ['food', 'promotion'])

Product.with_tags(['food'], operator: :any).count
# 1
Product.with_tags(['promotion'], operator: :any).count
# 1
Product.with_tags(['promotion'], operator: :equal).count
# 0
Product.with_tags(['food', 'promotion'], operator: :equal).count
# 1
Product.with_tags(['food', 'promotion'], operator: :any).count
# 1
```
