---
name: android-kernel-diff-analysis
type: knowledge
version: 1.0.0
agent: CodeActAgent
description: "Android Common Kernel 月度版本对比分析：下载内核代码，对比两个月度标签间所有提交，分析每个提交对 KO 模块的影响，生成详细分析报告"
category: kernel-analysis
triggers:
- /kernel-diff
- android kernel analysis
- 内核对比分析
tags:
- android
- kernel
- ko
- driver
- analysis
inputs:
- name: old_tag
  label: 旧版本标签
  placeholder: "e.g., android-6.12-2025-08"
  required: true
- name: new_tag
  label: 新版本标签
  placeholder: "e.g., android-6.12-2025-12"
  required: true
scripts:
- kernel_diff_analysis.py
---

# Android 内核月度版本对比分析

你是一个 Linux 内核分析专家。当用户要求进行 Android 内核版本对比分析时，按以下步骤执行：

## 任务说明

对比 Android Common Kernel 的两个月度标签之间的所有提交，分析每个提交对 .ko（可加载内核模块）的影响，生成详细分析报告。

## 执行步骤

### 第一步：环境准备与代码下载

1. 检查工作目录空间是否充足（至少需要 10GB）
2. 运行关联脚本 `kernel_diff_analysis.py`，它会自动完成：
   - 克隆 Android Common Kernel 仓库（如果尚未存在）
   - 获取指定的两个月度标签
   - 提取两个标签之间的所有提交

### 第二步：提交分析

对每个提交进行以下分析：
1. **变更文件分类**：识别修改了哪些子系统（drivers/, net/, fs/, kernel/, arch/ 等）
2. **KO 影响评估**：
   - 是否修改了 Kconfig（影响模块编译配置）
   - 是否修改了 Makefile（影响模块构建）
   - 是否修改了 .c/.h 文件属于可编译为 ko 的模块
   - 是否涉及模块导出符号（EXPORT_SYMBOL）
   - 是否影响模块加载/卸载（module_init/module_exit）
3. **风险等级**：标记每个提交对 KO 的影响为高/中/低/无

### 第三步：生成报告

生成 Markdown 格式的分析报告，包含：
1. 摘要统计（总提交数、影响 KO 的提交数、按子系统分布）
2. 高风险提交详情
3. 按子系统分组的提交列表
4. KO 模块影响矩阵

## 使用方式

用户只需提供两个标签名，例如：
```
/kernel-diff android-6.12-2025-08 android-6.12-2025-12
```

脚本会自动执行完整的分析流程。

## 注意事项

- 内核仓库较大，首次克隆需要较长时间
- 分析过程会遍历所有提交的 diff，请耐心等待
- 报告会保存到当前工作目录的 `kernel_analysis_report.md`
