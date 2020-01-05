---
layout: post
title: Count discount code usage
subtitle:
tags: SQL
---

Scenario: User can use `discount_code` to get a discount. System records the `discount_code_usage` every time the user uses. Please write a query to find total usage and this month usage of discount codes of the user.

Table and values:

```sql
CREATE TABLE users (id serial PRIMARY KEY);
CREATE TABLE discount_codes (id serial PRIMARY KEY, code VARCHAR);
CREATE TABLE discount_code_usages (
  user_id INTEGER,
  discount_code_id INTEGER,
  created_at TIMESTAMP
);
INSERT INTO users VALUES (1);
INSERT INTO discount_codes VALUES (1, '10off');
INSERT INTO discount_code_usages VALUES (1, 1, '2019-05-15');
INSERT INTO discount_code_usages VALUES (1, 1, '2019-06-15');
INSERT INTO discount_codes VALUES (2, '20off');
```

First, let's figure out how to query total usage and this month usage of discount code. We can use `COUNT` to get the total usage, and [`COUNT FILTER (filter_clause)`](https://www.postgresql.org/docs/9.4/sql-expressions.html) to get this month usage.

```sql
SELECT
  discount_code_id,
  COUNT(*) AS total_usage,
  COUNT(*) FILTER (
    WHERE created_at BETWEEN '2019-06-01' AND '2019-06-30'
  ) AS month_usage
FROM discount_code_usages
WHERE user_id = 1
GROUP BY discount_code_id;

discount_code_id | total_usage | month_usage
-----------------+-------------+-------------
               1 |           2 |           1
```

If we also want to get the `discount_codes` information, we can left join `discount_codes` with the count result

```sql
SELECT
  discount_codes.*,
  COALESCE(usage_data.total_usage, 0) as total_usage,
  COALESCE(usage_data.month_usage, 0) as month_usage
FROM discount_codes LEFT JOIN LATERAL (
  SELECT discount_code_id,
  COUNT(*) AS total_usage,
  COUNT(*) FILTER (
    WHERE created_at BETWEEN '2019-06-01' AND '2019-06-30'
  ) AS month_usage
  FROM discount_code_usages
  WHERE
    user_id = 1 AND
    discount_code_usages.discount_code_id = discount_codes.id
  GROUP BY discount_code_id
) AS usage_data ON usage_data.discount_code_id = discount_codes.id;

id | code  | total_usage | month_usage
---+-------+-------------+-------------
 1 | 10off |           2 |           1
 2 | 20off |           0 |           0
```

[`COALESCE`](https://www.postgresql.org/docs/9.5/functions-conditional.html) returns the first of its arguments that is not null. Fallback the usage to 0 if there is no discount code usage. Note the `LATERAL` after the `LEFT JOIN`. Since we reference `discount_codes.id` in the subquery condition `discount_code_usages.discount_code_id = discount_codes.id`, we need to specify `LATERAL` to let the query work. The subquery condition makes sure we only count the discount code usage we need rather than all discount code usages in the table.

## How to do it in Rails

```ruby
class DiscountCode < ApplicationRecord
  scope :with_usage_for_user, ->(user) { WithUsageForUserScope.new(user).perform }
end

class DiscountCode
  class WithUsageForUserScope
    def initialize(user)
      @user = user
      @now = Time.current
    end

    def perform
      DiscountCode.
        joins(join_statement.squish).
        select(select_statement.squish)
    end

    private

    def join_statement
      <<-SQL
        LEFT OUTER JOIN LATERAL(
          SELECT
            discount_code_id,
            COUNT(*) as total_usage,
            COUNT(*) FILTER (
              WHERE created_at BETWEEN '#{month_start}' AND '#{month_end}'
            ) as month_usage
          FROM discount_code_usages
          WHERE
            user_id = #{@user.id} AND
            discount_code_usages.discount_code_id = discount_codes.id
          GROUP BY discount_code_id
        ) as usage_data ON usage_data.discount_code_id = discount_codes.id
      SQL
    end

    def select_statement
      <<-SQL
        discount_codes.*,
        COALESCE(usage_data.month_usage, 0) as month_usage,
        COALESCE(usage_data.total_usage, 0) as total_usage
      SQL
    end

    def month_start
      @now.beginning_of_month.utc
    end

    def month_end
      @now.end_of_month.utc
    end
  end
end

# usage
DiscountCode.with_usage_for_user(User.last).all
# chain with other condition
DiscountCode.with_usage_for_user(User.last).where(id: 1)
# [
#     [0] #<DiscountCode:0x00007fcfc9453a58> {
#                  "id" => 1,
#                "code" => "10off",
#         "month_usage" => 1,
#         "total_usage" => 2
#     }
# ]
```
