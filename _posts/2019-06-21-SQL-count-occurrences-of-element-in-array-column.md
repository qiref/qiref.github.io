---
layout: post
title: Count occurrence of element in array column
subtitle:
tags: SQL
---

Scenario: There is a reviews table contains feedbacks column, which is an array of string. Please count the occurrence of feedback.

Table and values:

```sql
CREATE TABLE reviews (feedbacks text[])
INSERT INTO reviews VALUES ('{"good"}')
INSERT INTO reviews VALUES ('{"good","awesome"}')
```

PostgreSQL has an array function `unnest`, which expands an array to a set of rows. For example:

```sql
SELECT unnest(feedbacks) AS feedback FROM reviews;

 feedback
----------
 good
 good
 awesome
```

Then we can group feedback and count them:

```sql
SELECT unnest(feedbacks) AS feedback, COUNT(*)
FROM reviews GROUP BY feedback;

 feedback | count
----------+-------
 awesome  |     1
 good     |     2
```
