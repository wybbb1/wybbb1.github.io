---
title: 改造微服务项目为MCP
date: 2025-12-28
updated: 2025-12-28
categories: 
  - 实战
---

# 本篇工作
本篇工作是为一个微服务添加MCP能力，便于项目智能助手的接入。

## 大致架构
为了减少侵入性，将MCP能力封装成一个独立的模块，通过API的方式与原有微服务进行交互，MCP模块负责处理与AI相关的逻辑，而原有微服务则继续处理核心业务逻辑。

![](../images/posts/mcp_improve/struct.png)
<p class="img-caption">架构图</p>

## 基本架构实现
### MCP服务器的实现
content_client.py 封装了对content服务的API调用，提供了一个统一的接口来获取内容数据。以下以search_home接口为例，此接口可以有三个不同搜索域（内容作者、内容标题、内容正文），默认搜索域为内容标题。
```python
class ContentClient:
    """封装对 Content Service 的 HTTP 调用"""

    def __init__(self):
        self.base_url = CONTENT_SERVICE_URL
        self.headers = {}
        if AUTH_TOKEN:
            self.headers["Authentication"] = AUTH_TOKEN

    async def search_home(
        self,
        query: str,
        type: Optional[str] = None,
        page: int = 1,
        size: int = 10
    ) -> dict:
        """
        搜索内容（首页搜索）
        
        Args:
            query: 搜索关键词
            type: 搜索类型（可选）
            page: 页码
            size: 每页数量
        """
        params = {
            "query": query,
            "page": page,
            "size": size
        }
        if type:
            params["type"] = type

        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/search/home",
                params=params,
                headers=self.headers,
                timeout=30.0
            )
            response.raise_for_status()
            return response.json()
```
接着在server.py中定义了server实例，server重写了mcp的list_tools方法和call_tool方法，list_tools方法返回可用工具列表，call_tool方法根据工具名称调用对应的函数并返回结果。以下以search_content工具为例展示：
```python
# 创建 MCP 服务器实例
server = Server("content-search-server")

# Content 服务客户端
client = ContentClient()

@server.list_tools()
async def list_tools() -> list[Tool]:
    """返回可用的工具列表"""
    return [
        Tool(
            name="search_content",
            description="搜索内容。根据关键词搜索帖子、文章等内容。",
            inputSchema={
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "搜索关键词"
                    },
                    "type": {
                        "type": "string",
                        "description": "搜索类型（可选）",
                        "enum": ["post", "article", "news"]
                    },
                    "page": {
                        "type": "integer",
                        "description": "页码，默认为 1",
                        "default": 1
                    },
                    "size": {
                        "type": "integer",
                        "description": "每页数量，默认为 10",
                        "default": 10
                    }
                },
                "required": ["query"]
            }
        )
    ]

@server.call_tool()
async def call_tool(name: str, arguments: dict) -> list[TextContent]:
    """处理工具调用"""
    try:
        if name == "search_content":
            result = await client.search_home(
                query=arguments["query"],
                type=arguments.get("type"),
                page=arguments.get("page", 1),
                size=arguments.get("size", 10)
            )
        else:
            return [TextContent(
                type="text",
                text=f"未知的工具: {name}"
            )]

        return [TextContent(
            type="text",
            text=json.dumps(result, ensure_ascii=False, indent=2)
        )]

async def main():
    """启动 MCP 服务器"""
    async with stdio_server() as (read_stream, write_stream):
        await server.run(
            read_stream,
            write_stream,
            server.create_initialization_options()
        )

if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
```

MCP服务器的返回需要符合MCP协议的规范
```python
return [TextContent(
    type="text",
    text=json.dumps(result, ensure_ascii=False, indent=2)
)]
```
- `type`: 指定内容类型（text/image/resource等）
- `text`: 实际的文本内容
- 返回类型是`list[TextContent]`，支持返回多条内容

虽然代码中使用TextContent，但MCP还支持其他类型：
- `TextContent`: 文本内容
- `ImageContent`: 图片内容
- `ResourceContents`: 资源引用
- `EmbeddedResource`: 嵌入资源

