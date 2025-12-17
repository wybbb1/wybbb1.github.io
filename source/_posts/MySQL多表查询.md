---
title: MySQL多表查询
date: 2025-11-30
updated: 2025-11-30
categories: 
  - MySQL
---

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

