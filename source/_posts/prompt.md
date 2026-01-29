---
title: prompt
date: 2026-01-28
updated: 2026-01-29
categories: 
  - AI
---

# 提示工程(Prompt Engineering)

## 基本概念
| 概念名称 | 说明 | 备注 |
| -------- | ---- | ---- |
| temperature | 控制生成文本的随机性，值越高，输出越随机。影响概率分布的形状 | 0.0 - 1.0 |
| top_p | 用来控制生成文本的多样性，值越低，输出越集中。影响候选词选取范围 | 0.0 - 1.0 |
| frequency_penalty | 控制生成文本中重复词汇的频率，值越高，重复词汇越少 | -2.0 - 2.0 |
| max_length | 限制生成文本的最大长度，防止输出过长 | 1 - ? |
| prompt | - | 通常使用system、user、assistant角色进行对话式提示设计 |

### prompt设计
通常大模型的任务可以分为以下几类：
- 文本概括
- 文本分类
- 信息提取
- 对话(Roleplay)
- 问答(Q&A)
- 代码生成
- 推理

#### 零样本提示
即不提供示例，直接给出任务描述，让模型根据提示生成答案。平常直接和ai对话就是零样本提示。

#### 少样本提示
通过提供少量示例，帮助模型理解任务要求，从而生成更准确的答案。

提示：
```text
这太棒了！// Negative
这太糟糕了！// Positive
哇，那部电影太棒了！// Positive
多么可怕的节目！//
```
输出：
```text
Negative
```

少样本提示在大部分任务是非常有效的，但是在代码生成和推理这些复杂任务中，少样本提示则可能无法满足需求。它们更需要的是中间的推理过程（如市面上的深度思考），而不是单纯的输入输出示例。

#### 链式思考（COT）提示
可以通过**少样本COT提示**，引导模型“思考”，前提是语言模型参数足够大
提示：
```text
这组数中的奇数加起来是偶数：4、8、9、15、12、2、1。
A：将所有奇数相加（9、15、1）得到25。答案为False。
这组数中的奇数加起来是偶数：15、32、5、13、82、7、1。
A：
```
输出：
```text
将所有奇数相加（15、5、13、7、1）得到41。答案为False。
```

也能通过**零样本COT提示**来让模型“思考”。
```text
我去市场买了10个苹果。我给了邻居2个苹果和修理工2个苹果。然后我去买了5个苹果并吃了1个。我还剩下多少苹果？
让我们逐步思考。
```
加入“让我们逐步思考”这句话后，模型更容易“推理”出正确答案，而不是直接给出可能错误的答案。

最后还有一种叫**self-consistency**的方法，通过让LLM多次生成COT答案，然后对这些答案进行投票，选出最常见的那个作为最终答案，从而提升准确率。
```python
from langchain.prompts import PromptTemplate
from langchain.llms import OpenAI
from langchain.chains import LLMChain

# 定义 COT prompt
cot_template = PromptTemplate(
    input_variables=["question"],
    template="问题：{question}\n让我们逐步思考。"
)

# 创建链
llm = OpenAI(temperature=0.8)

def self_consistency_chain(question, num_samples=5):
    results = []
    
    for _ in range(num_samples):
        chain = LLMChain(llm=llm, prompt=cot_template)
        result = chain.run(question=question)
        results.append(result)
    
    # 投票
    answers = [extract_answer(r) for r in results]
    return majority_vote(answers)
```

#### 生成知识增强提示
这种提示方法将“知识”结合到prompt，以此降低模型的“幻觉”现象，提高回答的准确性。

提示：
```text
问题：高尔夫球的一部分是试图获得比其他人更高的得分。是或否？
知识：高尔夫球的目标是以最少的杆数打完一组洞。一轮高尔夫球比赛通常包括18个洞。每个洞在标准高尔夫球场上一轮只打一次。每个杆计为一分，总杆数用于确定比赛的获胜者。
回答：
```
输出：
```text
否。
在高尔夫球中，目标是**获得比其他人更低的得分**（即更少的杆数）。
```
这种提示方法“知识”的质量非常重要，“知识”可以通过LLM生成，但是LLM生成的“知识”有时也会包含错误，因此现在更主流的方法是使用**检索增强生成（RAG）**。(详见{% post_link rag RAG 笔记 %})

