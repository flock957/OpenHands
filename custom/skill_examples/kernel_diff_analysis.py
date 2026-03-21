#!/usr/bin/env python3
"""
Android Common Kernel 月度版本对比分析工具

功能：
1. 克隆/更新 Android Common Kernel 仓库
2. 提取两个月度标签之间的所有提交
3. 分析每个提交对 .ko（可加载内核模块）的影响
4. 生成 Markdown 格式的分析报告

使用方法：
    python3 kernel_diff_analysis.py <old_tag> <new_tag> [--repo-dir <path>]

示例：
    python3 kernel_diff_analysis.py android-6.12-2025-08 android-6.12-2025-12
"""

import argparse
import os
import re
import subprocess
import sys
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path


# Android Common Kernel 仓库地址
KERNEL_REPO = "https://android.googlesource.com/kernel/common"
DEFAULT_REPO_DIR = "android-kernel"


@dataclass
class CommitInfo:
    hash: str
    subject: str
    author: str
    date: str
    files_changed: list = field(default_factory=list)
    subsystems: set = field(default_factory=set)
    ko_impact: str = "none"  # high / medium / low / none
    ko_reasons: list = field(default_factory=list)
    insertions: int = 0
    deletions: int = 0


def run_cmd(cmd: list[str], cwd: str | None = None, timeout: int = 600) -> str:
    """执行命令并返回输出"""
    try:
        result = subprocess.run(
            cmd, capture_output=True, text=True, cwd=cwd, timeout=timeout
        )
        if result.returncode != 0:
            print(f"[WARN] Command failed: {' '.join(cmd)}")
            print(f"  stderr: {result.stderr[:500]}")
        return result.stdout
    except subprocess.TimeoutExpired:
        print(f"[ERROR] Command timed out: {' '.join(cmd)}")
        return ""


def clone_or_update_repo(repo_dir: str) -> bool:
    """克隆或更新内核仓库"""
    if os.path.exists(os.path.join(repo_dir, ".git")):
        print(f"[INFO] 仓库已存在: {repo_dir}，正在更新...")
        run_cmd(["git", "fetch", "--tags", "--prune"], cwd=repo_dir, timeout=1800)
        return True
    else:
        print(f"[INFO] 正在克隆内核仓库到: {repo_dir}")
        print(f"[INFO] 仓库地址: {KERNEL_REPO}")
        print("[INFO] 这可能需要较长时间（仓库约 2-5GB）...")

        # 使用 --depth 1 先浅克隆，然后 unshallow 获取标签
        # 或者直接完整克隆（更可靠）
        result = run_cmd(
            ["git", "clone", "--bare", "--filter=blob:none", KERNEL_REPO, repo_dir],
            timeout=7200,  # 2 hours max
        )
        if not os.path.exists(os.path.join(repo_dir, "HEAD")):
            print("[ERROR] 克隆失败")
            return False
        print("[INFO] 克隆完成")
        return True


def verify_tags(repo_dir: str, old_tag: str, new_tag: str) -> bool:
    """验证标签是否存在"""
    tags_output = run_cmd(["git", "tag", "-l"], cwd=repo_dir)
    available_tags = set(tags_output.strip().split("\n"))

    missing = []
    if old_tag not in available_tags:
        missing.append(old_tag)
    if new_tag not in available_tags:
        missing.append(new_tag)

    if missing:
        print(f"[ERROR] 以下标签不存在: {', '.join(missing)}")
        # 显示类似的标签
        similar = [t for t in available_tags if "6.12" in t or "2025" in t]
        if similar:
            print(f"[INFO] 可用的相关标签: {', '.join(sorted(similar)[:20])}")
        return False
    return True


def get_commits_between_tags(repo_dir: str, old_tag: str, new_tag: str) -> list[CommitInfo]:
    """获取两个标签之间的所有提交"""
    print(f"[INFO] 正在获取 {old_tag}..{new_tag} 之间的提交...")

    # 格式: hash|subject|author|date
    log_format = "%H|%s|%an|%ai"
    output = run_cmd(
        ["git", "log", f"{old_tag}..{new_tag}", f"--pretty=format:{log_format}"],
        cwd=repo_dir,
        timeout=300,
    )

    commits = []
    for line in output.strip().split("\n"):
        if not line.strip():
            continue
        parts = line.split("|", 3)
        if len(parts) < 4:
            continue
        commits.append(
            CommitInfo(
                hash=parts[0].strip(),
                subject=parts[1].strip(),
                author=parts[2].strip(),
                date=parts[3].strip(),
            )
        )

    print(f"[INFO] 共找到 {len(commits)} 个提交")
    return commits


