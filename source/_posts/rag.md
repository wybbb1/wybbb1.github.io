---
title: RAG
date: 2026-01-29
updated: 2026-01-29
categories: 
  - AI
---

# Vector RAG

## 概览
> A typical RAG application has two main components:
> **Indexing**: a pipeline for ingesting data from a source and indexing it. This usually happens offline.
> **Retrieval** and **generation**: the actual RAG chain, which takes the user query at run time and retrieves the relevant data from the index, then passes that to the model.

以上是 langchain docs 对 RAG 的概论，RAG 英语原文 Retrieval Augmented Generation，意为检索增强生成，检索的对象可以是多样的，有网页内容、表格数据、多模态数据等，本文将注意力集中在对于文字即文档内容（比如医院内的药品说明书、工厂产品的使用手册）的检索。
由于 llm 应用中寸 token 寸金以及最大上下文的限制等，我们不可能将所有文档一股脑的丢给 ai ，我们必须“取其精华，去其糟粕”，因此检索前对文档的**分片**以及**索引**是必要的。

## 分片（Text Splitting）
分片就是将大规模的文档进行拆分，分片的方法是自由的，我们可以按字数分，按段落分，按句子分甚至按词项分。

### 为什么需要分片？
1. 语言模型（LLM）的上下文窗口限制
2. 提高检索结果的准确性和相关性
    - 原始文档通常非常长且包含大量信息。如果将整个文档进行嵌入和检索，当用户提出一个非常具体的问题时，整个文档的嵌入向量可能无法精确地代表用户查询所需的特定信息点，导致检索相关性降低。
    - 通过将文档分割成更小、更具语义凝聚力的片（chunks），每个片会更侧重于一个特定的主题或信息点。这样，当用户查询时，检索系统可以更精确地匹配并返回高度相关的片段，而不是一个庞大而宽泛的文档。
3. 文本嵌入模型（如 OpenAI Embeddings、qwen Embeddings 等）在处理特定长度范围的文本时表现最佳。过长或过短的文本都可能会导致嵌入质量下降。

### 分片是怎么分的？
分片的进行很简单，但是分片的方法往往会影响后面 ai 的相应结果，于是我们需要更加文档内容选择合适的方法进行分片。

## 索引（Indexing）
索引是通过**文本嵌入模型（Embedding）**将**片（chunks）**转换为**向量（vector）**后**与片一齐**存入**向量数据库**中的过程。

### 文本嵌入模型（Embedding）
文本嵌入模型负责将分完片的文本内容**根据语义以及上下文关系等**转化为**固定的高维度的向量**，语义越接近，向量相似度越高。

#### 为什么需要文本嵌入模型？
1. 计算机无法直接理解人类语言的含义。它们只能处理数字。嵌入模型将文本转换为数字形式，使得计算机能够“理解”和操作文本数据。
2. 实现文本的数学运算： 一旦文本被转换成向量，就可以对其进行各种数学运算。这在检索部分会提及。

### 向量数据库
市场主流的向量数据库有：Pinecone（完全托管的云原生向量数据库服务，以其高性能、易用性和可扩展性而闻名）、Milvus（开源向量数据库，专为大规模、高维向量数据而优化，支持多种索引类型和指标，具有高可扩展性和性能）、Chroma（轻量级的开源嵌入数据库，旨在简化LLM应用的开发，易于本地使用和集成）和 具有向量能力关系数据库 PostgreSQL 等。

## 检索（Retrieval）
检索是将**用户的query通过Embedding模型进行向量化**后提交给**向量数据库**，向量数据库再**计算出最相似的 n 个结果**的过程， 这个过程也被叫做召回。
为了降低噪声，提高“查询相关性”，得到 n 个结果后往往需要进行重排（Reranking），重排在召回过程之后，通过使用Cross-Encoder模型，能够对召回阶段的结果进行更精细、更准确的二次筛选。

## 生成（generation）
生成是将用户查询以及检索重排后的结果一并发给 llm 让其生成答案的过程。

# Graph RAG
相比于 Vector RAG，Graph RAG 的检索对象是图谱数据，数据以图结构进行存储，节点代表实体，边代表实体之间的关系。
