/**
 * RAG Deadlock Detection & Graph Reduction Engine - Frontend Controller
 * Tech Stack: Tailwind CSS + Vis.js Network
 * Implements real-time system matrices (A, Q, V), dual-mode visualization,
 * and iterative (non-recursive) color updates to prevent call stack overflow.
 */

// Global Vis.js DataSets and Network Engine instance
let nodesDataset = new vis.DataSet([]);
let edgesDataset = new vis.DataSet([]);
let network = null;

// Re-entrancy guard to prevent event listener loops during programmatic color updates
let isUpdatingColors = false;
let physicsEnabled = true;

// UI Theme Palette Constants
const COLORS = {
    process: {
        background: '#0284c7', // Sky-600
        border: '#38bdf8',     // Sky-400
        highlight: { background: '#0369a1', border: '#7dd3fc' }
    },
    resource: {
        background: '#d97706', // Amber-600
        border: '#fbbf24',     // Amber-400
        highlight: { background: '#b45309', border: '#fde68a' }
    },
    deadlocked: {
        background: '#dc2626', // Red-600
        border: '#f87171',     // Red-400
        highlight: { background: '#b91c1c', border: '#fca5a5' }
    },
    satisfied: {
        background: '#059669', // Emerald-600
        border: '#34d399',     // Emerald-400
        highlight: { background: '#047857', border: '#6ee7b7' }
    },
    edgeRequest: '#38bdf8',    // Sky-400
    edgeAssign: '#f59e0b',     // Amber-500
    edgeDeadlock: '#ef4444'    // Red-500
};

// Initialize Canvas & Network on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    initNetwork();
    loadPreset('preset1'); // Load default textbook scenario (Single-instance cycle)
});

/**
 * Configure and initialize Vis.js Network instance
 */
function initNetwork() {
    const container = document.getElementById('mynetwork');
    const data = { nodes: nodesDataset, edges: edgesDataset };

    const options = {
        nodes: {
            font: { color: '#ffffff', face: 'Fira Code', size: 14, bold: true },
            borderWidth: 2,
            shadow: { enabled: true, color: 'rgba(0,0,0,0.5)', size: 10, x: 0, y: 4 }
        },
        edges: {
            width: 2,
            smooth: { type: 'continuous', roundness: 0.2 },
            arrows: { to: { enabled: true, scaleFactor: 0.85 } },
            shadow: { enabled: true, color: 'rgba(0,0,0,0.4)', size: 6, x: 0, y: 2 }
        },
        physics: {
            enabled: true,
            solver: 'barnesHut',
            barnesHut: {
                gravitationalConstant: -2500,
                centralGravity: 0.25,
                springLength: 130,
                springConstant: 0.04,
                damping: 0.1
            },
            stabilization: { iterations: 150 }
        },
        interaction: {
            hover: true,
            dragNodes: true,
            dragView: true,
            zoomView: true,
            selectConnectedEdges: false
        }
    };

    network = new vis.Network(container, data, options);

    // Event listener: Reset highlight colors when user clicks blank canvas
    network.on('click', (params) => {
        if (!params.nodes.length && !params.edges.length && !isUpdatingColors) {
            resetGraphColors();
        }
    });

    // Reactive sync listeners for datasets
    nodesDataset.on('add', onGraphMutation);
    nodesDataset.on('remove', onGraphMutation);
    nodesDataset.on('update', () => {
        if (!isUpdatingColors) onGraphMutation();
    });

    edgesDataset.on('add', onGraphMutation);
    edgesDataset.on('remove', onGraphMutation);
    edgesDataset.on('update', () => {
        if (!isUpdatingColors) onGraphMutation();
    });
}

/**
 * Handle graph mutation: sync UI indicators, matrix tables, and dropdowns
 */
function onGraphMutation() {
    updateAlgorithmIndicator();
    updateSelectDropdowns();
    computeAndRenderMatrices();
}

/**
 * Center and fit graph inside canvas
 */
function fitNetwork() {
    if (network) network.fit({ animation: { duration: 400, easingFunction: 'easeInOutQuad' } });
}

/**
 * Toggle layout physics on/off
 */
function togglePhysics() {
    physicsEnabled = !physicsEnabled;
    if (network) network.setOptions({ physics: { enabled: physicsEnabled } });
    const btn = document.getElementById('btn-physics');
    if (btn) {
        btn.innerText = physicsEnabled ? 'Physics: ON' : 'Physics: FROZEN';
        btn.className = physicsEnabled
            ? 'px-2 py-1 hover:bg-slate-800 rounded-lg text-sky-400 text-[11px] font-mono transition'
            : 'px-2 py-1 hover:bg-slate-800 rounded-lg text-amber-400 text-[11px] font-mono transition';
    }
}

