---
layout: post
title: Database indexes
subtitle:
tags: database index
---

資料庫預設搜尋會 row by row 直到找到目標為止，當有很多筆資料時（很多 rows ），且想搜尋的結果只有少數幾筆時，這是非常沒有效率的做法。Index 的概念可以在書本的目錄看到，目錄分了章節，如此一來想找某個特定主題時，不用一頁頁去翻，可以透過目錄來找到想要的主題。

一旦 index 建立後，系統會自動維護它，資料庫會根據 query 來判斷使用 index 是否會讓搜尋更有效率。Index 可以幫助 `UPDATE`, `DELETE`, `SELECT` (with conditions) 更有效率。建立 Index 需要一段時間，建立期間可以允許資料庫的讀取，但是寫入動作如 `INSERT`, `UPDATE`, `DELETE` 則須等到 index 建立完成後才可使用，當然也可以同時建立 index 和進行寫入動作，不過這就是另一個主題了。

建立 index 後系統需要隨時維護它，這會造成系統額外的負擔。所以如果 index 不常用到的話，就移除它吧。

# Types of indexes

PostgreSQL 提供了各種類的 B-tree, Hash, GiST, SP-GiST, GIN, BRIN 。每一種都有其適用的情境，預設建立的 index 為 B-tree。

## B-tree

B-tree 可以用來處理相等或範圍比較的搜尋，例如 `<`, `<=`, `=`, `>=`, `>`, `BETWEEN`, `IN`, `IS NULL`, `IS NOT NULL`。搜尋優化器在下列情況會優先使用 B-tree,

* `col LIKE 'foo%'` or `col ~ '^foo'` (not `col LIKE '%foo'`)

## Hash

Hash index 只能用來處理相等的搜尋，不太建議使用。

## GiST, SP-Gist

適合用來處理二維地理平面的資料，如 `SELECT * FROM places ORDER BY location <-> point '(101, 456)' LIMIT 10;`，

## GIN

適合用來處理陣列 (Array) 資料

## BRIN (Block Range Index)

適合用來處理範圍區間的搜尋，像是某個期間的訂單。相較於 B-tree, BRIN 佔用的資料量較少，

# Multicolumn Index

將多個 column 組合起來成為 index

面試題：

現有 INDEX(a, b), 下列搜尋資料庫會如何使用？

* SELECT * FROM user WHERE a=0 AND b=0;
* SELECT * FROM user WHERE a=0 OR b=0;
* SELECT * FROM user WHERE a>0 AND b=0;
* SELECT * FROM user WHERE a=0 AND b>0;
