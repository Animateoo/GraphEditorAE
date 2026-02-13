/*
    GraphEditor Host Script - V10 (Motor de Física Real)
    Soporta: Velocidad, Valor, Rebotes y Curvas Espaciales
*/

var _GRAPHEDITOR = {};

(function () {
    'use strict';

    // 1. APLICAR INFLUENCIA (Fidelidad Velocity + Segment Detection)
    _GRAPHEDITOR.applyInfluence = function (outVal, inVal, vOut, vIn, mode) {
        app.beginUndoGroup("GraphEditor Apply");

        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) { app.endUndoGroup(); return; }

        var props = comp.selectedProperties;
        var oInfl = parseFloat(outVal);
        var iInfl = parseFloat(inVal);
        var yo = parseFloat(vOut || 0);
        var yi = parseFloat(vIn || 0);

        if (isNaN(oInfl) || oInfl <= 0) oInfl = 0.1; if (oInfl > 100) oInfl = 100;
        if (isNaN(iInfl) || iInfl <= 0) iInfl = 0.1; if (iInfl > 100) iInfl = 100;

        for (var n = 0; n < props.length; n++) {
            var prop = props[n];
            if (prop.propertyType !== PropertyType.PROPERTY || prop.numKeys === 0) continue;

            var keyIndices = prop.selectedKeys;
            if (!keyIndices || keyIndices.length === 0) continue;

            for (var k = 0; k < keyIndices.length; k++) {
                var idx = keyIndices[k];

                var speedOut = 0;
                var speedIn = 0;

                // SOLO calculamos velocidad si estamos en modo VALUE y hay tiradores verticales
                if (mode === 'value') {
                    if (idx < prop.numKeys) {
                        var dt = prop.keyTime(idx + 1) - prop.keyTime(idx);
                        var v1 = prop.keyValue(idx);
                        var v2 = prop.keyValue(idx + 1);
                        var dv = 0;
                        if (v1 instanceof Array) {
                            var s = 0; for (var d = 0; d < v1.length; d++) s += Math.pow(v2[d] - v1[d], 2);
                            dv = Math.sqrt(s);
                        } else {
                            dv = v2 - v1;
                        }
                        if (dt > 0) speedOut = (yo / (oInfl / 100)) * (dv / dt);
                    }
                    if (idx > 1) {
                        var dtPrev = prop.keyTime(idx) - prop.keyTime(idx - 1);
                        var vPrev = prop.keyValue(idx - 1);
                        var vCurr = prop.keyValue(idx);
                        var dvPrev = 0;
                        if (vPrev instanceof Array) {
                            var s2 = 0; for (var d2 = 0; d2 < vPrev.length; d2++) s2 += Math.pow(vCurr[d2] - vPrev[d2], 2);
                            dvPrev = Math.sqrt(s2);
                        } else {
                            dvPrev = vCurr - vPrev;
                        }
                        if (dtPrev > 0) speedIn = (yi / (iInfl / 100)) * (dvPrev / dtPrev);
                    }
                }

                // Crear objetos de ease con las velocidades calculadas
                var easeOutObj = new KeyframeEase(speedOut, oInfl);
                var easeInObj = new KeyframeEase(speedIn, iInfl);

                var dims = 1;
                if (!(prop.isSpatial && !prop.dimensionsSeparated)) {
                    switch (prop.propertyValueType) {
                        case PropertyValueType.TwoD: dims = 2; break;
                        case PropertyValueType.ThreeD: dims = 3; break;
                        case PropertyValueType.COLOR: dims = 4; break;
                        default: dims = 1; break;
                    }
                }

                var easeInArr = [], easeOutArr = [];
                for (var d = 0; d < dims; d++) {
                    easeInArr.push(easeInObj);
                    easeOutArr.push(easeOutObj);
                }

                try {
                    prop.setInterpolationTypeAtKey(idx, KeyframeInterpolationType.BEZIER, KeyframeInterpolationType.BEZIER);
                    if (prop.setTemporalAutoBezierAtKey) prop.setTemporalAutoBezierAtKey(idx, false);
                    if (prop.isSpatial && prop.isTimeVarying) {
                        try { prop.setSpatialContinuousAtKey(idx, true); } catch (e) { }
                    }
                    prop.setTemporalEaseAtKey(idx, easeInArr, easeOutArr);
                } catch (err) { }
            }
        }
        app.endUndoGroup();
    };

    // 2. LEER INFLUENCIA (Smart Segment Detection)
    _GRAPHEDITOR.getSelectedInfluences = function () {
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) return JSON.stringify({ found: false });
        var props = comp.selectedProperties;
        if (!props || props.length === 0) return JSON.stringify({ found: false });

        for (var i = 0; i < props.length; i++) {
            var prop = props[i];
            if (prop.propertyType !== PropertyType.PROPERTY || prop.numKeys < 2) continue;
            var keyIndices = prop.selectedKeys;
            if (!keyIndices || keyIndices.length === 0) continue;

            // Lógica de Segmento Inteligente:
            // Si hay 1 seleccionado: intentamos ver el segmento que ENTRA a él (K-1 -> K)
            // Si hay 2+ seleccionados: vemos el segmento entre los dos primeros (K1 -> K2)
            var kStart, kEnd;
            if (keyIndices.length === 1) {
                kEnd = keyIndices[0];
                kStart = (kEnd > 1) ? kEnd - 1 : 1;
                if (kStart === kEnd) {
                    if (kEnd < prop.numKeys) kEnd = kStart + 1;
                    else return JSON.stringify({ found: false });
                }
            } else {
                kStart = keyIndices[0];
                kEnd = keyIndices[1];
            }

            try {
                var easeOut = prop.keyOutTemporalEase(kStart)[0];
                var easeIn = prop.keyInTemporalEase(kEnd)[0];

                var res = {
                    found: true,
                    outVal: easeOut.influence,
                    inVal: easeIn.influence,
                    speedOut: easeOut.speed,
                    speedIn: easeIn.speed,
                    slopeOut: 0,
                    slopeIn: 0,
                    kStart: kStart,
                    kEnd: kEnd
                };

                // Cálculo de pendiente para el segmento kStart -> kEnd
                var dt = prop.keyTime(kEnd) - prop.keyTime(kStart);
                var v1 = prop.keyValue(kStart);
                var v2 = prop.keyValue(kEnd);
                var dv = (v1 instanceof Array) ? 0 : (v2 - v1);

                if (v1 instanceof Array) {
                    var s = 0; for (var d = 0; d < v1.length; d++) s += Math.pow(v2[d] - v1[d], 2);
                    dv = Math.sqrt(s);
                }

                if (dt > 0 && dv !== 0) {
                    res.slopeOut = easeOut.speed / (dv / dt);
                    res.slopeIn = easeIn.speed / (dv / dt);
                }

                return JSON.stringify(res);
            } catch (e) { }
        }
        return JSON.stringify({ found: false });
    };

    // 3. CAMBIAR TIPO (Linear, Bezier, Hold - Restaurado)
    _GRAPHEDITOR.setKeyframeType = function (type) {
        app.beginUndoGroup("GraphEditor Type");
        var comp = app.project.activeItem;
        if (!comp) { app.endUndoGroup(); return; }

        var props = comp.selectedProperties;
        for (var i = 0; i < props.length; i++) {
            var p = props[i];
            if (p.propertyType !== PropertyType.PROPERTY || p.numKeys === 0) continue;

            var keyIndices = p.selectedKeys;
            // Si no hay keys seleccionados, aplicamos a todos
            if (keyIndices.length === 0) {
                for (var j = 1; j <= p.numKeys; j++) keyIndices.push(j);
            }

            for (var k = 0; k < keyIndices.length; k++) {
                var idx = keyIndices[k];
                try {
                    if (type === 'linear') {
                        p.setInterpolationTypeAtKey(idx, KeyframeInterpolationType.LINEAR, KeyframeInterpolationType.LINEAR);
                    } else if (type === 'hold') {
                        p.setInterpolationTypeAtKey(idx, KeyframeInterpolationType.HOLD, KeyframeInterpolationType.HOLD);
                    } else if (type === 'bezier') {
                        p.setInterpolationTypeAtKey(idx, KeyframeInterpolationType.BEZIER, KeyframeInterpolationType.BEZIER);
                        if (p.setTemporalAutoBezierAtKey) p.setTemporalAutoBezierAtKey(idx, true);
                        if (p.isSpatial && p.isTimeVarying) p.setSpatialAutoBezierAtKey(idx, true);
                    }
                } catch (e) { }
            }
        }
        app.endUndoGroup();
    };
})();