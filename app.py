"""
Resource Allocation Graph (RAG) Deadlock Detection Engine
Dual-Mode: Single-Instance (DFS Cycle Detection) & Multi-Instance (Graph Reduction).
Clean, modular, and optimized for OS Viva presentation.
"""
from collections import defaultdict
from flask import Flask, render_template, request, jsonify

app = Flask(__name__)

# --- 1. Graph Parsing & Over-Allocation Validation ---
def parse_and_validate_rag(data):
    """Parses processes, resources, edge matrices and checks capacity limits."""
    nodes, edges = data.get("nodes", []), data.get("edges", [])
    processes = [str(n["id"]) for n in nodes if n.get("type") == "process"]
    resources = {str(n["id"]): max(1, int(n.get("instances", 1))) for n in nodes if n.get("type") == "resource"}

    alloc = {p: defaultdict(int) for p in processes}
    req = {p: defaultdict(int) for p in processes}
    assigned_total = defaultdict(int)

    for e in edges:
        u, v, etype = str(e.get("from")), str(e.get("to")), str(e.get("type", "")).lower()
        if etype == "request" or (u in processes and v in resources):
            if u in processes and v in resources: req[u][v] += 1
        elif etype == "assignment" or (u in resources and v in processes):
            if v in processes and u in resources:
                alloc[v][u] += 1
                assigned_total[u] += 1

    over_allocated = [r for r, cap in resources.items() if assigned_total[r] > cap]
    return processes, resources, alloc, req, assigned_total, edges, over_allocated

# --- 2. Single-Instance Mode: DFS Directed Cycle Detection ---
def detect_single_instance_dfs(processes, resources, edges):
    """Single-instance RAG: A directed cycle is necessary & sufficient for deadlock."""
    steps = ["[INIT] Mode: Single-Instance (all capacity == 1). Running DFS Cycle Detection."]
    adj = defaultdict(list)
    for e in edges: adj[str(e.get("from"))].append(str(e.get("to")))

    visited, rec_stack, cycle_path = set(), set(), []

    def dfs(node, path):
        visited.add(node); rec_stack.add(node); path.append(node)
        for nxt in adj.get(node, []):
            if nxt not in visited:
                if dfs(nxt, path): return True
            elif nxt in rec_stack:
                cycle_path.extend(path[path.index(nxt):] + [nxt])
                return True
        rec_stack.remove(node); path.pop()
        return False

    for node in processes + list(resources.keys()):
        if node not in visited and dfs(node, []): break

    is_dl = len(cycle_path) > 0
    d_procs = [n for n in set(cycle_path) if n in processes]
    d_res = [n for n in set(cycle_path) if n in resources]

    if is_dl:
        steps.append(f"[CYCLE] Directed cycle detected: {' -> '.join(cycle_path)}")
        steps.append(f"[DEADLOCK] Deadlocked processes: {', '.join(d_procs) or 'None'}")
        steps.append(f"[DEADLOCK] Deadlocked resources: {', '.join(d_res) or 'None'}")
    else:
        steps.append("[SAFE] No directed cycle detected. System is safe and deadlock-free.")
    return is_dl, d_procs, d_res, cycle_path, steps

# --- 3. Multi-Instance Mode: Graph Reduction Algorithm ---
def detect_multi_instance_reduction(processes, resources, alloc, req, assigned_total):
    """Multi-instance RAG: Iteratively reduce unblocked processes (Requests <= Work)."""
    steps = ["[INIT] Mode: Multi-Instance (Capacity > 1). Running Graph Reduction Algorithm."]
    work = {r: resources[r] - assigned_total[r] for r in resources}
    for r, cap in resources.items():
        steps.append(f"[WORK] Resource '{r}': Available={work[r]} (Capacity={cap}, Assigned={assigned_total[r]})")

    finish, reduced_order = {p: False for p in processes}, []
    while True:
        unblocked = next((p for p in processes if not finish[p] and all(req[p][r] <= work[r] for r in resources)), None)
        if not unblocked: break
        for r in resources: work[r] += alloc[unblocked][r]
        finish[unblocked] = True
        reduced_order.append(unblocked)
        steps.append(f"[REDUCE] Process '{unblocked}' unblocked & reduced. Released holdings -> Work={dict(work)}")

    d_procs = [p for p in processes if not finish[p]]
    d_res = [r for r in resources if any(req[p][r] > work[r] for p in d_procs)]
    is_dl = len(d_procs) > 0

    if is_dl:
        steps.append(f"[DEADLOCK] Graph reduction stalled! Deadlocked processes: {', '.join(d_procs)}")
        steps.append(f"[DEADLOCK] Unsatisfied resources: {', '.join(d_res) or 'None'}")
    else:
        steps.append(f"[SAFE] All processes successfully reduced! Safe reduction order: {' -> '.join(reduced_order) or 'None'}")
    return is_dl, d_procs, d_res, [], steps

# --- 4. Flask API Routes ---
@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/detect-deadlock", methods=["POST"])
def detect_deadlock():
    data = request.get_json() or {}
    procs, res_caps, alloc, req, assigned, edges, over_allocated = parse_and_validate_rag(data)

    if over_allocated:
        err_log = [f"[ERROR] Resource '{r}' over-allocated: assigned ({assigned[r]}) > capacity ({res_caps[r]})!" for r in over_allocated]
        return jsonify({
            "is_deadlocked": False, "deadlocked_processes": [], "deadlocked_resources": over_allocated,
            "cycle_path": [], "trace_log": err_log, "error": f"Over-allocation detected on: {', '.join(over_allocated)}"
        }), 400

    is_single = len(res_caps) > 0 and all(cap == 1 for cap in res_caps.values())
    if is_single:
        is_dl, d_procs, d_res, cycle, logs = detect_single_instance_dfs(procs, res_caps, edges)
        alg = "Single-Instance DFS"
    else:
        is_dl, d_procs, d_res, cycle, logs = detect_multi_instance_reduction(procs, res_caps, alloc, req, assigned)
        alg = "Multi-Instance Graph Reduction"

    return jsonify({
        "is_deadlocked": is_dl, "deadlocked_processes": d_procs, "deadlocked_resources": d_res,
        "cycle_path": cycle, "trace_log": logs, "algorithm_used": alg,
        "satisfied_processes": [p for p in procs if p not in d_procs]
    })

if __name__ == "__main__":
    print("RAG Deadlock Detection Server running at http://127.0.0.1:5000")
    app.run(host="127.0.0.1", port=5000, debug=True)