/**
 * Update the Dynamic Algorithm Indicator badge based on declared resource capacities
 */
function updateAlgorithmIndicator() {
    const badge = document.getElementById('algorithm-badge');
    const badgeText = document.getElementById('alg-name-display');
    const badgeDot = document.getElementById('alg-indicator-dot');
    if (!badge || !badgeText) return;

    const resources = nodesDataset.get().filter(n => n.nodeType === 'resource');

    if (resources.length === 0) {
        badgeText.innerText = 'Ready (Auto-Detect)';
        badge.className = 'px-3.5 py-1.5 rounded-full bg-slate-800/80 border border-slate-700 text-xs text-slate-300 font-medium flex items-center gap-2 shadow-sm transition-all';
        if (badgeDot) badgeDot.className = 'w-2 h-2 rounded-full bg-slate-400';
        return;
    }

    const isSingleInstance = resources.every(r => (parseInt(r.instances) || 1) === 1);

    if (isSingleInstance) {
        badgeText.innerText = 'Single-Instance DFS Cycle Engine';
        badge.className = 'px-3.5 py-1.5 rounded-full bg-sky-950/80 border border-sky-500/50 text-xs text-sky-300 font-medium flex items-center gap-2 shadow-md shadow-sky-500/20 transition-all';
        if (badgeDot) badgeDot.className = 'w-2 h-2 rounded-full bg-sky-400 animate-pulse';
    } else {
        badgeText.innerText = 'Multi-Instance Graph Reduction Engine';
        badge.className = 'px-3.5 py-1.5 rounded-full bg-amber-950/80 border border-amber-500/50 text-xs text-amber-300 font-medium flex items-center gap-2 shadow-md shadow-amber-500/20 transition-all';
        if (badgeDot) badgeDot.className = 'w-2 h-2 rounded-full bg-amber-400 animate-pulse';
    }
}

/**
 * Populate Source and Target dropdowns for edge creation
 */
function updateSelectDropdowns() {
    const fromSelect = document.getElementById('edge-from-select');
    const toSelect = document.getElementById('edge-to-select');
    if (!fromSelect || !toSelect) return;

    const currentFrom = fromSelect.value;
    const currentTo = toSelect.value;

    fromSelect.innerHTML = '';
    toSelect.innerHTML = '';

    const nodes = nodesDataset.get();
    for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        const label = `${node.id} (${node.nodeType === 'process' ? 'Process' : 'Resource'})`;
        fromSelect.add(new Option(label, node.id));
        toSelect.add(new Option(label, node.id));
    }

    if (currentFrom && nodesDataset.get(currentFrom)) fromSelect.value = currentFrom;
    if (currentTo && nodesDataset.get(currentTo)) toSelect.value = currentTo;
}

/**
 * Reset node & edge colors strictly via iterative array updates (NO recursion)
 */
function resetGraphColors() {
    if (isUpdatingColors) return;
    isUpdatingColors = true;

    try {
        const nodes = nodesDataset.get();
        const nodeUpdates = [];
        for (let i = 0; i < nodes.length; i++) {
            const node = nodes[i];
            const isProc = node.nodeType === 'process';
            nodeUpdates.push({
                id: node.id,
                color: {
                    background: isProc ? COLORS.process.background : COLORS.resource.background,
                    border: isProc ? COLORS.process.border : COLORS.resource.border,
                    highlight: isProc ? COLORS.process.highlight : COLORS.resource.highlight
                },
                font: { color: '#ffffff' }
            });
        }
        if (nodeUpdates.length > 0) {
            nodesDataset.update(nodeUpdates);
        }

        const edges = edgesDataset.get();
        const edgeUpdates = [];
        for (let i = 0; i < edges.length; i++) {
            const edge = edges[i];
            const isReq = edge.edgeType === 'request';
            edgeUpdates.push({
                id: edge.id,
                color: { color: isReq ? COLORS.edgeRequest : COLORS.edgeAssign },
                width: 2
            });
        }
        if (edgeUpdates.length > 0) {
            edgesDataset.update(edgeUpdates);
        }

        const verdictDetail = document.getElementById('verdict-detail');
        if (verdictDetail && verdictDetail.innerText.includes('Cycle')) {
            setVerdict('Awaiting Detection', 'text-slate-300', 'Colors reset to default state');
        }
    } finally {
        isUpdatingColors = false;
    }
}

