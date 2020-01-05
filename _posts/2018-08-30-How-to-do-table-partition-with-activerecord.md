---
layout: post
title: How to do table partition with activerecord
subtitle:
tags: table partition
---

It is a time to do table partition when the data size of the table cannot fit in memory. Partitioning refers to splitting what is logically one large table into smaller physical pieces. It makes it more efficient to query small amount of data in a large table.

Suppose we have many shops and each shop has many orders. We want to do partition in order table by every 100 shop. That means orders of shop 1 ~ 100 are saved in partition 1. And orders of shop 101 ~ 200 are saved in partition 2.

First create shops table and orders table. Then create table orders_partition1, which inherits orders table and add a check to check shop id is between 1 to 100. Remember to add index to orders_partition1. Table inheritance doesn't inherit index.

```ruby
class CreateTables < ActiveRecord::Migration
  def change
    create_table :shops
    create_table :orders do |t|
      t.references :shop
    end

    sql = %(
        CREATE TABLE IF NOT EXISTS orders_partition1 (
          CHECK ( shop_id BETWEEN 1 AND 100 )
        ) INHERITS (orders);
      )
    ActiveRecord::Base.connection.execute(sql)
    add_index 'orders_partition1', :shop_id
  end
end
```

The order class has a class method - partition_class, which returns new anonymous class inherits orders but table is point to the partition.

```ruby
class Order < ActiveRecord::Base
  belongs_to :shop

  def self.partition_class(partition)
    Class.new(Order) do
      self.table_name = "orders_partition#{partition}"
    end
  end
end

Order.partition_class(1).table_name
# => orders_partition1
```

Define orders instance method in shop class, which decides the partition by shop id. Add we can use it as normal has_many relation!

```ruby
class Shop < ActiveRecord::Base
  def orders
    Order.partition_class(orders_partition).where(shop_id: id)
  end

  def orders_partition
    (id / 100) + 1
  end
end

shop = Shop.find 1
shop.orders
# SELECT orders FROM orders_partition1 WHERE shop_id is 1;
shop.orders.create
# INSERT INTO orders_partition1 shop_id VALUES 1;
```

### Reference

PostgreSQL Partitioning: https://www.postgresql.org/docs/9.4/static/ddl-partitioning.html