#!/usr/bin/env python3
"""
AI 일정 생성 품질 테스트 — Python CLI

사용법:
  python scripts/test_scenarios.py                         # 전체, 동시 3개
  python scripts/test_scenarios.py --concurrency 5         # 동시 5개
  python scripts/test_scenarios.py --scenario tokyo-solo-3d  # 단건
  python scripts/test_scenarios.py --mock                  # mock 모드 (AI 비용 0)
  python scripts/test_scenarios.py --cycles 5              # 생성→검증 5사이클 반복
"""

import argparse
import json
import os
import sys

# Windows cp949 인코딩 문제 해결
if sys.platform == 'win32':
    import io
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from datetime import datetime

# ─── 설정 ─────────────────────────────────────────────

BASE_URL = os.environ.get("TEST_BASE_URL", "http://localhost:3000")
ADMIN_KEY = os.environ.get("ADMIN_TEST_KEY", "")
SCENARIOS_DIR = Path(__file__).parent.parent / "test" / "scenarios"
RESULTS_DIR = Path(__file__).parent.parent / "test" / "results"

# env.local에서 ADMIN_TEST_KEY 읽기 (환경변수 없으면)
if not ADMIN_KEY:
    env_path = Path(__file__).parent.parent / ".env.local"
    if env_path.exists():
        for line in env_path.read_text(encoding="utf-8").splitlines():
            if line.startswith("ADMIN_TEST_KEY="):
                ADMIN_KEY = line.split("=", 1)[1].strip()
                break

# ─── HTTP 클라이언트 ──────────────────────────────────

try:
    import requests
except ImportError:
    print("requests 패키지 필요: pip install requests")
    sys.exit(1)


def run_scenario(scenario: dict, mock: bool = False) -> dict:
    """단일 시나리오 실행 → 결과 dict 반환"""
    scenario_id = scenario["id"]
    start = time.time()

    headers = {"Content-Type": "application/json"}
    if ADMIN_KEY:
        headers["x-admin-key"] = ADMIN_KEY

    # mock 모드: AI_PROVIDER=mock 쿼리 파라미터 (서버에서 지원 시)
    url = f"{BASE_URL}/api/v1/admin/test-generate"
    if mock:
        url += "?mock=1"

    try:
        resp = requests.post(url, json=scenario, headers=headers, timeout=600)
        elapsed = time.time() - start

        if resp.status_code != 200:
            return {
                "id": scenario_id,
                "status": "ERROR",
                "error": f"HTTP {resp.status_code}: {resp.text[:200]}",
                "elapsed": elapsed,
                "validation": [],
            }

        data = resp.json().get("data", {})
        validation = data.get("validation", [])
        summary = data.get("summary", {})
        meta = data.get("meta", {})

        cost_data = data.get("cost", {})
        return {
            "id": scenario_id,
            "name": scenario.get("name", scenario_id),
            "status": "PASS" if summary.get("failed", 0) == 0 else "FAIL",
            "elapsed": elapsed,
            "validation": validation,
            "summary": summary,
            "meta": meta,
            "items": data.get("items", []),
            "tripSummary": data.get("tripSummary", ""),
            "cost": cost_data,
        }

    except requests.exceptions.Timeout:
        return {"id": scenario_id, "status": "TIMEOUT", "error": "600s 초과", "elapsed": 600, "validation": []}
    except Exception as e:
        return {"id": scenario_id, "status": "ERROR", "error": str(e), "elapsed": time.time() - start, "validation": []}


# ─── 출력 ─────────────────────────────────────────────

def print_table(results: list[dict]):
    """결과 요약 테이블 출력"""
    # 헤더
    checks = [
        "Trans", "TDur", "ICty", "1st", "Var",
        "Ovlp", "Hour", "Arr", "Dur", "Pace",
        "Lnch", "Dnr", "Budg", "Curr",
        "Geo", "Dupl", "Cord", "Clsd",
        "Comp", "Food",
    ]

    print()
    print("=" * 120)
    print(f"  {'Scenario':<30} {'Status':>6}  ", end="")
    for c in checks:
        print(f"{c:>5}", end="")
    print(f"  {'Time':>7}  {'Model':<20}")
    print("-" * 120)

    total_pass = 0
    total_fail = 0

    for r in results:
        status = r["status"]
        color = "\033[92m" if status == "PASS" else "\033[91m" if status in ("FAIL", "ERROR") else "\033[93m"
        reset = "\033[0m"

        name = r.get("name", r["id"])[:30]
        elapsed = f"{r['elapsed']:.1f}s"
        model = r.get("meta", {}).get("model", "")[:20]

        print(f"  {name:<30} {color}{status:>6}{reset}  ", end="")

        if r["validation"]:
            for v in r["validation"]:
                sym = "\033[92m  ✓  \033[0m" if v["pass"] else "\033[91m  ✗  \033[0m"
                print(sym, end="")
        else:
            print("  " + "  -  " * len(checks), end="")

        # 비용 표시
        cost_data = r.get("cost", {})
        cost_usd = cost_data.get("totalCostUSD", 0) if cost_data else 0
        cost_str = f"${cost_usd:.4f}" if cost_usd > 0 else ""

        print(f"  {elapsed:>7}  {cost_str:>8}  {model:<20}")

        if status == "PASS":
            total_pass += 1
        else:
            total_fail += 1

    print("-" * 120)
    total_cost = sum((r.get("cost") or {}).get("totalCostUSD", 0) for r in results)
    print(f"  Total: {total_pass} passed, {total_fail} failed, ${total_cost:.4f} total cost")
    print("=" * 120)

    # 실패 상세
    failed = [r for r in results if r["status"] != "PASS"]
    if failed:
        print()
        print("─── 실패 상세 ───")
        for r in failed:
            print(f"\n  ❌ {r.get('name', r['id'])}")
            if r.get("error"):
                print(f"     Error: {r['error']}")
            for v in r.get("validation", []):
                if not v["pass"]:
                    print(f"     [{v['id']}] {v['name']}: {v['details']}")