/**
 * Add a Process node to canvas
 */
function addProcessNode() {
    const input = document.getElementById('proc-id-input');
    let id = input.value.trim().toUpperCase();

    // Auto-generate next P number if empty
    if (!id) {
        let idx = 1;
        while (nodesDataset.get(`P${idx}`)) idx++;
        id = `P${idx}`;
    }

    if (nodesDataset.get(id)) {
        alert(`Node with ID '${id}' already exists.`);
        return;
    }

    nodesDataset.add({
        id: id,
        label: id,
        shape: 'circle',
        nodeType: 'process',
        color: {
            background: COLORS.process.background,
            border: COLORS.process.border,
            highlight: COLORS.process.highlight
        }
    });

    input.value = '';
    resetGraphColors();
}

/**
 * Add a Resource node to canvas with capacity/instances
 */
function addResourceNode() {
    const resInput = document.getElementById('res-id-input');
    const instInput = document.getElementById('res-inst-input');

    let id = resInput.value.trim().toUpperCase();
    const instances = Math.max(1, parseInt(instInput.value) || 1);

    // Auto-generate next R number if empty
    if (!id) {
        let idx = 1;
        while (nodesDataset.get(`R${idx}`)) idx++;
        id = `R${idx}`;
    }

    if (nodesDataset.get(id)) {
        alert(`Node with ID '${id}' already exists.`);
        return;
    }

    nodesDataset.add({
        id: id,
        label: `${id}\n[Cap: ${instances}]`,
        shape: 'box',
        nodeType: 'resource',
        instances: instances,
        color: {
            background: COLORS.resource.background,
            border: COLORS.resource.border,
            highlight: COLORS.resource.highlight
        }
    });

    resInput.value = '';
    instInput.value = '1';
    resetGraphColors();
}

/**
 * Add a Directed Edge (Request or Assignment) with validation
 */
function addEdge() {
    const fromId = document.getElementById('edge-from-select').value;
    const toId = document.getElementById('edge-to-select').value;
    const edgeType = document.getElementById('edge-type-select').value;

    if (!fromId || !toId) {
        alert('Please select both Source and Target nodes.');
        return;
    }

    if (fromId === toId) {
        alert('Self-loop edges are not allowed in a Resource Allocation Graph.');
        return;
    }

    const fromNode = nodesDataset.get(fromId);
    const toNode = nodesDataset.get(toId);

    // Validate edge direction semantics:
    // Request: Process -> Resource
    // Assignment: Resource -> Process
    if (edgeType === 'request' && (fromNode.nodeType !== 'process' || toNode.nodeType !== 'resource')) {
        alert('Invalid Edge: A Request edge must originate from a Process and point to a Resource (P → R).');
        return;
    }
    if (edgeType === 'assignment' && (fromNode.nodeType !== 'resource' || toNode.nodeType !== 'process')) {
        alert('Invalid Edge: An Assignment edge must originate from a Resource and point to a Process (R → P).');
        return;
    }

    const edgeId = `${fromId}->${toId}`;
    if (edgesDataset.get(edgeId)) {
        alert(`Edge '${edgeId}' already exists.`);
        return;
    }

    const isRequest = edgeType === 'request';
    edgesDataset.add({
        id: edgeId,
        from: fromId,
        to: toId,
        edgeType: edgeType,
        dashes: isRequest,
        color: { color: isRequest ? COLORS.edgeRequest : COLORS.edgeAssign }
    });

    resetGraphColors();
}

/**
 * Delete currently selected node or edge on canvas
 */
function deleteSelected() {
    const selection = network ? network.getSelection() : null;
    if (!selection) return;

    if (selection.nodes && selection.nodes.length > 0) {
        nodesDataset.remove(selection.nodes);
    } else if (selection.edges && selection.edges.length > 0) {
        edgesDataset.remove(selection.edges);
    } else {
        alert('Click a node or edge on the canvas first to select it for deletion.');
    }
    resetGraphColors();
}

/**
 * Clear canvas completely
 */
function clearGraph() {
    nodesDataset.clear();
    edgesDataset.clear();
    clearLogs();
    document.getElementById('preset-select').value = 'custom';
    setVerdict('Canvas Cleared', 'text-slate-400', 'Add nodes or load a preset scenario');
}

/**
 * Load classical Operating System RAG Presets
 */