def get_subsystem(filepath: str) -> str:
    """根据文件路径判断所属子系统"""
    parts = filepath.split("/")
    if not parts:
        return "other"

    top = parts[0]
    if top == "drivers" and len(parts) > 1:
        return f"drivers/{parts[1]}"
    elif top in ("net", "fs", "kernel", "arch", "mm", "block", "crypto",
                 "security", "sound", "lib", "ipc", "init", "virt"):
        return top
    elif top == "include":
        return "include"
    elif top == "Documentation":
        return "docs"
    elif top in ("tools", "scripts"):
        return top
    return "other"


def analyze_commit(repo_dir: str, commit: CommitInfo) -> None:
    """分析单个提交对 KO 的影响"""
    # 获取这个提交修改的文件列表
    diff_output = run_cmd(
        ["git", "diff-tree", "--no-commit-id", "-r", "--name-status", commit.hash],
        cwd=repo_dir,
        timeout=60,
    )

    ko_reasons = []
    has_kconfig = False
    has_makefile = False
    has_export_symbol = False
    has_module_code = False
    has_driver_code = False
    affected_subsystems = set()

    for line in diff_output.strip().split("\n"):
        if not line.strip():
            continue
        parts = line.split("\t", 1)
        if len(parts) < 2:
            continue

        status = parts[0].strip()
        filepath = parts[1].strip()
        commit.files_changed.append(filepath)

        subsystem = get_subsystem(filepath)
        affected_subsystems.add(subsystem)

        filename = os.path.basename(filepath)

        # 检查 Kconfig
        if filename == "Kconfig" or filename.startswith("Kconfig."):
            has_kconfig = True
            ko_reasons.append(f"修改了 Kconfig: {filepath}")

        # 检查 Makefile
        if filename == "Makefile" or filename == "Kbuild":
            has_makefile = True
            ko_reasons.append(f"修改了构建文件: {filepath}")

        # 检查是否是驱动代码
        if filepath.startswith("drivers/") and (filepath.endswith(".c") or filepath.endswith(".h")):
            has_driver_code = True

        # 检查模块相关源码
        if filepath.endswith(".c"):
            # 获取文件 diff 内容检查关键字
            diff_content = run_cmd(
                ["git", "diff-tree", "-p", commit.hash, "--", filepath],
                cwd=repo_dir,
                timeout=30,
            )
            if "EXPORT_SYMBOL" in diff_content or "EXPORT_SYMBOL_GPL" in diff_content:
                has_export_symbol = True
                ko_reasons.append(f"修改了导出符号 (EXPORT_SYMBOL): {filepath}")

            if "module_init" in diff_content or "module_exit" in diff_content:
                has_module_code = True
                ko_reasons.append(f"修改了模块入口/出口: {filepath}")

            if "MODULE_LICENSE" in diff_content or "MODULE_AUTHOR" in diff_content:
                has_module_code = True
                ko_reasons.append(f"修改了模块元信息: {filepath}")

    commit.subsystems = affected_subsystems
    commit.ko_reasons = ko_reasons

    # 综合判断 KO 影响等级
    if has_export_symbol or has_module_code:
        commit.ko_impact = "high"
    elif has_kconfig or has_makefile:
        commit.ko_impact = "medium"
    elif has_driver_code:
        commit.ko_impact = "low"
    else:
        commit.ko_impact = "none"

    # 获取统计信息
    stat_output = run_cmd(
        ["git", "diff-tree", "--no-commit-id", "--stat", commit.hash],
        cwd=repo_dir,
        timeout=30,
    )
    # 解析 insertions/deletions
    for line in stat_output.strip().split("\n"):
        match = re.search(r"(\d+) insertion", line)
        if match:
            commit.insertions = int(match.group(1))
        match = re.search(r"(\d+) deletion", line)
        if match:
            commit.deletions = int(match.group(1))


