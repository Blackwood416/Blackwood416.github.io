#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Export PyTorch dispatcher support info for all operators in the current environment.

Outputs:
  1) dispatch_records.jsonl   - one record per op x dispatch key line
  2) hardware_matrix.csv      - filtered to common hardware/backend keys

This reflects the exact PyTorch build currently installed.
"""

from __future__ import annotations

import csv
import json
import platform
import re
from pathlib import Path
from typing import Dict, Iterable, List, Optional

import torch


# Common hardware / backend keys you may want to expose on a blog.
# Add or remove keys as needed for your site.
HARDWARE_KEYS = [
    "CPU",
    "CUDA",
    "HIP",
    "MPS",
    "XPU",
    "XLA",
    "MTIA",
    "MAIA",
    "HPU",
    "Vulkan",
    "Metal",
    "Lazy",
    "VE",
    "FPGA",
    "PrivateUse1",
    "PrivateUse2",
    "PrivateUse3",
]

# Dispatcher dump table line format is roughly:
#   CPU: registered at ... [kernel]
#   CUDA: registered at ... [default backend kernel]
#   Python: registered at ... [backend fallback]
#   Conjugate: fallthrough registered at ... [kernel]
LINE_RE = re.compile(r"^(?P<key>[^:]+): (?P<body>.*) \[(?P<kind>[^\]]+)\]$")


def classify_line(body: str, kind: str) -> str:
    """
    Classify dispatcher entry into a compact status for blog display.
    """
    fallthrough = body.startswith("fallthrough ")

    if kind == "autograd kernel":
        return "autograd"
    if kind in ("math kernel", "default backend kernel"):
        return "composite"
    if kind == "backend fallback":
        return "fallback"
    if fallthrough:
        # e.g. "Conjugate: fallthrough registered ... [kernel]"
        return "fallback"
    if kind == "kernel":
        return "native"
    return "other"


def parse_dispatch_table(op_name: str, table: str) -> List[Dict[str, str]]:
    """
    Parse torch._C._dispatch_dump_table(op_name) into structured rows.
    """
    rows: List[Dict[str, str]] = []

    for raw_line in table.splitlines():
        line = raw_line.strip()
        if not line:
            continue

        m = LINE_RE.match(line)
        if not m:
            # Keep unparsed lines too, in case PyTorch changes the format later.
            rows.append(
                {
                    "op_name": op_name,
                    "dispatch_key": "",
                    "status": "unparsed",
                    "kind": "",
                    "body": line,
                    "raw_line": line,
                }
            )
            continue

        key = m.group("key").strip()
        body = m.group("body").strip()
        kind = m.group("kind").strip()
        status = classify_line(body, kind)

        rows.append(
            {
                "op_name": op_name,
                "dispatch_key": key,
                "status": status,
                "kind": kind,
                "body": body,
                "raw_line": line,
            }
        )

    return rows


def main() -> None:
    out_dir = Path(".").resolve()
    jsonl_path = out_dir / "dispatch_records.jsonl"
    csv_path = out_dir / "hardware_matrix.csv"

    meta = {
        "torch_version": torch.__version__,
        "python_version": platform.python_version(),
        "platform": platform.platform(),
        "machine": platform.machine(),
        "processor": platform.processor(),
        "ops_count": 0,
    }

    op_names = sorted(torch._C._dispatch_get_all_op_names())
    meta["ops_count"] = len(op_names)

    # Write all parsed records to JSONL.
    total_rows = 0
    with jsonl_path.open("w", encoding="utf-8") as f_jsonl:
        for op_name in op_names:
            try:
                table = torch._C._dispatch_dump_table(op_name)
            except Exception as e:
                # Keep failures visible rather than silently dropping ops.
                record = {
                    "op_name": op_name,
                    "dispatch_key": "",
                    "status": "error",
                    "kind": "",
                    "body": str(e),
                    "raw_line": str(e),
                }
                f_jsonl.write(json.dumps(record, ensure_ascii=False) + "\n")
                total_rows += 1
                continue

            for row in parse_dispatch_table(op_name, table):
                f_jsonl.write(json.dumps(row, ensure_ascii=False) + "\n")
                total_rows += 1

    # Build a hardware-focused CSV for easy blog consumption.
    # This CSV keeps only the common device/backend keys.
    hardware_keys = set(HARDWARE_KEYS)
    hardware_rows: List[Dict[str, str]] = []

    with jsonl_path.open("r", encoding="utf-8") as f_jsonl:
        for line in f_jsonl:
            row = json.loads(line)
            key = row.get("dispatch_key", "")
            if key in hardware_keys:
                hardware_rows.append(row)

    # CSV header
    fieldnames = ["op_name", "dispatch_key", "status", "kind", "body", "raw_line"]

    with csv_path.open("w", encoding="utf-8", newline="") as f_csv:
        writer = csv.DictWriter(f_csv, fieldnames=fieldnames)
        writer.writeheader()
        for row in hardware_rows:
            writer.writerow({k: row.get(k, "") for k in fieldnames})

    # Print a small summary for convenience.
    print("Export done.")
    print(f"PyTorch version: {meta['torch_version']}")
    print(f"Operator count : {meta['ops_count']}")
    print(f"JSONL records   : {total_rows}")
    print(f"JSONL path      : {jsonl_path}")
    print(f"CSV path        : {csv_path}")


if __name__ == "__main__":
    main()
