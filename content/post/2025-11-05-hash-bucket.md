---
title: "Hash bucket"
date: 2025-11-05T11:24:38+08:00
tags:
  - Go
  - Algorithm
# bookComments: false
# bookSearchExclude: false
---

```go
const (
    // BucketSize 桶的数量，用于提高灰度精度
    BucketSize = 10000

    // DefaultSalt 默认盐值
    DefaultSalt = "gray_release_salt_2024"
)

// GrayReleaseService 灰度发布服务
type GrayReleaseService struct {
    salt string
    mu   sync.RWMutex
}

// NewGrayReleaseService 创建灰度发布服务实例
func NewGrayReleaseService(salt string) *GrayReleaseService {
    if salt == "" {
        salt = DefaultSalt
    }
    return &GrayReleaseService{
        salt: salt,
    }
}

// IsInGrayGroup 判断用户是否在灰度组中
// userID: 用户ID
// percentage: 灰度百分比 (0-100)
// featureCode: 功能代码，用作额外的盐值确保不同功能独立分布
func (g *GrayReleaseService) IsInGrayGroup(userID int64, percentage int, featureCode string) bool {
    // 边界检查
    if percentage <= 0 {
        return false
    }
    if percentage >= 100 {
        return true
    }

    // 计算灰度桶数量
    grayBuckets := (percentage * BucketSize) / 100

    // 计算用户所属桶
    userBucket := g.getUserBucket(userID, featureCode)

    return userBucket < grayBuckets
}

// getUserBucket 计算用户所属的桶
func (g *GrayReleaseService) getUserBucket(userID int64, featureCode string) int {
    g.mu.RLock()
    salt := g.salt
    g.mu.RUnlock()

    // 构造哈希输入：userID + featureCode + salt
    input := fmt.Sprintf("%d:%s:%s", userID, featureCode, salt)

    // 使用 MD5 哈希
    hash := md5.Sum([]byte(input))

    // 取前8个字节转换为uint64，然后取模
    hashValue := binary.BigEndian.Uint64(hash[:8])

    return int(hashValue % BucketSize)
}
```

## 核心原理

这个算法使用了**一致性哈希分桶**的思想来实现灰度发布：

### 1. 桶的概念
```go
const BucketSize = 10000  // 总共有10000个桶
```

可以把这10000个桶想象成一个圆环，编号从0到9999。每个用户通过哈希算法会被分配到其中一个桶。

### 2. grayBuckets 的计算
```go
grayBuckets := (percentage * BucketSize) / 100
```

这里计算的是**灰度用户应该占用多少个桶**。

举例：
- 如果 `percentage = 20`（20%灰度）
- 那么 `grayBuckets = (20 * 10000) / 100 = 2000`
- 意思是前2000个桶（桶0到桶1999）的用户都是灰度用户

### 3. userBucket 的计算
```go
userBucket := g.getUserBucket(userID, featureCode)
```

这个方法通过MD5哈希将用户ID映射到0-9999中的某个桶：
```go
// 构造哈希输入：userID + featureCode + salt
input := fmt.Sprintf("%d:%s:%s", userID, featureCode, salt)
hash := md5.Sum([]byte(input))
hashValue := binary.BigEndian.Uint64(hash[:8])
return int(hashValue % BucketSize)  // 取模得到0-9999的桶号
```

### 4. 判断逻辑
```go
return userBucket < grayBuckets
```

**关键在这里**：
- 如果用户的桶号 < 灰度桶数量，则用户在灰度组
- 如果用户的桶号 >= 灰度桶数量，则用户不在灰度组

## 为什么这样能确保准确的灰度比例？

### 数学原理
1. **均匀分布**：MD5哈希保证用户在10000个桶中均匀分布
2. **连续区间**：灰度用户占用连续的前N个桶，非灰度用户占用剩余桶
3. **比例精确**：由于桶数量是10000，所以精度可以达到0.01%

### 举例说明
假设要20%灰度：
- `grayBuckets = 2000`
- 桶0-1999的用户 → 灰度用户（2000/10000 = 20%）
- 桶2000-9999的用户 → 非灰度用户（8000/10000 = 80%）

这就是为什么简单的 `userBucket < grayBuckets` 比较就能准确控制灰度比例的原理！
