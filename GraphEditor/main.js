/* --- GraphEditor main.js (Integrated Version) --- */
(function () {
    'use strict';

    var csInterface = new CSInterface();

    // Referencias UI
    const mainLayout = document.getElementById('mainLayout');
    const primaryColumn = document.getElementById('primaryColumn');
    const resizeGutter = document.getElementById('resizeGutter');
    const sliderOut = document.getElementById('sliderOut');
    const sliderIn = document.getElementById('sliderIn');
    const outValDisplay = document.getElementById('outValDisplay');
    const inValDisplay = document.getElementById('inValDisplay');
    const applyBtn = document.getElementById('applyBtn');
    const lockBtn = document.getElementById('lockBtn');
    const tabPresets = document.getElementById('tabPresets');
    const tabFavorites = document.getElementById('tabFavorites');
    const presetsGrid = document.getElementById('presetsGrid');
    const savePresetBtn = document.getElementById('savePresetBtn');
    const btnModeVel = document.getElementById('btnModeVelocity');
    const btnModeVal = document.getElementById('btnModeValue');
    const copyBtn = document.getElementById('copyBtn');
    const clearAllBtn = document.getElementById('clearAllBtn');

    // Referencias SVG
    const baseLineL = document.getElementById('graphBaseLeft');
    const baseLineR = document.getElementById('graphBaseRight');
    const graphContainer = document.getElementById('graphContainer');
    const speedGraphSVG = document.getElementById('speedGraphSVG');
    const graphCurve = document.getElementById('graphCurve');
    const graphFill = document.getElementById('graphFill');
    const hLineL = document.getElementById('handleLineLeft');
    const hLineR = document.getElementById('handleLineRight');
    const pointL = document.getElementById('handlePointLeft');
    const pointR = document.getElementById('handlePointRight');
    const dragAreaL = document.getElementById('dragAreaLeft');
    const dragAreaR = document.getElementById('dragAreaRight');
    const dragGroupLeft = document.getElementById('dragGroupLeft');
    const dragGroupRight = document.getElementById('dragGroupRight');

    // Constantes Visuales
    const SVG_WIDTH = 300;
    const SVG_HEIGHT = 300;
    const HANDLE_PADDING = 20;

    // Estado
    let isLocked = false;
    let isDraggingLeft = false;
    let isDraggingRight = false;
    let handleLeftY = 0;
    let handleRightY = 0;
    let favoritesSet = new Set();
    let customPresets = [];
    let graphMode = 'velocity';
    let currentViewScale = 1;
    let dragStartX = 0;
    let dragStartY = 0;
    let dragStartValX = 0;
    let dragStartValY = 0;

    // Estado Layout
    let isDraggingGutter = false;
    let layoutMode = '';
    const LAYOUT_THRESHOLD = 500;

    // --- 1. LÓGICA DE COPIAR ---
    // --- 1. LÓGICA DE COPIAR ---
    function fetchInfluencesFromAE() {
        const svg = copyBtn.querySelector('svg');
        if (svg) svg.style.display = 'none';
        copyBtn.textContent = '⏳';

        csInterface.evalScript('_GRAPHEDITOR.getSelectedInfluences()', function (result) {
            copyBtn.textContent = '';
            if (svg) {
                copyBtn.appendChild(svg);
                svg.style.display = 'block';
            }
            try {
                var data = JSON.parse(result);
                if (data.found) {
                    var newOut = parseFloat(data.outVal);
                    var newIn = parseFloat(data.inVal);
                    sliderOut.value = newOut;
                    sliderIn.value = newIn;

                    // Si estamos en modo VALUE, intentamos recrear la inclinación vertical
                    if (graphMode === 'value') {
                        // yo = slopeOut * (oInfl / 100)
                        handleLeftY = data.slopeOut * (newOut / 100);
                        // yi = slopeIn * (iInfl / 100) -> handleRightY = yi + 1
                        handleRightY = (data.slopeIn * (newIn / 100)) + 1;
                    } else if (data.speedOut !== 0 || data.speedIn !== 0) {
                        // Si detectamos velocidad pero estamos en modo velocity, 
                        // avisamos visualmente o dejamos que el usuario decida cambiar.
                        // Para esta versión, mantenemos la coherencia del modo actual.
                    }

                    if (Math.abs(newOut - newIn) > 0.5 && isLocked) {
                        isLocked = false; lockBtn.innerText = '🔓';
                    }
                    updateGraphVisuals();
                }
            } catch (e) { console.error(e); }
        });
    }
    copyBtn.addEventListener('click', fetchInfluencesFromAE);

    // --- 2. MATEMÁTICA BÉZIER ---
    function cubicBezier(t, p0, p1, p2, p3) {
        const u = 1 - t; const tt = t * t; const uu = u * u; const uuu = uu * u; const ttt = tt * t;
        return (uuu * p0) + (3 * uu * t * p1) + (3 * u * tt * p2) + (ttt * p3);
    }
    function cubicBezierDerivative(t, p0, p1, p2, p3) {
        const u = 1 - t; return (3 * u * u * (p1 - p0)) + (6 * u * t * (p2 - p1)) + (3 * t * t * (p3 - p2));
    }

    // --- 3. MOTOR GRÁFICO ---
    function updateGraphVisuals() {
        let o = parseFloat(sliderOut.value);
        let i = parseFloat(sliderIn.value);
        outValDisplay.textContent = Math.round(o) + '%';
        inValDisplay.textContent = Math.round(i) + '%';

        let mcp1x = o / 100; let mcp2x = 1 - (i / 100);
        let mcp1y = (graphMode === 'velocity') ? 0 : handleLeftY;
        let mcp2y = (graphMode === 'velocity') ? 0 : handleRightY;

        // Cálculo Puntos
        const steps = 60; let rawPoints = []; let minVal = 0, maxVal = 1;
        if (graphMode === 'value') { minVal = Math.min(0, handleLeftY, handleRightY); maxVal = Math.max(1, handleLeftY, handleRightY); } else { maxVal = 2.0; }

        for (let s = 0; s <= steps; s++) {
            let t = s / steps;
            let bx = cubicBezier(t, 0, mcp1x, mcp2x, 1);
            let by = 0;
            if (graphMode === 'value') { by = cubicBezier(t, 0, mcp1y, mcp2y, 1); }
            else {
                let dx = cubicBezierDerivative(t, 0, mcp1x, mcp2x, 1); let dy = cubicBezierDerivative(t, 0, 0, 1, 1);
                if (dx > 0.0001) by = dy / dx; if (by > 25) by = 25;
            }
            if (by > maxVal) maxVal = by; if (by < minVal) minVal = by;
            rawPoints.push({ x: bx, y: by });
        }

        let rangeY = maxVal - minVal; if (rangeY < 0.001) rangeY = 1;
        const paddingMultiplier = 0.2;
        let visualMinY = minVal - (rangeY * paddingMultiplier);
        let visualMaxY = maxVal + (rangeY * paddingMultiplier);
        let visualRangeY = visualMaxY - visualMinY;

        if (graphMode === 'value') currentViewScale = Math.max(1.0 + (paddingMultiplier * 2), visualRangeY); else currentViewScale = 1.0;

        let centerY = (visualMinY + visualMaxY) / 2;
        let viewMinY = centerY - (currentViewScale / 2); let viewMaxY = centerY + (currentViewScale / 2);
        let centerX = 0.5; let viewMinX = centerX - (currentViewScale / 2); let viewMaxX = centerX + (currentViewScale / 2);
        const usableSize = SVG_WIDTH - (HANDLE_PADDING * 2);

        const mapY = (val) => { let normalized = (graphMode === 'value') ? (val - viewMinY) / currentViewScale : (val - visualMinY) / visualRangeY; return SVG_HEIGHT - HANDLE_PADDING - (normalized * usableSize); };
        const mapX = (val) => { let normalized = (graphMode === 'value') ? (val - viewMinX) / currentViewScale : val; return HANDLE_PADDING + (normalized * usableSize); };

        let dCurve = "", dFill = ""; const floorY = mapY(0);
        for (let i = 0; i < rawPoints.length; i++) {
            let p = rawPoints[i]; let px = mapX(p.x); let py = mapY(p.y);
            let cmd = (i === 0) ? "M" : "L"; dCurve += `${cmd} ${px},${py}`;
            if (i === 0) dFill += `M ${px},${floorY} L ${px},${py}`; else dFill += ` L ${px},${py}`;
        }
        let endX = mapX(1); dFill += ` L ${endX},${floorY} Z`;
        graphCurve.setAttribute('d', dCurve); graphFill.setAttribute('d', dFill);


        // --- DIBUJAR CUADRÍCULA INFINITA ---
        let dGrid = "";
        const FAR_PIXEL = 3000;

        if (graphMode === 'value') {
            const gridStep = 0.25;
            let startX = Math.floor((viewMinX - 2) / gridStep) * gridStep;
            let endX = Math.ceil((viewMaxX + 2) / gridStep) * gridStep;

            for (let gx = startX; gx <= endX; gx += gridStep) {
                let xPos = mapX(gx);
                dGrid += `M ${xPos},${-FAR_PIXEL} L ${xPos},${FAR_PIXEL} `;
            }

            let startY = Math.floor((viewMinY - 2) / gridStep) * gridStep;
            let endY = Math.ceil((viewMaxY + 2) / gridStep) * gridStep;
            for (let gy = startY; gy <= endY; gy += gridStep) {
                let yPos = mapY(gy);
                dGrid += `M ${-FAR_PIXEL},${yPos} L ${FAR_PIXEL},${yPos} `;
            }

        } else {
            // VELOCITY STATIC GRID
            const fractions = [0.25, 0.5, 0.75];
            fractions.forEach(pct => {
                let pos = HANDLE_PADDING + (pct * usableSize);
                dGrid += `M ${pos},${-FAR_PIXEL} L ${pos},${FAR_PIXEL} `;
                let posY = SVG_HEIGHT - HANDLE_PADDING - (pct * usableSize);
                dGrid += `M ${-FAR_PIXEL},${posY} L ${FAR_PIXEL},${posY} `;
            });
        }
        const gridPath = document.getElementById('gridPath');
        if (gridPath) gridPath.setAttribute('d', dGrid);

        // --- POSICIONAR ELEMENTOS Y EJES ---
        let h1x, h2x, h1y, h2y;
        if (graphMode === 'velocity') { h1x = HANDLE_PADDING + ((o / 100) * 0.5 * usableSize); h1y = mapY(0); h2x = (HANDLE_PADDING + usableSize) - ((i / 100) * 0.5 * usableSize); h2y = mapY(0); }
        else { h1x = mapX(mcp1x); h1y = mapY(mcp1y); h2x = mapX(mcp2x); h2y = mapY(mcp2y); }

        if (graphMode === 'velocity') {
            let centerX = SVG_WIDTH / 2;
            baseLineL.setAttribute('x1', -FAR_PIXEL); baseLineL.setAttribute('x2', centerX); baseLineL.setAttribute('y1', floorY); baseLineL.setAttribute('y2', floorY);
            baseLineR.setAttribute('x1', centerX); baseLineR.setAttribute('x2', FAR_PIXEL); baseLineR.setAttribute('y1', floorY); baseLineR.setAttribute('y2', floorY);
            baseLineR.style.display = 'block';
        } else {
            let axisX = mapX(0);
            baseLineL.setAttribute('x1', axisX); baseLineL.setAttribute('x2', axisX); baseLineL.setAttribute('y1', FAR_PIXEL); baseLineL.setAttribute('y2', -FAR_PIXEL);
            baseLineR.setAttribute('x1', -FAR_PIXEL); baseLineR.setAttribute('x2', FAR_PIXEL); baseLineR.setAttribute('y1', floorY); baseLineR.setAttribute('y2', floorY);
        }

        hLineL.setAttribute('x1', mapX(0)); hLineL.setAttribute('y1', mapY(0)); hLineL.setAttribute('x2', h1x); hLineL.setAttribute('y2', h1y);
        let anchorRightY = (graphMode === 'velocity') ? 0 : 1; hLineR.setAttribute('x1', mapX(1)); hLineR.setAttribute('y1', mapY(anchorRightY)); hLineR.setAttribute('x2', h2x); hLineR.setAttribute('y2', h2y);
        pointL.setAttribute('cx', h1x); pointL.setAttribute('cy', h1y); pointR.setAttribute('cx', h2x); pointR.setAttribute('cy', h2y);
        dragAreaL.setAttribute('x', h1x - 20); dragAreaL.setAttribute('y', h1y - 20); dragAreaR.setAttribute('x', h2x - 20); dragAreaR.setAttribute('y', h2y - 20);
    }

    // --- 4. INTERACCIÓN HANDLES ---
    function startDragLeft(e) { isDraggingLeft = true; isDraggingRight = false; document.body.style.cursor = 'none'; dragStartX = e.clientX; dragStartY = e.clientY; dragStartValX = parseFloat(sliderOut.value); dragStartValY = handleLeftY; }
    function startDragRight(e) { isDraggingRight = true; isDraggingLeft = false; document.body.style.cursor = 'none'; dragStartX = e.clientX; dragStartY = e.clientY; dragStartValX = parseFloat(sliderIn.value); dragStartValY = handleRightY; }
    function handleDrag(e) {
        if (!isDraggingLeft && !isDraggingRight) return;

        const svgRect = speedGraphSVG.getBoundingClientRect();
        let visualSize = svgRect.width;

        let pixelsFor100Percent;
        if (graphMode === 'velocity') pixelsFor100Percent = visualSize * 0.5;
        else pixelsFor100Percent = visualSize / currentViewScale;

        const deltaPixelsX = e.clientX - dragStartX;
        const deltaPercent = (deltaPixelsX / pixelsFor100Percent) * 100;

        let changeX = deltaPercent; if (isDraggingRight) changeX *= -1;
        let newValX = dragStartValX + changeX; newValX = Math.max(0.1, Math.min(100, newValX));

        if (graphMode === 'value') {
            const deltaPixelsY = e.clientY - dragStartY;
            const changeY = -(deltaPixelsY / visualSize) * currentViewScale;
            let newValY = dragStartValY + changeY;
            if (isDraggingLeft) handleLeftY = newValY; else handleRightY = newValY;
        }

        if (isDraggingLeft) { sliderOut.value = newValX; if (isLocked) sliderIn.value = newValX; }
        else { sliderIn.value = newValX; if (isLocked) sliderOut.value = newValX; }
        updateGraphVisuals();
    }
    function stopDrag() { isDraggingLeft = false; isDraggingRight = false; document.body.style.cursor = 'default'; }
    dragGroupLeft.addEventListener('mousedown', startDragLeft); dragGroupRight.addEventListener('mousedown', startDragRight);

    // --- 5. LÓGICA DE LAYOUT Y RESIZE ---
    function updateLayoutMode() {
        if (isDraggingGutter) return;

        const width = window.innerWidth;
        const newMode = (width >= LAYOUT_THRESHOLD) ? 'horizontal' : 'vertical';

        if (newMode !== layoutMode) {
            layoutMode = newMode;
            primaryColumn.style.width = ''; primaryColumn.style.height = ''; primaryColumn.style.flexBasis = '';

            if (layoutMode === 'horizontal') {
                mainLayout.classList.add('layout-horizontal'); mainLayout.classList.remove('layout-vertical');
                primaryColumn.style.width = '60%';
            } else {
                mainLayout.classList.add('layout-vertical'); mainLayout.classList.remove('layout-horizontal');
                primaryColumn.style.height = '60%';
            }
            setTimeout(updateGraphVisuals, 50);
        }
    }
    resizeGutter.addEventListener('mousedown', function (e) {
        isDraggingGutter = true; resizeGutter.classList.add('is-dragging');
        document.body.style.cursor = (layoutMode === 'horizontal') ? 'col-resize' : 'row-resize';
        e.preventDefault();
    });
    window.addEventListener('mousemove', function (e) {
        handleDrag(e);
        if (isDraggingGutter) {
            if (layoutMode === 'horizontal') {
                let newWidth = e.clientX;
                if (newWidth < 180) newWidth = 180;
                if (newWidth > window.innerWidth - 80) newWidth = window.innerWidth - 80;
                primaryColumn.style.width = newWidth + 'px'; primaryColumn.style.flexBasis = newWidth + 'px';
            } else {
                let newHeight = e.clientY;
                if (newHeight < 200) newHeight = 200;
                if (newHeight > window.innerHeight - 80) newHeight = window.innerHeight - 80;
                primaryColumn.style.height = newHeight + 'px'; primaryColumn.style.flexBasis = newHeight + 'px';
            }
            requestAnimationFrame(updateGraphVisuals);
        }
    });
    window.addEventListener('mouseup', function () {
        stopDrag();
        if (isDraggingGutter) {
            isDraggingGutter = false; resizeGutter.classList.remove('is-dragging');
            document.body.style.cursor = 'default'; updateGraphVisuals();
        }
    });
    window.addEventListener('resize', updateLayoutMode);

    // --- 6. FUNCIONALIDAD UI RESTANTE ---
    btnModeVel.addEventListener('click', () => { graphMode = 'velocity'; btnModeVel.classList.add('active'); btnModeVal.classList.remove('active'); updateGraphVisuals(); });
    btnModeVal.addEventListener('click', () => { graphMode = 'value'; btnModeVal.classList.add('active'); btnModeVel.classList.remove('active'); if (handleLeftY === 0 && handleRightY === 0) { handleLeftY = 0; handleRightY = 1; } updateGraphVisuals(); });

    function applyToAE() {
        applyBtn.innerText = "APLICANDO...";
        const outInfl = parseFloat(sliderOut.value);
        const inInfl = parseFloat(sliderIn.value);

        // Enviamos también los desplazamientos verticales para "Value Curves" reales
        const vOut = (graphMode === 'value') ? handleLeftY : 0;
        const vIn = (graphMode === 'value') ? (handleRightY - 1) : 0;

        csInterface.evalScript(`_GRAPHEDITOR.applyInfluence(${outInfl}, ${inInfl}, ${vOut}, ${vIn}, '${graphMode}')`, function () {
            setTimeout(() => applyBtn.innerText = "APLICAR", 200);
        });
    }

    function setType(type) { csInterface.evalScript(`_GRAPHEDITOR.setKeyframeType('${type}')`); }

    sliderOut.addEventListener('input', () => { if (isLocked) sliderIn.value = sliderOut.value; updateGraphVisuals(); });
    sliderIn.addEventListener('input', () => { if (isLocked) sliderOut.value = sliderIn.value; updateGraphVisuals(); });
    lockBtn.addEventListener('click', function () { isLocked = !isLocked; this.textContent = isLocked ? '🔒' : '🔓'; if (isLocked) { sliderIn.value = sliderOut.value; updateGraphVisuals(); } });
    applyBtn.addEventListener('click', applyToAE);

    // Botones de Keyframe y Presets Rápidos
    document.querySelectorAll('.kf-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            // Ignorar el savePresetBtn que tiene su propio listener
            if (this.id === 'savePresetBtn') return;

            if (this.dataset.type) {
                setType(this.dataset.type);
            } else if (this.classList.contains('preset-trigger')) {
                sliderOut.value = this.dataset.out;
                sliderIn.value = this.dataset.in;
                updateGraphVisuals();
                applyToAE();
            }
        });
    });

    // --- 7. GESTIÓN DE PRESETS ---
    function loadData() {
        try {
            const sFav = localStorage.getItem('grapheditorFavs');
            if (sFav) favoritesSet = new Set(JSON.parse(sFav));
            const sCust = localStorage.getItem('grapheditorCustomPresets');
            if (sCust) { customPresets = JSON.parse(sCust); renderCustomPresets(); }
            updateFavoriteIcons();
        } catch (e) { }
    }

    function saveFavs() { localStorage.setItem('grapheditorFavs', JSON.stringify([...favoritesSet])); updateFavoriteIcons(); }

    function updateFavoriteIcons() {
        document.querySelectorAll('.preset-card').forEach(c => {
            if (favoritesSet.has(c.id)) c.classList.add('is-favorite');
            else c.classList.remove('is-favorite');
        });
    }

    savePresetBtn.addEventListener('click', function () {
        const name = prompt("Nombre del preset:", "Mi Curva");
        if (name) {
            // Capturamos el dibujo actual de la curva
            const currentPath = graphCurve.getAttribute('d');
            customPresets.push({
                id: 'cust_' + Date.now(),
                name: name,
                o: sliderOut.value,
                i: sliderIn.value,
                path: currentPath,
                mode: graphMode
            });
            localStorage.setItem('grapheditorCustomPresets', JSON.stringify(customPresets));
            renderCustomPresets();
        }
    });

    function renderCustomPresets() {
        document.querySelectorAll('.custom-preset').forEach(el => el.remove());
        customPresets.forEach(p => {
            const div = document.createElement('div');
            div.className = 'preset-card custom-preset';
            div.id = p.id;
            div.dataset.out = p.o;
            div.dataset.in = p.i;

            // Si el preset tiene un path guardado, lo usamos, si no uno genérico
            const pathData = p.path || "M40,240 C100,240 200,60 260,60";

            div.innerHTML = `
                <svg class="preset-icon" viewBox="0 0 300 300" preserveAspectRatio="xMidYMid meet">
                    <path d="${pathData}" stroke="white" fill="none" stroke-width="12" stroke-linecap="round"/>
                </svg>
                <div class="preset-name">${p.name}</div>
                <span class="fav-icon">★</span>
                <button class="delete-preset-btn" title="Borrar preset">✕</button>
            `;
            presetsGrid.appendChild(div);
        });
        updateFavoriteIcons();
    }

    presetsGrid.addEventListener('click', function (e) {
        const card = e.target.closest('.preset-card');
        if (!card) return;

        // Clic en botón borrar
        if (e.target.classList.contains('delete-preset-btn')) {
            const presetId = card.id;
            customPresets = customPresets.filter(p => p.id !== presetId);
            localStorage.setItem('grapheditorCustomPresets', JSON.stringify(customPresets));
            card.remove();
            return;
        }

        // Clic en estrella (Favorito)
        if (e.target.classList.contains('fav-icon')) {
            if (favoritesSet.has(card.id)) favoritesSet.delete(card.id);
            else favoritesSet.add(card.id);
            saveFavs();
            return;
        }

        // Clic en preset (Cargar Valores)
        sliderOut.value = card.dataset.out;
        sliderIn.value = card.dataset.in;
        if (isLocked && card.dataset.out !== card.dataset.in) {
            isLocked = false;
            lockBtn.textContent = '🔓';
        }
        updateGraphVisuals();
    });

    // Clear All Button
    clearAllBtn.addEventListener('click', function () {
        if (confirm('¿Borrar todos los presets personalizados?')) {
            customPresets = [];
            localStorage.setItem('grapheditorCustomPresets', JSON.stringify(customPresets));
            document.querySelectorAll('.custom-preset').forEach(el => el.remove());
        }
    });

    tabPresets.addEventListener('click', function () { this.classList.add('active'); tabFavorites.classList.remove('active'); presetsGrid.classList.remove('showing-favorites-only'); });
    tabFavorites.addEventListener('click', function () { this.classList.add('active'); tabPresets.classList.remove('active'); presetsGrid.classList.add('showing-favorites-only'); });

    // --- INICIALIZACIÓN ---
    loadData();
    updateLayoutMode();
    setTimeout(function () {
        updateLayoutMode();
        updateGraphVisuals();
    }, 100);

})();