function loadPreset(presetKey) {
    nodesDataset.clear();
    edgesDataset.clear();
    clearLogs();

    if (presetKey === 'preset1') {
        // Preset 1: Single-Instance Deadlock Cycle (P1 <-> R1 <-> P2 <-> R2)
        nodesDataset.add([
            { id: 'P1', label: 'P1', shape: 'circle', nodeType: 'process', color: { background: COLORS.process.background, border: COLORS.process.border } },
            { id: 'P2', label: 'P2', shape: 'circle', nodeType: 'process', color: { background: COLORS.process.background, border: COLORS.process.border } },
            { id: 'R1', label: 'R1\n[Cap: 1]', shape: 'box', nodeType: 'resource', instances: 1, color: { background: COLORS.resource.background, border: COLORS.resource.border } },
            { id: 'R2', label: 'R2\n[Cap: 1]', shape: 'box', nodeType: 'resource', instances: 1, color: { background: COLORS.resource.background, border: COLORS.resource.border } }
        ]);

        edgesDataset.add([
            { id: 'P1->R1', from: 'P1', to: 'R1', edgeType: 'request', dashes: true, color: { color: COLORS.edgeRequest } },
            { id: 'R1->P2', from: 'R1', to: 'P2', edgeType: 'assignment', dashes: false, color: { color: COLORS.edgeAssign } },
            { id: 'P2->R2', from: 'P2', to: 'R2', edgeType: 'request', dashes: true, color: { color: COLORS.edgeRequest } },
            { id: 'R2->P1', from: 'R2', to: 'P1', edgeType: 'assignment', dashes: false, color: { color: COLORS.edgeAssign } }
        ]);

        logStep('[INIT] Loaded Preset 1: Single-Instance Circular Wait Deadlock.');
        logStep('[INFO] P1 requests R1 (held by P2); P2 requests R2 (held by P1). Directed cycle exists!');

    } else if (presetKey === 'preset2') {
        // Preset 2: Safe Single-Instance State
        nodesDataset.add([
            { id: 'P1', label: 'P1', shape: 'circle', nodeType: 'process', color: { background: COLORS.process.background, border: COLORS.process.border } },
            { id: 'P2', label: 'P2', shape: 'circle', nodeType: 'process', color: { background: COLORS.process.background, border: COLORS.process.border } },
            { id: 'R1', label: 'R1\n[Cap: 1]', shape: 'box', nodeType: 'resource', instances: 1, color: { background: COLORS.resource.background, border: COLORS.resource.border } }
        ]);

        edgesDataset.add([
            { id: 'R1->P1', from: 'R1', to: 'P1', edgeType: 'assignment', dashes: false, color: { color: COLORS.edgeAssign } },
            { id: 'P2->R1', from: 'P2', to: 'R1', edgeType: 'request', dashes: true, color: { color: COLORS.edgeRequest } }
        ]);

        logStep('[INIT] Loaded Preset 2: Safe Allocation State.');
        logStep('[INFO] P1 holds R1; P2 waits on R1. When P1 completes, P2 runs without deadlock.');

    } else if (presetKey === 'preset3') {
        // Preset 3: Multi-Instance Graph Reduction (Cycle present, NO deadlock!)
        nodesDataset.add([
            { id: 'P1', label: 'P1', shape: 'circle', nodeType: 'process', color: { background: COLORS.process.background, border: COLORS.process.border } },
            { id: 'P2', label: 'P2', shape: 'circle', nodeType: 'process', color: { background: COLORS.process.background, border: COLORS.process.border } },
            { id: 'P3', label: 'P3', shape: 'circle', nodeType: 'process', color: { background: COLORS.process.background, border: COLORS.process.border } },
            { id: 'R1', label: 'R1\n[Cap: 2]', shape: 'box', nodeType: 'resource', instances: 2, color: { background: COLORS.resource.background, border: COLORS.resource.border } },
            { id: 'R2', label: 'R2\n[Cap: 1]', shape: 'box', nodeType: 'resource', instances: 1, color: { background: COLORS.resource.background, border: COLORS.resource.border } }
        ]);

        edgesDataset.add([
            { id: 'R1->P1', from: 'R1', to: 'P1', edgeType: 'assignment', dashes: false, color: { color: COLORS.edgeAssign } },
            { id: 'P1->R2', from: 'P1', to: 'R2', edgeType: 'request', dashes: true, color: { color: COLORS.edgeRequest } },
            { id: 'R2->P2', from: 'R2', to: 'P2', edgeType: 'assignment', dashes: false, color: { color: COLORS.edgeAssign } },
            { id: 'P2->R1', from: 'P2', to: 'R1', edgeType: 'request', dashes: true, color: { color: COLORS.edgeRequest } },
            { id: 'R1->P3', from: 'R1', to: 'P3', edgeType: 'assignment', dashes: false, color: { color: COLORS.edgeAssign } }
        ]);

        logStep('[INIT] Loaded Preset 3: Multi-Instance Graph Reduction without Deadlock.');
        logStep('[INFO] A cycle exists (P1-R2-P2-R1), but P3 holds R1 without requesting anything.');
        logStep('[INFO] P3 can finish and release R1, resolving the cycle and reducing all processes!');

    } else if (presetKey === 'preset4') {
        // Preset 4: Multi-Instance Deadlock (Reduction stalls)
        nodesDataset.add([
            { id: 'P1', label: 'P1', shape: 'circle', nodeType: 'process', color: { background: COLORS.process.background, border: COLORS.process.border } },
            { id: 'P2', label: 'P2', shape: 'circle', nodeType: 'process', color: { background: COLORS.process.background, border: COLORS.process.border } },
            { id: 'R1', label: 'R1\n[Cap: 2]', shape: 'box', nodeType: 'resource', instances: 2, color: { background: COLORS.resource.background, border: COLORS.resource.border } },
            { id: 'R2', label: 'R2\n[Cap: 2]', shape: 'box', nodeType: 'resource', instances: 2, color: { background: COLORS.resource.background, border: COLORS.resource.border } }
        ]);

        edgesDataset.add([
            { id: 'R1->P1', from: 'R1', to: 'P1', edgeType: 'assignment', dashes: false, color: { color: COLORS.edgeAssign } },
            { id: 'R2->P1', from: 'R2', to: 'P1', edgeType: 'assignment', dashes: false, color: { color: COLORS.edgeAssign } },
            { id: 'R1->P2', from: 'R1', to: 'P2', edgeType: 'assignment', dashes: false, color: { color: COLORS.edgeAssign } },
            { id: 'R2->P2', from: 'R2', to: 'P2', edgeType: 'assignment', dashes: false, color: { color: COLORS.edgeAssign } },
            { id: 'P1->R1', from: 'P1', to: 'R1', edgeType: 'request', dashes: true, color: { color: COLORS.edgeRequest } },
            { id: 'P2->R2', from: 'P2', to: 'R2', edgeType: 'request', dashes: true, color: { color: COLORS.edgeRequest } }
        ]);

        logStep('[INIT] Loaded Preset 4: Multi-Instance Deadlock (Reduction Stalled).');
        logStep('[INFO] All 2 instances of R1 & R2 are allocated. P1 and P2 request further instances with Work=0.');
    }

    setVerdict('Preset Loaded', 'text-sky-300', 'Ready to run deadlock detection');
    setTimeout(() => { fitNetwork(); }, 200);
}

