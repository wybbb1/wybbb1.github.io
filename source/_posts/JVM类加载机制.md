---
title: JVM类加载机制
date: 2025-12-18
updated: 2025-12-21
categories: 
  - JVM
---

## 类加载
当Java源文件被javac编译后，会生成一个或多个字节码文件（.class文件）。这些字节码文件并不能被直接执行，必须通过Java虚拟机（JVM）来加载和解释执行。类加载是**JVM将类的字节码文件加载到内存**中的过程。

流程大致如下：
1. **加载（Loading）**：JVM通过类加载器（ClassLoader）读取类的字节码文件，并将其加载到内存中。
2. **连接（Linking）**：包括验证（Verification）、准备（Preparation）和解析（Resolution）三个步骤。
3. **初始化（Initialization）**：执行类的初始化代码，包括静态变量的赋值和静态代码块的执行。

### 加载
以下所有引用内容皆来自《深入理解Java虚拟机（第3版）》
> 加载阶段需要完成以下任务：
> - 通过类的全限定名获取类的二进制字节流。
> - 将这个字节流所代表的静态存储结构转化为方法区的运行时数据结构。
> - 在Java堆中生成一个代表这个类的java.lang.Class对象，作为方法区中类数据的访问入口。

以上三个任务皆由类加载器（ClassLoader）完成。
![](../images/posts/jvm-classloder/struct.png)
<p class="img-caption">图片来源：<a href="https://blog.csdn.net/javazejian/article/details/73413292" target="_blank">CSDN博客</a></p>

由于没有限定获取类的二进制字节流的方式，因此Java平台允许开发者自定义类加载器，从而实现从不同的数据源加载类，从中也衍生出了很多举足轻重的技术，例子以下：

#### 运行时计算生成（动态代理）
动态代理技术允许在运行时动态生成类的字节码，并将其加载到JVM中。这种技术广泛应用于AOP（面向切面编程）和RPC（远程过程调用）框架中。Spring 框架（尤其是 Spring AOP）就是动态代理技术的集大成者。
**Spring 是怎么偷天换日的？**
假设你在 Spring 中定义了一个 Bean：

```Java
@Service
public class UserServiceImpl implements UserService {
    @Transactional
    public void addUser() { ... }
}
```
Spring 容器启动时的流程如下：
1. 创建原始对象：Spring 首先像往常一样，实例化 UserServiceImpl。
2. 后置处理 (BeanPostProcessor)：Spring 容器有一个机制叫 BeanPostProcessor。在 Bean 初始化后，Spring 会检查这个 Bean 是否被切面（Aspect）覆盖（比如有没有加 @Transactional 注解）。
3. 决定代理：如果发现需要增强（比如需要开启事务），Spring 就不会直接把原始对象放入容器，而是创建一个代理对象。
4. 生成代理：
   - 如果 UserServiceImpl 实现了接口，Spring 默认使用 JDK 动态代理。
   - 如果它没有实现接口，Spring 会自动切换使用 CGLIB（另一种基于继承的字节码生成技术）。
5. 替换：Spring 把这个生成的代理对象（$ProxyN）放入 IOC 容器（ApplicationContext）中，替换掉原来的 UserServiceImpl。

其中的JDK动态代理使用了Java.lang.reflect.Proxy类。下面是一个简化的示例，展示了JDK动态代理的工作原理：
```Java
// 通用的逻辑，可以应用在任何接口上
public class LogHandler implements InvocationHandler {
    private Object target; // 真正的干活对象

    public LogHandler(Object target) { this.target = target; }

    @Override
    public Object invoke(Object proxy, Method method, Object[] args) throws Throwable {
        System.out.println("动态代理逻辑：开始记录日志...");
        // 反射调用目标对象的方法
        Object result = method.invoke(target, args);
        System.out.println("动态代理逻辑：结束...");
        return result;
    }
}

UserService target = new UserServiceImpl();
// 这一步产生的 proxyInstance，就是 $Proxy0 类的实例
UserService proxyInstance = (UserService) Proxy.newProxyInstance(
    target.getClass().getClassLoader(),
    target.getClass().getInterfaces(),
    new LogHandler(target)
);
```

### 验证
验证阶段的主要任务是确保被加载的类的正确性和安全性。JVM 会检查类的字节码文件是否符合 Java 语言规范，是否没有违反访问权限等。如果验证失败，JVM 会抛出相应的异常，防止不合法的类被加载和执行。
如果所有类都是可信的，那么验证阶段可以省略(通过 -Xverify:none)，从而提高类加载的效率。

### 准备
准备阶段是为类的静态变量分配内存并设置默认初始值的过程。此时的“初始值”**通常情况**是指变量的默认值，而不是程序中定义的初始值。
![](../images/posts/jvm-classloder/zeroV.jpg)
<p class="img-caption">图片来源：《深入理解Java虚拟机（第3版）》</p>