def generate_report(
    commits: list[CommitInfo],
    old_tag: str,
    new_tag: str,
    output_file: str = "kernel_analysis_report.md",
) -> str:
    """生成 Markdown 分析报告"""
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    # 统计数据
    total = len(commits)
    high_impact = [c for c in commits if c.ko_impact == "high"]
    medium_impact = [c for c in commits if c.ko_impact == "medium"]
    low_impact = [c for c in commits if c.ko_impact == "low"]
    no_impact = [c for c in commits if c.ko_impact == "none"]

    # 按子系统统计
    subsystem_counts = defaultdict(int)
    subsystem_ko_counts = defaultdict(int)
    for c in commits:
        for s in c.subsystems:
            subsystem_counts[s] += 1
            if c.ko_impact in ("high", "medium"):
                subsystem_ko_counts[s] += 1

    lines = []
    lines.append(f"# Android Kernel 版本对比分析报告")
    lines.append(f"")
    lines.append(f"> 生成时间: {now}")
    lines.append(f"> 对比范围: `{old_tag}` → `{new_tag}`")
    lines.append(f"> 总提交数: {total}")
    lines.append(f"")

    # 摘要
    lines.append(f"## 1. 摘要统计")
    lines.append(f"")
    lines.append(f"| 指标 | 数量 | 占比 |")
    lines.append(f"|------|------|------|")
    lines.append(f"| 总提交数 | {total} | 100% |")
    lines.append(f"| 高影响 KO 提交 | {len(high_impact)} | {len(high_impact)*100//max(total,1)}% |")
    lines.append(f"| 中影响 KO 提交 | {len(medium_impact)} | {len(medium_impact)*100//max(total,1)}% |")
    lines.append(f"| 低影响 KO 提交 | {len(low_impact)} | {len(low_impact)*100//max(total,1)}% |")
    lines.append(f"| 无 KO 影响 | {len(no_impact)} | {len(no_impact)*100//max(total,1)}% |")
    lines.append(f"")

    # 按子系统分布
    lines.append(f"## 2. 子系统提交分布")
    lines.append(f"")
    lines.append(f"| 子系统 | 总提交 | KO 相关 |")
    lines.append(f"|--------|--------|---------|")
    for sub in sorted(subsystem_counts.keys(), key=lambda x: subsystem_counts[x], reverse=True)[:30]:
        lines.append(f"| {sub} | {subsystem_counts[sub]} | {subsystem_ko_counts.get(sub, 0)} |")
    lines.append(f"")

    # 高风险提交详情
    lines.append(f"## 3. 高影响 KO 提交详情")
    lines.append(f"")
    if high_impact:
        for i, c in enumerate(high_impact, 1):
            lines.append(f"### 3.{i} {c.subject}")
            lines.append(f"")
            lines.append(f"- **Commit**: `{c.hash[:12]}`")
            lines.append(f"- **Author**: {c.author}")
            lines.append(f"- **Date**: {c.date}")
            lines.append(f"- **文件变更**: {len(c.files_changed)} 个文件 (+{c.insertions} -{c.deletions})")
            lines.append(f"- **影响子系统**: {', '.join(sorted(c.subsystems))}")
            lines.append(f"- **KO 影响原因**:")
            for reason in c.ko_reasons:
                lines.append(f"  - {reason}")
            lines.append(f"")
    else:
        lines.append(f"无高影响 KO 提交。")
        lines.append(f"")

    # 中风险提交
    lines.append(f"## 4. 中影响 KO 提交列表")
    lines.append(f"")
    if medium_impact:
        lines.append(f"| Commit | Subject | Author | 影响原因 |")
        lines.append(f"|--------|---------|--------|----------|")
        for c in medium_impact:
            reasons = "; ".join(c.ko_reasons[:2])
            lines.append(f"| `{c.hash[:10]}` | {c.subject[:60]} | {c.author} | {reasons} |")
    else:
        lines.append(f"无中影响 KO 提交。")
    lines.append(f"")

    # 所有提交列表
    lines.append(f"## 5. 完整提交列表")
    lines.append(f"")
    lines.append(f"| # | Commit | Subject | KO 影响 | 子系统 |")
    lines.append(f"|---|--------|---------|---------|--------|")
    for i, c in enumerate(commits, 1):
        impact_badge = {"high": "🔴高", "medium": "🟡中", "low": "🟢低", "none": "⚪无"}
        subs = ", ".join(sorted(c.subsystems)[:3])
        lines.append(
            f"| {i} | `{c.hash[:10]}` | {c.subject[:50]} | {impact_badge.get(c.ko_impact, '?')} | {subs} |"
        )
    lines.append(f"")

    # KO 模块影响矩阵
    lines.append(f"## 6. KO 模块影响矩阵")
    lines.append(f"")
    lines.append(f"以下子系统的修改最可能影响对应的 .ko 模块：")
    lines.append(f"")
    driver_subs = sorted(
        [s for s in subsystem_ko_counts if s.startswith("drivers/")],
        key=lambda x: subsystem_ko_counts[x],
        reverse=True,
    )
    if driver_subs:
        lines.append(f"| 驱动子系统 | KO 相关提交数 | 可能影响的模块 |")
        lines.append(f"|------------|--------------|---------------|")
        for sub in driver_subs:
            module_name = sub.replace("drivers/", "") + ".ko"
            lines.append(f"| {sub} | {subsystem_ko_counts[sub]} | {module_name} (及相关) |")
    else:
        lines.append(f"无直接驱动子系统的 KO 相关提交。")
    lines.append(f"")

    lines.append(f"---")
    lines.append(f"*报告由 kernel_diff_analysis.py 自动生成*")

    report_content = "\n".join(lines)

    with open(output_file, "w", encoding="utf-8") as f:
        f.write(report_content)

    print(f"[INFO] 报告已保存到: {output_file}")
    return report_content


