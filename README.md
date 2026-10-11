# Resource Allocation Graph (RAG) Deadlock Visualizer

An interactive, full-stack web application for building, visualizing, and evaluating Resource Allocation Graphs (RAG) to detect deadlocks in operating systems. Built for educational demonstrations and academic evaluations, this simulator bridges theoretical OS concepts with real-time graph visualization and trace logging.

---

## Key Features

* **Dual-Engine Algorithmic Analysis:**
  * **Single-Instance Resources:** Executes Depth-First Search (DFS) Cycle Detection on directed process-resource dependencies O(V + E).
  * **Multi-Instance Resources:** Executes the Graph Reduction Algorithm using matrix evaluation to simulate unblocked process execution O(m × n²).
* **Interactive Vis.js Network Canvas:**
  * Custom node representations: Process nodes (Circles) and Resource nodes (Rectangles with instance capacities).
  * Explicit edge directions: Request edges (P → R, dashed arrows) and Allocation/Assignment edges (R → P, solid arrows).
  * Real-time drag, drop, and node color highlighting (**Red** for deadlocked state, **Green** for safe/reduced state).
* **Real-Time System Matrices (A, Q, V):**
  * Automatically calculates and displays the Allocation Matrix (A), Request Matrix (Q), and Available Vector (V) as graph edges are drawn.
* **Over-Allocation Validation Guard:**
  * Backend physical validation that catches impossible system configurations and raises `400 Bad Request` state errors.
* **Pre-loaded OS Textbook Scenarios:**
  * **Preset 1:** Single-Instance Deadlock Cycle (Circular wait state).
  * **Preset 2:** Safe Allocation State (Sequential process reduction).
  * **Preset 3:** Multi-Instance Graph Reduction (Cycle present, NO deadlock).
* **Execution Trace Console:**
  * Side panel detailing step-by-step reduction paths, cycle traversals, and system status logs for OS viva evaluations.

---

## Tech Stack

* **Backend:** Python 3.8+, Flask 3.x, Gunicorn
* **Frontend:** HTML5, CSS3, Tailwind CSS (via CDN)
* **Visualization Library:** Vis.js Network (via CDN)
* **Deployment:** Production-ready for Render, Heroku, or GitHub Pages

---

## Project Structure

```text
OS RAG/
├── app.py                  # Flask API server & algorithmic backend
├── requirements.txt        # Python dependencies
├── Procfile                # Gunicorn deployment configuration
├── templates/
│   └── index.html          # Web dashboard layout
└── static/
    └── js/
        └── main.js         # Vis.js graph controller & REST API handler