### 客户端的配置
#### B端智能体配置
```python
{
  "mcpServers": {
    "content-search": {
      "command": "服务器python程序的路径",
      "args": [
        "server.py的路径"
      ],
      "env": {
        "CONTENT_SERVICE_URL": "http://localhost:7004"
      }
    }
  }
}
```
#### C端智能体连接
如果有用户的agent需要连接到这个MCP服务器，有以下几种做法：
1. **使用node.js重写**：将MCP的服务器端代码用node.js重写并使用`npm publish --access publich`到npm上，这样远程agent就可以直接通过npm安装这个包来连接MCP服务器。***但是本质仍是本地服务器***，只是方便用户安装和使用。
2. **使用SSE连接**：在MCP服务器端实现一个HTTP接口，远程agent通过HTTP请求连接到这个接口，并使用Server-Sent Events（SSE）来接收MCP服务器发送的事件和数据。这样远程agent就可以实时地接收MCP服务器的响应，而不需要直接运行MCP服务器的代码。

## 支持热更新
为了支持工具的热更新，我们可以在MCP服务器中实现一个机制，允许在运行时动态加载和卸载工具。以下是一个简单的实现思路：
定义一个工具注册表，用来**注册/卸载**当前可用的工具：
```python
# 类定义略
class _RegisteredTool:
    def register(
        self,
        name: str,
        description: str,
        schema: dict,
        handler: ToolHandler,
    ) -> None:
        """手动注册一个工具"""
        if name in self._tools:
            logger.warning(f"工具 '{name}' 已存在，将被覆盖")
        self._tools[name] = _RegisteredTool(name, description, schema, handler)
        logger.info(f"工具已注册: {name}")

    def unregister(self, name: str) -> bool:
        """注销一个工具，返回是否成功"""
        if name in self._tools:
            del self._tools[name]
            logger.info(f"工具已注销: {name}")
            return True
        logger.warning(f"工具 '{name}' 不存在，无法注销")
        return False

    def has(self, name: str) -> bool:
        return name in self._tools
```
接着集成进MCP服务器即可
```python
@server.list_tools()
async def list_tools() -> list[Tool]:
    """返回所有已注册工具"""
    return registry.list_tools()

@server.call_tool()
async def call_tool(name: str, arguments: dict) -> list[TextContent]:
    """委托给 registry 执行"""
    return await registry.call_tool(name, arguments)
```

### 持久化
以上的工具注册机制是**内存级别的**，当服务器重启时，所有注册的工具都会丢失。为了实现持久化，我们可以在注册工具时将工具信息保存进磁盘或者redis中，为此当服务器启动时从持久化存储中加载工具信息并注册到内存。

## 性能优化
给原来的微服务添加MCP能力后，数据库和redis不可避免的会增加负载，需要从**MCP性能**以及**原有微服务性能**两个方面进行优化

### MCP性能优化
提升LLM的响应速度，节省token的使用量，使用**缓存工具**无疑可以完成以上两个目标。
如何使用缓存？我们可以：
1. 工具结果缓存：对于一些计算量大或者调用频率高的工具，我们可以在服务器端实现一个缓存机制，将工具的输入和输出进行缓存。当相同的输入再次出现时，直接返回缓存的结果，而不需要重新执行工具逻辑。
2. 语义缓存：对于一些基于文本输入的工具，我们可以使用语义相似度来判断输入是否与之前的输入相似，如果相似度超过某个阈值，则返回之前的结果。
3. 结果压缩：对于一些返回结果较大的工具，我们可以对结果进行压缩或者摘要，以减少token的使用量。