/**
 * Real-Time System Matrix Calculation & DOM Rendering (A, Q, V)
 */
function computeAndRenderMatrices() {
    const allocContainer = document.getElementById('allocation-matrix-container');
    const reqContainer = document.getElementById('request-matrix-container');
    const availContainer = document.getElementById('available-vector-container');
    if (!allocContainer || !reqContainer || !availContainer) return;

    const nodes = nodesDataset.get();
    const edges = edgesDataset.get();

    const processes = nodes.filter(n => n.nodeType === 'process').map(n => n.id).sort();
    const resources = nodes.filter(n => n.nodeType === 'resource').sort((a, b) => a.id.localeCompare(b.id));

    if (processes.length === 0 || resources.length === 0) {
        const emptyMsg = '<div class="text-slate-500 italic py-2">Add processes & resources to populate</div>';
        allocContainer.innerHTML = emptyMsg;
        reqContainer.innerHTML = emptyMsg;
        availContainer.innerHTML = emptyMsg;
        return;
    }

    // Initialize matrices
    const alloc = {};
    const req = {};
    const assignedTotal = {};

    processes.forEach(p => {
        alloc[p] = {};
        req[p] = {};
        resources.forEach(r => {
            alloc[p][r.id] = 0;
            req[p][r.id] = 0;
        });
    });

    resources.forEach(r => {
        assignedTotal[r.id] = 0;
    });

    // Populate from edges
    edges.forEach(e => {
        const u = e.from;
        const v = e.to;
        const etype = e.edgeType;

        if (etype === 'request' || (processes.includes(u) && resources.some(r => r.id === v))) {
            if (req[u] && req[u][v] !== undefined) req[u][v]++;
        } else if (etype === 'assignment' || (resources.some(r => r.id === u) && processes.includes(v))) {
            if (alloc[v] && alloc[v][u] !== undefined) {
                alloc[v][u]++;
                assignedTotal[u]++;
            }
        }
    });

    // Helper: generate HTML table for [P x R] matrices
    function render2DTable(matrix, accentClass) {
        let html = '<table class="w-full text-center border-collapse"><thead><tr class="border-b border-slate-800 text-slate-400">';
        html += '<th class="py-1 px-1.5 text-left font-mono">P\\R</th>';
        resources.forEach(r => {
            html += `<th class="py-1 px-1.5 font-mono text-slate-300">${r.id}</th>`;
        });
        html += '</tr></thead><tbody>';

        processes.forEach(p => {
            html += `<tr class="border-b border-slate-800/50 hover:bg-slate-900/50">`;
            html += `<td class="py-1 px-1.5 text-left font-semibold text-slate-300">${p}</td>`;
            resources.forEach(r => {
                const val = matrix[p][r.id];
                const cellClass = val > 0 ? `${accentClass} font-bold` : 'text-slate-600';
                html += `<td class="py-1 px-1.5 font-mono ${cellClass}">${val}</td>`;
            });
            html += '</tr>';
        });

        html += '</tbody></table>';
        return html;
    }

    // Render Allocation (A) and Request (Q)
    allocContainer.innerHTML = render2DTable(alloc, 'text-amber-400');
    reqContainer.innerHTML = render2DTable(req, 'text-sky-400');

    // Render Available Vector (V) & Declared Capacities
    let availHtml = '<table class="w-full text-center border-collapse"><thead><tr class="border-b border-slate-800 text-slate-400">';
    availHtml += '<th class="py-1 px-1 text-left font-mono">Metric</th>';
    resources.forEach(r => {
        availHtml += `<th class="py-1 px-1 font-mono text-slate-300">${r.id}</th>`;
    });
    availHtml += '</tr></thead><tbody>';

    // Row 1: Declared Capacity
    availHtml += '<tr class="border-b border-slate-800/40"><td class="py-1 px-1 text-left text-slate-400">Total Cap</td>';
    resources.forEach(r => {
        availHtml += `<td class="py-1 px-1 font-mono text-slate-200">${r.instances || 1}</td>`;
    });
    availHtml += '</tr>';

    // Row 2: Currently Assigned
    availHtml += '<tr class="border-b border-slate-800/40"><td class="py-1 px-1 text-left text-amber-400">Allocated</td>';
    resources.forEach(r => {
        const assigned = assignedTotal[r.id] || 0;
        availHtml += `<td class="py-1 px-1 font-mono text-amber-300 font-semibold">${assigned}</td>`;
    });
    availHtml += '</tr>';

    // Row 3: Available Free Work
    availHtml += '<tr><td class="py-1 px-1 text-left text-emerald-400 font-semibold">Available (V)</td>';
    resources.forEach(r => {
        const total = r.instances || 1;
        const assigned = assignedTotal[r.id] || 0;
        const free = total - assigned;
        const freeClass = free < 0 ? 'text-red-400 font-bold bg-red-950/40 rounded' : 'text-emerald-300 font-bold';
        availHtml += `<td class="py-1 px-1 font-mono ${freeClass}">${free}</td>`;
    });
    availHtml += '</tr></tbody></table>';

    availContainer.innerHTML = availHtml;
}