> 从概念上讲，这些变量所使用的内存都应当在方法区中进行分配，但必须注意到方法区本身是一个逻辑上的区域，在JDK 7及之前，HotSpot使用永久代来实现方法区时，实现是完全符合这种逻辑概念的；而在JDK 8及之后，类变量则会随着Class对象一起存放在Java堆中，这时候“类变量在方法区”就完全是一种对逻辑概念的表述了，

```java
// 通常情况
public static int count = 10;
// 不通常情况，这种情况的初始值就是程序中定义的值
public static final int MAX_COUNT = 100;
```

### 解析
>解析阶段是将类中的符号引用转换为直接引用的过程。

- 符号引用：是以字符串形式表示的引用，比如类名、接口名、字段名和方法名等。符号引用的字面量在不同虚拟机中是一致的。
- 直接引用：是指向内存地址的引用，比如指向方法区中某个类的具体内存地址。

### 初始化
>类的初始化阶段是类加载过程的最后一个步骤，之前介绍的几个类加载的动作里，除了在加载阶段用户应用程序可以通过自定义类加载器的方式局部参与外，其余动作都完全由Java虚拟机来主导控制。直到初始化阶段，Java虚拟机才真正开始执行类中编写的Java程序代码，将主导权移交给应用程序。
>初始化阶段就是执行类构造器<clinit>()方法的过程。类构造器<clinit>()方法是由编译器自动收集类中的所有类变量的赋值动作和静态代码块（static{}块）中的语句合并产生的。

该部分较多记诵部分，此处建议阅读《深入理解Java虚拟机（第3版）》第七章节。注意重点区分接口和类执行<clinit>()方法的区别。

## 类加载器以及双亲委派

书中有一段代码很有趣
```java
public class ClassLoaderTest {
    public static void main(String[] args) throws Exception {
        ClassLoader myLoader = new ClassLoader() {
            @Override
            protected Class<?> loadClass(String name) throws ClassNotFoundException {
                try{
                    String fileName = name.substring(name.lastIndexOf(".") + 1) + ".class";
                    InputStream is = getClass().getResourceAsStream(fileName);
                    if (is == null) {
                        return super.loadClass(name);
                    }
                    byte[] b = new byte[is.available()];
                    is.read(b);
                    return defineClass(name, b, 0, b.length);
                } catch {
                    throw new ClassNotFoundException(name);
                }
            }
        };
        Object obj = myLoader.loadClass("org.fenixsoft.classloading.ClassLoaderTest").newInstance();
        System.out.println(obj.getClass());
        System.out.println(obj instanceof org.fenixsoft.classloading.ClassLoaderTest);
    }
}
```
书中说`System.out.println(obj instanceof org.fenixsoft.classloading.ClassLoaderTest);`的输出将会是`false`，因为java虚拟机同时存在两个ClassLoaderTest类，一个是应用程序类加载器加载的，一个是自定义的类加载器加载的。而**不同类加载器加载的类即使类名相同，JVM也会认为它们是不同的类**。

由于双亲委派模型要求：当一个类加载器收到类加载请求时，它首先不会尝试自己去加载这个类，而是把请求委派给父类加载器去完成，只有当父加载器反馈无法完成加载（找不到类）时，子加载器才会尝试自己去加载。

以上代码显然是对该机制的一种破坏，如果不想破坏双亲委派模型，可以将`MyClassLoader`改为：
```java
public class MyClassLoader extends ClassLoader {
    // 为了避免重写 loadClass 可能对双亲委派机制的破坏。重写 findClass 可以确保只有当父类加载器（AppClassLoader、ExtClassLoader等）都表示“这个类我不认识”时，JVM 才会调用 findClass 来用 MyClassLoader 加载类。
    @Override
    protected Class<?> findClass(String name) throws ClassNotFoundException {
        // 1. 根据类名读取字节码（只需关注这一步）
        byte[] data = loadClassData(name); 
        if (data == null) {
            throw new ClassNotFoundException();
        }
        // 2. 调用 defineClass 将字节数组转为 Class 对象
        return defineClass(name, data, 0, data.length);
    }

    private byte[] loadClassData(String name) {
        // 这里写你自己的逻辑：从磁盘读、从网络下、或者解密字节码
        return null; 
    }
}
```
结合源码分析，`loadClass` 方法的实现如下：
```java
protected Class<?> loadClass(String name, boolean resolve)
        throws ClassNotFoundException {
    // 1. 检查该类是否已经被加载过了
    Class<?> c = findLoadedClass(name);
    if (c == null) {
        try {
            // 2. 委派给父类加载器加载
            if (parent != null) {
                c = parent.loadClass(name, false);
            } else {
                c = getBootstrapClassLoader().loadClass(name);
            }
        } catch (ClassNotFoundException e) {
            // 3. 父类加载器无法加载，调用子类的 findClass 方法加载
            c = findClass(name);
        }
    }
    if (resolve) {
        resolveClass(c);
    }
    return c;
}
```
因此只重写 `findClass` 方法可以确保双亲委派机制不被破坏。


