---
title: 登录与RBAC
date: 2025-12-28
categories: 
  - 实战
---

# 登录

## OAuth


# Filter 和 Interceptor的区别
在Java Web开发中，Filter（过滤器）和Interceptor（拦截器）都是用于处理请求和响应的组件，但它们也是有一些区别的，要注意Interceptor通常是框架级别的概念，他在DispatcherServlet内部执行，这也导致他只能够拦截Spring环境内的资源，而Filter则是Servlet规范的一部分，可以拦截所有资源。

- Filter的配置：在 Spring Boot 中通常通过实现 Filter 接口并加上 @Component 即可，或使用 FilterRegistrationBean 来精确控制拦截路径和顺序。

- Interceptor的配置：需要实现 HandlerInterceptor 接口，并编写一个配置类继承 WebMvcConfigurer，在 addInterceptors 方法中手动注册。