考虑到今后可能~~（其实不太可能）~~会添加新的缓存策略，项目中使用了**责任链模式**来实现缓存机制，以下是一个简单的示例（略去了getset和构造函数）：
先定义上下文
```java
public class ToolContext {
    private String toolName;
    private Map<String, Object> args;
    private Object result;
    private boolean isCached;
}
```
再定义一个抽线缓存处理器的抽象类
```java
public abstract class CacheHandler {
    private String name;
    private boolean enable;
    protected CacheHandler next; // claude提醒这一处最好是用lambda包装、保证线程安全
                                 // 主要是CachePipeline的use方法不是线程安全的
                                 // 但是也不会多线程去构建链，似乎没什么大问题，就先这样写了（实在有问题也可以直接加锁）

    // 框架控制整体流程
    void handle(ToolContext toolContext) {
        if (toolContext.cacheHit()) return;
        if (enable){
            doBefore(toolContext);
            if (next != null) next.handle(toolContext);
            doAfter(toolContext);
        }else{
            next.handle(toolContext);
        }
    }

    protected abstract void doAfter(ToolContext toolContext);

    protected abstract void doBefore(ToolContext toolContext);
}
```
接着再来个责任链编排管道
```java
public class CachePipeline {
    private final List<CacheHandler> handlers = new ArrayList<>();

    public CachePipeline use(CacheHandler cacheHandler){
        if (!handlers.isEmpty()) {
            handlers.getLast().next = cacheHandler;
        }
        handlers.add(cacheHandler);
        return this;
    }

    public Object execute(String toolName, Map<String, Object> args){
        ToolContext ctx = new ToolContext(toolName, args);
        handlers.getFirst().handle(ctx);
        return ctx.getResult();
    }
}
```

## 附录：高并发下的容错方案（sse 版本）
*如果有读者读到现在，可能会疑惑我为什么明明MCP服务器是使用python编写的，但是在性能优化这一块的代码示例却是java的？这主要是因为纯复盘真的很无聊啊，所以就在原来python实现的基础上思考如何使用java来实现。*

这里的熔断就不用到Sentinel这样的全家桶大家伙了，使用的是轻量一些且**模块化**的resilience4j：

### 基本使用
容错框架一般有以下几个核心功能：熔断、限流、重试、隔离。resilience4j将这些功能拆分成了不同的模块，我们可以根据需要选择性地引入依赖。
如果想要学习容错框架的使用，详见{% post_link 容错框架核心功能 容错框架核心功能 %}
```xml
<dependency>
    <groupId>io.github.resilience4j</groupId>
    <artifactId>resilience4j-circuitbreaker</artifactId>
    <!-- 如果是 resilience4j 2 需要 >= JDK17 -->
    <version>${resilience4jVersion}</version> 
</dependency>
```

springboot项目中可以直接使用starter
```xml
<dependencies>
    <dependency>
        <groupId>io.github.resilience4j</groupId>
        <artifactId>resilience4j-spring-boot3</artifactId>
        <version>2.2.0</version> </dependency>
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-aop</artifactId>
    </dependency>
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-actuator</artifactId>
    </dependency>
</dependencies>
```
接着在application.yml中进行配置
```yaml
resilience4j:
  circuitbreaker:
    instances:
      backendA: # 实例名称
        registerHealthIndicator: true
        slidingWindowSize: 10              # 滑动窗口大小（计算失败率的采样数）
        minimumNumberOfCalls: 5            # 开启计算前所需的最小调用数
        failureRateThreshold: 50           # 失败率阈值（百分比），达到后熔断
        waitDurationInOpenState: 10s       # 熔断器从开启到半开的等待时间
        permittedNumberOfCallsInHalfOpenState: 3 # 半开状态允许通过的请求数
```
代码中的使用
```java
@Service
public class MyService {

    // name 必须与配置文件中的实例名一致
    @CircuitBreaker(name = "backendA", fallbackMethod = "fallback")
    public String doSomethingRemote() {
        // 调用外部接口或可能失败的操作
        return restTemplate.getForObject("http://remote-service/api", String.class);
    }

    // 降级方法：参数列表必须与原方法一致，最后多一个 Throwable 参数
    public String fallback(Throwable t) {
        return "服务繁忙，请稍后再试。错误原因：" + t.getMessage();
    }
}
```
如果你开启了 Actuator，可以访问 /actuator/health 查看熔断器的状态（CLOSED/OPEN/HALF_OPEN），或者通过 /actuator/metrics/resilience4j.circuitbreaker.calls 获取更详细的调用统计。
