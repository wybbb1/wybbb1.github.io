---
title: Redis实现令牌桶限流
date: 2026-03-01
categories: 
  - Redis
---

## 令牌桶简介
令牌桶算法可以应对突发流量，同时保证长期的平滑速率。

你可以想象一个桶，桶里装满了令牌，每个令牌代表一个请求的许可。系统**向桶里添加令牌**，当有请求到来时，如果桶里有令牌，就允许请求通过，并从桶里取出一个令牌；如果没有令牌，请求就被拒绝或者等待。

我们提到系统**向桶里添加令牌**，这可以通过一个定时任务来实现，它来保证每秒钟向桶里添加一定数量的令牌，但是这样很耗费系统资源。其实令牌桶的关键不在于“实时”往里放令牌，而是在请求到达的那一刻，通过计算时间差来推算应该补多少令牌。

## 场景模拟
- 设定：每秒产生 10 个令牌，桶容量 100 个。
- 第 1 秒：请求 A 到达。
  - 记录 last_time = 1.0s，curr_tokens = 100。
  - A 拿走 1 个，剩下 99 个。
- 第 3 秒：请求 B 到达。
  - 计算时间差：现在是 3.0s，距离上次 (1.0s) 过去了 2 秒。
  - 计算补偿：2 秒 * 10 个/秒 = 20 个令牌。
  - 更新桶：99 + 20 = 119 个。但桶上限是 100，所以 curr_tokens = 100。
  - B 拿走 1 个，剩下 99 个。更新 last_time = 3.0s。

## 代码
```lua
-- KEYS[1]: 令牌桶的 Key
-- ARGV[1]: 令牌填充速率 (Tokens per second)
-- ARGV[2]: 桶的容量 (Capacity)
-- ARGV[3]: 当前请求的时间戳 (Current Unix timestamp)
-- ARGV[4]: 请求的令牌数量 (Requested tokens, usually 1)

local ratelimit_info = redis.call('hmget', KEYS[1], 'last_time', 'curr_tokens')
local last_time = tonumber(ratelimit_info[1])
local curr_tokens = tonumber(ratelimit_info[2])

-- 初始化
if last_time == nil then
    last_time = tonumber(ARGV[3])
    curr_tokens = tonumber(ARGV[2])
end

-- 计算自上次请求以来补充的令牌
local duration = math.max(0, tonumber(ARGV[3]) - last_time)
local reverse_tokens = duration * tonumber(ARGV[1])
curr_tokens = math.min(tonumber(ARGV[2]), curr_tokens + reverse_tokens)

local result = 0
if curr_tokens >= tonumber(ARGV[4]) then
    result = 1
    curr_tokens = curr_tokens - tonumber(ARGV[4])
    last_time = tonumber(ARGV[3])
end

-- 更新桶状态并设置过期时间防止冷数据占用空间
redis.call('hmset', KEYS[1], 'last_time', last_time, 'curr_tokens', curr_tokens)
redis.call('expire', KEYS[1], 600)

return result
```

除此之外也可以使用 Redisson 的 RateLimiter 来实现令牌桶限流，Redisson 内部也是通过 Lua 脚本来实现的，使用起来更方便。
## 注意事项
1. 预加载脚本：在应用启动时使用 SCRIPT LOAD 将 Lua 脚本加载到 Redis，之后通过 EVALSHA 命令调用。这样可以减少每次传输脚本带来的带宽消耗。
2. 集群兼容性：在 Redis Cluster 环境下，Lua 脚本涉及的 KEYS 必须落在同一个 Slot 中。你可以通过 Hash Tag（例如 {user123}:ratelimit）来强制指定 Slot。
3. 降级方案：如果 Redis 挂了，限流组件应该有容错机制（如默认放行），避免因为限流器故障导致业务整体不可用。