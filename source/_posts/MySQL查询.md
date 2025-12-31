---
title: MySQL查询
date: 2025-11-30
updated: 2025-12-31
categories: 
  - MySQL
---

## 关系代数

### 传统的集合运算
- 并集（Union）：返回两个表中所有不重复的记录。
```sql
select {字段名} from {表名1}
union [all]
select {字段名} from {表名2};
```
- 交集（Intersection）：返回两个表中都存在的记录。
```sql
-- mysql 8.0 及以上版本支持
select {字段名} from {表名1}
intersect
select {字段名} from {表名2};

-- 低版本可以使用以下方式实现交集
select {字段名} from {表名1}
where {字段名} in (select {字段名} from {表名2});

-- 使用 JOIN 模拟
SELECT DISTINCT A.id 
FROM table_A A
INNER JOIN table_B B ON A.id = B.id;
```
- 差集（Difference）：返回在第一个表中存在但在第二个表中不存在的记录。
```sql
-- mysql 8.0 及以上版本支持
select {字段名} from {表名1}
expect
select {字段名} from {表名2};

-- 低版本可以使用以下方式实现差集
select {字段名} from {表名1}
where {字段名} not in (select {字段名} from {表名2});

-- 使用 LEFT JOIN 模拟
SELECT A.id
FROM table_A A
LEFT JOIN table_B B ON A.id = B.id
WHERE B.id IS NULL;
```
- 笛卡尔积（Cartesian Product）：返回两个表中所有可能的记录组合。
```sql
select {字段名} from {表名1}, {表名2};
```

### 专门的关系运算
- 选择（Selection）：根据指定条件从表中选择记录。
```sql
select {字段名} from {表名} where {条件};
```
- 投影（Projection）：选择表中的特定列。
```sql
select {字段名1}, {字段名2}, ... from {表名};
```
- 连接（Join）：将两个或多个表中的记录根据相关列进行组合。(有条件的笛卡尔积)
<p>连接有多种类型，详见下文<a href="#多表查询">“多表查询”部分。</a></p>

- 除（Division）：返回在一个表中与另一个表中的所有记录相关联的记录。(笛卡儿积的逆运算)
```sql
-- 假设有两个表：Students（学生）和Courses（课程），我们想找出选修了所有课程的学生。
SELECT student_id
FROM Students S
WHERE NOT EXISTS (
    SELECT course_id
    FROM Courses C
    WHERE NOT EXISTS (
        SELECT *
        FROM Enrollments E
        WHERE E.student_id = S.student_id AND E.course_id = C.course_id
    )
);
```

## 多表查询

### 内连接(inner join)
内连接返回两个表中**满足连接条件**的记录。

- 隐式内连接
```bash
select {字段名} from {表名1}, {表名2} where {条件};

# 例子
SELECT e.name, d.dept_name
FROM emp e, dept d
WHERE e.dept_id = d.id
  AND e.salary > 5000;
```
- 显式内连接
```bash
select {字段名} from {表名1} [inner] join {表名2} on {条件};

# 例子
SELECT e.name, d.dept_name
FROM emp e
INNER JOIN dept d ON e.dept_id = d.id
WHERE e.salary > 5000;
```

### 外连接(left join/ right join)
外连接返回左（右）表的所有记录，以及右（左）表中**满足连接条件**的记录。如果右（左）表中没有匹配的记录，则结果集中对应的字段值为NULL。

- 左外连接
```bash
select {字段名} from {表名1} left [outer] join {表名2} on {条件};

# 例子
SELECT e.name, d.dept_name
FROM emp e
LEFT JOIN dept d ON e.dept_id = d.id;
```

- 右外连接
```bash
select {字段名} from {表名1} right [outer] join {表名2} on {条件};
```

### 全外连接(full join/ Union [all])
全外连接返回两个表中的所有记录。如果在一个表中没有匹配的记录，则结果集中对应的字段值为NULL。
```bash
select emp.username, dept.name
from emp left join dept on emp.dept_id = dept.id

# 如果没有加上all,则为去重的full
union

select emp.username, dept.name
from emp right join dept on emp.dept_id = dept.id;
```

### 标量子查询
```bash
select * from emp where dept_id = (select id from dept where name = '销售');
```

### 列子查询
```bash
select * from emp a where a.salary > {all} (select salary from emp b where dept_id = 1)
```
{}实际并不添加，其中的值可以换为
- all 表示大于子查询返回的所有值
- any 表示大于子查询返回的任意一个值
- in 表示在子查询返回的值范围内
- not in 表示不在子查询返回的值范围内

### 其他多表查询方式
根据多个字段进行匹配查询
```bash
select * from emp where (salary, managerid) = (select salary, managerid from emp where name ='xiaoming');

select * from emp where (job, salary) in(select job, salary from emp where name = 'xiaoming' or name = 'xiaomei');
```