def save_results(results: list[dict]):
    """결과를 test/results/ 에 저장"""
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

    for r in results:
        path = RESULTS_DIR / f"{r['id']}.json"
        path.write_text(json.dumps(r, ensure_ascii=False, indent=2), encoding="utf-8")

    # 전체 요약
    summary_path = RESULTS_DIR / f"summary_{timestamp}.json"
    summary = {
        "timestamp": timestamp,
        "totalScenarios": len(results),
        "passed": sum(1 for r in results if r["status"] == "PASS"),
        "failed": sum(1 for r in results if r["status"] != "PASS"),
        "results": [{
            "id": r["id"],
            "status": r["status"],
            "elapsed": r["elapsed"],
            "passRate": r.get("summary", {}).get("passRate", "N/A"),
            "model": r.get("meta", {}).get("model", ""),
        } for r in results],
    }
    summary_path.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n  결과 저장: {RESULTS_DIR}/")


# ─── 메인 ─────────────────────────────────────────────

def main():
    global BASE_URL, ADMIN_KEY

    parser = argparse.ArgumentParser(description="TripPlan AI 품질 테스트")
    parser.add_argument("--concurrency", type=int, default=1, help="동시 실행 수 (기본: 1, 순차+딜레이로 429 방지)")
    parser.add_argument("--delay", type=int, default=15, help="순차 실행 시 시나리오 간 딜레이 초 (기본: 15)")
    parser.add_argument("--scenario", type=str, help="단일 시나리오 ID")
    parser.add_argument("--mock", action="store_true", help="Mock 모드 (AI 비용 0)")
    parser.add_argument("--cycles", type=int, default=1, help="테스트→피드백 반복 횟수 (기본: 1)")
    parser.add_argument("--base-url", type=str, default=BASE_URL, help="서버 URL")
    parser.add_argument("--key", type=str, help="ADMIN_TEST_KEY 직접 지정")
    parser.add_argument("--dir", type=str, help="시나리오 디렉토리 (기본: test/scenarios/)")
    args = parser.parse_args()

    BASE_URL = args.base_url
    if args.key:
        ADMIN_KEY = args.key

    scenarios_dir = Path(args.dir) if args.dir else SCENARIOS_DIR

    # 시나리오 로드
    if args.scenario:
        scenario_path = scenarios_dir / f"{args.scenario}.json"
        if not scenario_path.exists():
            # edge 폴더도 탐색
            scenario_path = SCENARIOS_DIR / "edge" / f"{args.scenario}.json"
        if not scenario_path.exists():
            print(f"시나리오 없음: {scenario_path}")
            sys.exit(1)
        scenarios = [json.loads(scenario_path.read_text(encoding="utf-8"))]
    else:
        scenarios = []
        for f in sorted(scenarios_dir.glob("*.json")):
            scenarios.append(json.loads(f.read_text(encoding="utf-8")))
        # edge 하위 폴더도 포함
        edge_dir = scenarios_dir / "edge"
        if edge_dir.exists():
            for f in sorted(edge_dir.glob("*.json")):
                scenarios.append(json.loads(f.read_text(encoding="utf-8")))

    if not scenarios:
        print("시나리오가 없습니다. test/scenarios/ 폴더 확인")
        sys.exit(1)

    print(f"\n🧪 TripPlan AI 품질 테스트")
    print(f"   시나리오: {len(scenarios)}개")
    print(f"   동시 실행: {args.concurrency}개")
    print(f"   모드: {'Mock' if args.mock else 'Real AI'}")
    print(f"   사이클: {args.cycles}회")
    print(f"   서버: {BASE_URL}")

    for cycle in range(1, args.cycles + 1):
        if args.cycles > 1:
            print(f"\n{'='*60}")
            print(f"  사이클 {cycle}/{args.cycles}")
            print(f"{'='*60}")

        results = []
        # 429 방지: 동시성 1이면 순차 실행 + 딜레이, 2 이상이면 ThreadPool
        if args.concurrency <= 1:
            for i, s in enumerate(scenarios):
                if i > 0:
                    import time as _time
                    _time.sleep(getattr(args, 'delay', 15))  # 시나리오 간 딜레이
                result = run_scenario(s, args.mock)
                results.append(result)
                status_sym = "✅" if result["status"] == "PASS" else "❌" if result["status"] == "FAIL" else "⚠️"
                print(f"  {status_sym} {result.get('name', s['id'])} ({result['elapsed']:.1f}s)")
                sys.stdout.flush()
        else:
            with ThreadPoolExecutor(max_workers=args.concurrency) as executor:
                futures = {executor.submit(run_scenario, s, args.mock): s["id"] for s in scenarios}

                for future in as_completed(futures):
                    scenario_id = futures[future]
                    result = future.result()
                    results.append(result)
                    status_sym = "✅" if result["status"] == "PASS" else "❌" if result["status"] == "FAIL" else "⚠️"
                    print(f"  {status_sym} {result.get('name', scenario_id)} ({result['elapsed']:.1f}s)")
                    sys.stdout.flush()

        # 원래 순서로 정렬
        scenario_order = {s["id"]: i for i, s in enumerate(scenarios)}
        results.sort(key=lambda r: scenario_order.get(r["id"], 999))

        print_table(results)
        save_results(results)

    print("\n완료!")


if __name__ == "__main__":
    main()