def main():
    parser = argparse.ArgumentParser(description="Android Kernel 月度版本对比分析")
    parser.add_argument("old_tag", help="旧版本标签 (e.g., android-6.12-2025-08)")
    parser.add_argument("new_tag", help="新版本标签 (e.g., android-6.12-2025-12)")
    parser.add_argument("--repo-dir", default=DEFAULT_REPO_DIR, help="内核仓库目录")
    parser.add_argument("--output", default="kernel_analysis_report.md", help="报告输出文件名")
    parser.add_argument("--max-commits", type=int, default=0, help="最大分析提交数 (0=不限)")
    args = parser.parse_args()

    print("=" * 60)
    print("Android Common Kernel 版本对比分析")
    print(f"对比: {args.old_tag} → {args.new_tag}")
    print("=" * 60)

    # Step 1: 克隆/更新仓库
    if not clone_or_update_repo(args.repo_dir):
        sys.exit(1)

    # Step 2: 验证标签
    if not verify_tags(args.repo_dir, args.old_tag, args.new_tag):
        sys.exit(1)

    # Step 3: 获取提交列表
    commits = get_commits_between_tags(args.repo_dir, args.old_tag, args.new_tag)
    if not commits:
        print("[WARN] 两个标签之间没有提交")
        sys.exit(0)

    if args.max_commits > 0:
        commits = commits[: args.max_commits]
        print(f"[INFO] 限制分析前 {args.max_commits} 个提交")

    # Step 4: 分析每个提交
    print(f"[INFO] 开始分析 {len(commits)} 个提交的 KO 影响...")
    for i, commit in enumerate(commits, 1):
        if i % 50 == 0 or i == len(commits):
            print(f"[INFO] 进度: {i}/{len(commits)}")
        analyze_commit(args.repo_dir, commit)

    # Step 5: 生成报告
    print("[INFO] 正在生成分析报告...")
    report = generate_report(commits, args.old_tag, args.new_tag, args.output)

    # 打印摘要
    high = sum(1 for c in commits if c.ko_impact == "high")
    medium = sum(1 for c in commits if c.ko_impact == "medium")
    low = sum(1 for c in commits if c.ko_impact == "low")
    print()
    print("=" * 60)
    print(f"分析完成! 共 {len(commits)} 个提交")
    print(f"  高影响: {high}  中影响: {medium}  低影响: {low}")
    print(f"报告: {args.output}")
    print("=" * 60)


if __name__ == "__main__":
    main()