/**
 * Toggle visibility of bottom System Matrix panel
 */
function toggleMatrixPanel() {
    const panel = document.getElementById('matrix-panel');
    const toggleIcon = document.getElementById('matrix-toggle-icon');
    if (!panel) return;

    if (panel.classList.contains('max-h-10')) {
        panel.classList.remove('max-h-10');
        panel.classList.add('max-h-72');
        if (toggleIcon) toggleIcon.innerText = '▼ Collapse';
    } else {
        panel.classList.remove('max-h-72');
        panel.classList.add('max-h-10');
        if (toggleIcon) toggleIcon.innerText = '▲ Expand';
    }
}

/**
 * Execute Deadlock Detection API call
 */
async function detectDeadlock() {
    const rawNodes = nodesDataset.get();
    const rawEdges = edgesDataset.get();

    if (rawNodes.length === 0) {
        alert('Canvas is empty! Add nodes or load a preset scenario first.');
        return;
    }

    const payload = {
        nodes: rawNodes.map(n => ({
            id: n.id,
            type: n.nodeType,
            instances: n.instances || 1
        })),
        edges: rawEdges.map(e => ({
            id: e.id,
            from: e.from,
            to: e.to,
            type: e.edgeType
        }))
    };

    clearLogs();
    logStep('[INIT] Initiating Deadlock Detection Analysis...');

    try {
        const response = await fetch('/api/detect-deadlock', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        // Render step-by-step trace logs
        if (data.trace_log && Array.isArray(data.trace_log)) {
            data.trace_log.forEach(logStep);
        }

        // Handle HTTP 400 Validation Error (e.g., Over-allocation)
        if (!response.ok || data.error) {
            highlightOverAllocated(data.deadlocked_resources || []);
            setVerdict('INVALID GRAPH STATE', 'text-red-400 font-bold', data.error || 'Assigned instances exceed resource capacity!');
            return;
        }

        // Apply iterative node highlighting
        highlightResults(data.deadlocked_processes || [], data.deadlocked_resources || [], data.satisfied_processes || [], data.cycle_path || []);

        // Update Verdict Status Banner
        if (data.is_deadlocked) {
            const dlList = (data.deadlocked_processes || []).join(', ') || 'Processes stalled';
            setVerdict('DEADLOCK DETECTED', 'text-red-400 font-bold', `Deadlocked: [${dlList}]`);
        } else {
            setVerdict('SAFE STATE (NO DEADLOCK)', 'text-emerald-400 font-bold', 'All processes reducible / Graph is acyclic');
        }

    } catch (err) {
        console.error('API Detection Request Failed:', err);
        logStep(`[ERROR] Request failed: ${err.message}`);
        setVerdict('CLIENT ERROR', 'text-red-500 font-bold', err.message);
    }
}

/**
 * Highlight deadlocked nodes (Red) and satisfied nodes (Green)
 * CRITICAL: Strictly iterative array update over nodesDataset (NO recursion to prevent stack overflow).
 */
function highlightResults(deadProcIds = [], deadResIds = [], satProcIds = [], cyclePath = []) {
    if (isUpdatingColors) return;
    isUpdatingColors = true;

    try {
        const nodes = nodesDataset.get();
        const deadProcSet = new Set(deadProcIds);
        const deadResSet = new Set(deadResIds);
        const satProcSet = new Set(satProcIds);

        const nodeUpdates = [];
        for (let i = 0; i < nodes.length; i++) {
            const node = nodes[i];
            const isProc = node.nodeType === 'process';

            if (deadProcSet.has(node.id) || deadResSet.has(node.id)) {
                nodeUpdates.push({
                    id: node.id,
                    color: {
                        background: COLORS.deadlocked.background,
                        border: COLORS.deadlocked.border,
                        highlight: COLORS.deadlocked.highlight
                    }
                });
            } else if (satProcSet.has(node.id)) {
                nodeUpdates.push({
                    id: node.id,
                    color: {
                        background: COLORS.satisfied.background,
                        border: COLORS.satisfied.border,
                        highlight: COLORS.satisfied.highlight
                    }
                });
            } else {
                nodeUpdates.push({
                    id: node.id,
                    color: {
                        background: isProc ? COLORS.process.background : COLORS.resource.background,
                        border: isProc ? COLORS.process.border : COLORS.resource.border,
                        highlight: isProc ? COLORS.process.highlight : COLORS.resource.highlight
                    }
                });
            }
        }

        if (nodeUpdates.length > 0) {
            nodesDataset.update(nodeUpdates);
        }

        // Highlight cycle edges if cycle path was identified
        if (cyclePath && cyclePath.length > 1) {
            const cyclePairs = new Set();
            for (let i = 0; i < cyclePath.length - 1; i++) {
                cyclePairs.add(`${cyclePath[i]}->${cyclePath[i + 1]}`);
            }

            const edges = edgesDataset.get();
            const edgeUpdates = [];
            for (let i = 0; i < edges.length; i++) {
                const edge = edges[i];
                if (cyclePairs.has(`${edge.from}->${edge.to}`)) {
                    edgeUpdates.push({
                        id: edge.id,
                        color: { color: COLORS.edgeDeadlock },
                        width: 3.5
                    });
                }
            }
            if (edgeUpdates.length > 0) {
                edgesDataset.update(edgeUpdates);
            }
        }
    } finally {
        isUpdatingColors = false;
    }
}

/**
 * Highlight over-allocated resources in crimson red
 */
function highlightOverAllocated(overResIds = []) {
    if (isUpdatingColors) return;
    isUpdatingColors = true;

    try {
        const nodeUpdates = [];
        for (let i = 0; i < overResIds.length; i++) {
            nodeUpdates.push({
                id: overResIds[i],
                color: {
                    background: COLORS.deadlocked.background,
                    border: COLORS.deadlocked.border
                }
            });
        }
        if (nodeUpdates.length > 0) {
            nodesDataset.update(nodeUpdates);
        }
    } finally {
        isUpdatingColors = false;
    }
}

/**
 * Format and append a trace step to the execution console
 */
function logStep(text) {
    const panel = document.getElementById('log-panel');
    if (!panel) return;

    const div = document.createElement('div');
    div.className = 'py-1 border-b border-slate-900/60 leading-relaxed break-words text-[11px]';

    if (text.includes('[DEADLOCK]')) {
        div.innerHTML = `<span class="px-1.5 py-0.5 rounded bg-red-950/90 text-red-400 border border-red-800 font-bold font-mono">[DEADLOCK]</span> ${escapeHtml(text.replace('[DEADLOCK]', ''))}`;
    } else if (text.includes('[CYCLE]')) {
        div.innerHTML = `<span class="px-1.5 py-0.5 rounded bg-amber-950/90 text-amber-300 border border-amber-800 font-bold font-mono">[CYCLE]</span> ${escapeHtml(text.replace('[CYCLE]', ''))}`;
    } else if (text.includes('[REDUCE]')) {
        div.innerHTML = `<span class="px-1.5 py-0.5 rounded bg-emerald-950/90 text-emerald-300 border border-emerald-800 font-semibold font-mono">[REDUCE]</span> ${escapeHtml(text.replace('[REDUCE]', ''))}`;
    } else if (text.includes('[SAFE]')) {
        div.innerHTML = `<span class="px-1.5 py-0.5 rounded bg-emerald-950/90 text-emerald-400 border border-emerald-800 font-bold font-mono">[SAFE]</span> ${escapeHtml(text.replace('[SAFE]', ''))}`;
    } else if (text.includes('[WORK]')) {
        div.innerHTML = `<span class="px-1.5 py-0.5 rounded bg-indigo-950/90 text-indigo-300 border border-indigo-800 font-semibold font-mono">[WORK]</span> ${escapeHtml(text.replace('[WORK]', ''))}`;
    } else if (text.includes('[ERROR]')) {
        div.innerHTML = `<span class="px-1.5 py-0.5 rounded bg-rose-950/90 text-rose-400 border border-rose-800 font-bold font-mono">[ERROR]</span> ${escapeHtml(text.replace('[ERROR]', ''))}`;
    } else if (text.includes('[ALGORITHM]')) {
        div.innerHTML = `<span class="px-1.5 py-0.5 rounded bg-sky-950/90 text-sky-400 border border-sky-800 font-semibold font-mono">[ALG]</span> ${escapeHtml(text.replace('[ALGORITHM]', ''))}`;
    } else if (text.includes('[INIT]')) {
        div.innerHTML = `<span class="px-1.5 py-0.5 rounded bg-slate-800 text-sky-300 border border-slate-700 font-semibold font-mono">[INIT]</span> ${escapeHtml(text.replace('[INIT]', ''))}`;
    } else {
        div.textContent = text;
    }

    panel.appendChild(div);
    panel.scrollTop = panel.scrollHeight;
}

/**
 * Clear trace console
 */
function clearLogs() {
    const panel = document.getElementById('log-panel');
    if (panel) panel.innerHTML = '';
}

/**
 * Update verdict state banner at bottom of console
 */
function setVerdict(stateText, colorClass, detailText = '') {
    const verdictState = document.getElementById('verdict-state');
    const verdictDetail = document.getElementById('verdict-detail');
    const verdictBanner = document.getElementById('verdict-banner');

    if (verdictState) {
        verdictState.innerText = stateText;
        verdictState.className = `${colorClass} text-xs`;
    }

    if (verdictDetail) {
        verdictDetail.innerText = detailText || stateText;
    }

    if (verdictBanner) {
        if (stateText.includes('DEADLOCK')) {
            verdictBanner.className = 'p-4 border-t border-red-500/30 bg-red-950/30 flex flex-col gap-1.5 transition-all';
        } else if (stateText.includes('SAFE')) {
            verdictBanner.className = 'p-4 border-t border-emerald-500/30 bg-emerald-950/30 flex flex-col gap-1.5 transition-all';
        } else if (stateText.includes('INVALID')) {
            verdictBanner.className = 'p-4 border-t border-amber-500/30 bg-amber-950/30 flex flex-col gap-1.5 transition-all';
        } else {
            verdictBanner.className = 'p-4 border-t border-slate-800/80 bg-slate-900 flex flex-col gap-1.5 transition-all';
        }
    }
}

/**
 * HTML sanitization helper
 */
function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
