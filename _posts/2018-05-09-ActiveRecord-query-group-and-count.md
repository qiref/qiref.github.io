---
layout: post
title: ActiveRecord query - group, having and count
subtitle:
tags: sql group having count
---

In `has_many` relationship, like post has_many comments, we often ask: how many comments are in the post? Or which post has the most comments? ActiveRecord has some methods to do this. Let's take a look.

## DB setup

```ruby
class Migration < ActiveRecord::Migration[5.0]
  create_table :posts
  create_table :comments do |t|
    t.references :post, index: true
  end
end

class Post < ActiveRecord::Base
  has_many :comments
end

class Comment < ActiveRecord::Base
  belongs_to :post
end
```

## Data setup

Create some data for testing. Post1 has one comment, post2 has 2 comments and post3 has no comment.

```ruby
post1 = Post.create
post2 = Post.create
post3 = Post.create

Comment.create post: post1
2.times { Comment.create post: post2 }

# post1 => 1 comment
# post2 => 2 comments
# post3 => 0 comment
```

### Question: Find the posts which have at least one comment?

Use `join` to filter the posts which have no comment. May get duplicate post if the post has more than one comment.

```ruby
Post.joins(:comments)
# D, [2018-05-09T09:06:15.879257 #32617] DEBUG -- :   Post Load (0.5ms)  SELECT  "posts".* FROM "posts" INNER JOIN "comments" ON "comments"."post_id" = "posts"."id"
# => #<ActiveRecord::Relation [#<Post id: 1>, #<Post id: 2>, #<Post id: 2>]>
```

Use `distinct` to remove duplicate post.

```ruby
Post.joins(:comments).distinct
# D, [2018-05-09T09:08:36.264339 #32617] DEBUG -- :   Post Load (0.5ms)  SELECT  DISTINCT "posts".* FROM "posts" INNER JOIN "comments" ON "comments"."post_id" = "posts"."id"
#  => #<ActiveRecord::Relation [#<Post id: 1>, #<Post id: 2>]>
```

Note: `uniq` also remove the duplicate post, but it does that after the query and done in ruby. See the different in SQL statement.

```ruby
Post.joins(:comments).uniq
# D, [2018-05-09T09:26:15.403094 #32617] DEBUG -- :   Post Load (0.6ms)  SELECT "posts".* FROM "posts" INNER JOIN "comments" ON "comments"."post_id" = "posts"."id"
#  => [#<Post id: 1>, #<Post id: 2>]
```

### Question: Count comments of every post?

Use `group`, and `count` method. The result is in the format `{ post_id => count of comments }`. The result shows that post with id 2 has two comments and post with id 1 has one comment. Post with id 3 has no comment and will be filtered when use `join`.

```ruby
Post.joins(:comments).group(:id).count("comments.id")
# D, [2018-05-09T09:17:18.268999 #32617] DEBUG -- :    (0.7ms)  SELECT COUNT(comments.id) AS count_comments_id, "posts"."id" AS posts_id FROM "posts" INNER JOIN "comments" ON "comments"."post_id" = "posts"."id" GROUP BY "posts"."id"
#  => {2=>2, 1=>1}
```

If we want the result also shows the post with no comment, then use `left_joins`. The result shows post with id 3 has zero comment.

```ruby
Post.left_joins(:comments).group(:id).count("comments.id")
# D, [2018-05-09T09:16:55.752185 #32617] DEBUG -- :    (0.8ms)  SELECT COUNT(comments.id) AS count_comments_id, "posts"."id" AS posts_id FROM "posts" LEFT OUTER JOIN "comments" ON "comments"."post_id" = "posts"."id" GROUP BY "posts"."id"
#  => {3=>0, 2=>2, 1=>1}
```

Add `order` to query.

```ruby
# ordered by posts.id
Post.left_joins(:comments).group(:id).order(id: :asc).count("comments.id")
# D, [2018-05-09T09:19:42.371453 #32617] DEBUG -- :    (0.7ms)  SELECT COUNT(comments.id) AS count_comments_id, "posts"."id" AS posts_id FROM "posts" LEFT OUTER JOIN "comments" ON "comments"."post_id" = "posts"."id" GROUP BY "posts"."id" ORDER BY "posts"."id" ASC
#  => {1=>1, 2=>2, 3=>0}

# ordered by count(comments.id)
Post.left_joins(:comments).group(:id).order(Arel.sql("count(comments.id) desc")).count("comments.id")
# D, [2018-05-09T09:51:15.216870 #32617] DEBUG -- :    (0.7ms)  SELECT COUNT(comments.id) AS count_comments_id, "posts"."id" AS posts_id FROM "posts" LEFT OUTER JOIN "comments" ON "comments"."post_id" = "posts"."id" GROUP BY "posts"."id" ORDER BY count(comments.id) desc
#  => {2=>2, 1=>1, 3=>0}
```

### Question: Find the posts which have more than one comments?

Use `having` to filter the group result.

```ruby
Post.joins(:comments).group(:id).having("count(comments.id) > 1")
# D, [2018-05-09T09:38:30.481426 #32617] DEBUG -- :   Post Load (0.6ms)  SELECT  "posts".* FROM "posts" INNER JOIN "comments" ON "comments"."post_id" = "posts"."id" GROUP BY "posts"."id" HAVING (count(comments.id) > 1)
#  => #<ActiveRecord::Relation [#<Post id: 2>]>
```
