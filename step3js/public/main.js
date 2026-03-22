import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { ADDITION, SUBTRACTION, INTERSECTION, DIFFERENCE, Brush, Evaluator } from 'three-bvh-csg';

/**
 * Workspace class to manage a single 3D scene / tab
 */
class Workspace {
    constructor(id, name) {
        this.id = id;
        this.name = name;
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xf0f2f5);
        
        this.modelGroup = new THREE.Group();
        this.modelGroup.name = "Models";
        this.scene.add(this.modelGroup);

        this.helpersGroup = new THREE.Group();
        this.helpersGroup.name = "Helpers";
        this.scene.add(this.helpersGroup);

        this.axesHelper = new THREE.AxesHelper(100);
        this.axesHelper.visible = false;
        this.scene.add(this.axesHelper);

        this.clippingPlanes = [
            new THREE.Plane(new THREE.Vector3(-1, 0, 0), 1000),
            new THREE.Plane(new THREE.Vector3(0, -1, 0), 1000),
            new THREE.Plane(new THREE.Vector3(0, 0, -1), 1000)
        ];

        this.setupLights();
        
        this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 20000);
        this.camera.position.set(500, 500, 500);
        
        this.loadedFiles = [];
        this.selectedObjects = []; // Changed to array for multiple selection
    }

    setupLights() {
        const ambientLight = new THREE.AmbientLight(0x404040, 2);
        this.scene.add(ambientLight);

        const dirLight1 = new THREE.DirectionalLight(0xffffff, 2);
        dirLight1.position.set(200, 200, 200);
        this.scene.add(dirLight1);

        const dirLight2 = new THREE.DirectionalLight(0xffffff, 1);
        dirLight2.position.set(-200, -200, -200);
        this.scene.add(dirLight2);
    }
}

/**
 * Global App Controller
 */
const App = {
    workspaces: [],
    activeWorkspace: null,
    renderer: null,
    controls: null,
    transformControls: null,
    raycaster: new THREE.Raycaster(),
    mouse: new THREE.Vector2(),
    
    activeTool: 'select', 
    transformMode: 'translate',
    measurePoints: [],
    measureLine: null,

    // Sketching State
    isSketching: false,
    sketchMode: 'line', // 'line', 'rect', 'circle'
    sketchPoints: [],
    currentSketchLine: null,
    workPlane: null,

    init() {
        console.log("App init starting...");
        try {
            this.setupRenderer();
            this.setupEventListeners();
            this.setupDraggableUI();
            this.addWorkspace("기본 프로젝트");
            
            window.addEventListener('resize', () => this.onWindowResize());
            this.animate();
            console.log("App init complete.");
        } catch (err) {
            console.error("App init error:", err);
            alert("App 초기화 중 오류가 발생했습니다: " + err.message);
        }
    },

    setupRenderer() {
        this.renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true });
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.localClippingEnabled = true;
        document.getElementById('canvas-container').appendChild(this.renderer.domElement);
    },

    setupDraggableUI() {
        const ui = document.getElementById('ui-container');
        const header = document.getElementById('ui-header');
        if (!ui || !header) {
            console.warn("UI container or header not found for dragging.");
            return;
        }
        
        let isDragging = false;
        let offset = { x: 0, y: 0 };

        header.addEventListener('mousedown', (e) => {
            isDragging = true;
            offset.x = e.clientX - ui.offsetLeft;
            offset.y = e.clientY - ui.offsetTop;
            ui.style.transition = 'none';
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            
            let x = e.clientX - offset.x;
            let y = e.clientY - offset.y;

            const margin = 10;
            x = Math.max(margin, Math.min(x, window.innerWidth - ui.offsetWidth - margin));
            y = Math.max(margin, Math.min(y, window.innerHeight - ui.offsetHeight - margin));

            ui.style.left = x + 'px';
            ui.style.top = y + 'px';
            ui.style.right = 'auto';
        });

        document.addEventListener('mouseup', () => {
            isDragging = false;
        });
    },

    addWorkspace(name) {
        const id = 'ws-' + Date.now();
        const ws = new Workspace(id, name);
        this.workspaces.push(ws);
        this.createTabUI(ws);
        this.setActiveWorkspace(ws);
    },

    setActiveWorkspace(ws) {
        this.activeWorkspace = ws;
        
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        const tab = document.querySelector(`[data-id="${ws.id}"]`);
        if (tab) tab.classList.add('active');

        if (this.controls) this.controls.dispose();
        this.controls = new OrbitControls(ws.camera, this.renderer.domElement);
        this.controls.enableDamping = true;

        if (this.transformControls) {
            ws.scene.remove(this.transformControls);
            this.transformControls.dispose();
        }
        this.transformControls = new TransformControls(ws.camera, this.renderer.domElement);
        this.transformControls.addEventListener('dragging-changed', (event) => {
            this.controls.enabled = !event.value;
        });
        this.transformControls.addEventListener('change', () => {
            if (this.activeWorkspace && this.activeWorkspace.selectedObjects.length > 0) {
                this.updatePropertyPanel(this.activeWorkspace.selectedObjects[0]);
            }
        });
        ws.scene.add(this.transformControls);

        this.setTool(this.activeTool);
        this.updateTreeView();
        this.updateClippingUI();
    },

    createTabUI(ws) {
        const tab = document.createElement('div');
        tab.className = 'tab';
        tab.setAttribute('data-id', ws.id);
        tab.innerHTML = `<span>${ws.name}</span> <span class="tab-close">×</span>`;
        
        tab.addEventListener('click', (e) => {
            if (e.target.classList.contains('tab-close')) {
                this.removeWorkspace(ws.id);
            } else {
                this.setActiveWorkspace(ws);
            }
        });
        
        document.getElementById('tabs').appendChild(tab);
    },

    removeWorkspace(id) {
        if (this.workspaces.length <= 1) return;
        const index = this.workspaces.findIndex(w => w.id === id);
        if (index === -1) return;
        this.workspaces.splice(index, 1);
        document.querySelector(`[data-id="${id}"]`).remove();
        if (this.activeWorkspace.id === id) {
            this.setActiveWorkspace(this.workspaces[Math.max(0, index - 1)]);
        }
    },

    setupEventListeners() {
        console.log("Setting up event listeners...");
        const safeListen = (id, event, callback) => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener(event, callback);
            } else {
                console.warn(`Element with id "${id}" not found for event "${event}".`);
            }
        };

        try {
            safeListen('file-upload', 'change', (e) => this.handleFileUpload(e));
            safeListen('load-sample', 'click', () => this.loadSample());
            safeListen('clear-all', 'click', () => this.clearAll());
            safeListen('reset-view', 'click', () => this.resetView());
            safeListen('add-tab', 'click', () => this.addWorkspace("새 프로젝트"));
            safeListen('refresh-tree', 'click', () => this.updateTreeView());

            // Tool buttons
            safeListen('tool-select', 'click', () => this.setTool('select'));
            safeListen('tool-move', 'click', () => { this.transformMode = 'translate'; this.setTool('move'); });
            safeListen('tool-rotate', 'click', () => { this.transformMode = 'rotate'; this.setTool('move'); });
            safeListen('tool-scale', 'click', () => { this.transformMode = 'scale'; this.setTool('move'); });
            safeListen('tool-measure', 'click', () => this.setTool('measure'));
            safeListen('tool-sketch', 'click', () => this.startSketch());
            safeListen('tool-copy', 'click', () => this.copySelected());
            safeListen('tool-delete', 'click', () => this.deleteSelected());
            safeListen('tool-axis', 'click', () => this.toggleAxis());

            // CAD Ops
            safeListen('op-union', 'click', () => this.performCSG(ADDITION));
            safeListen('op-subtract', 'click', () => this.performCSG(SUBTRACTION));
            safeListen('op-intersect', 'click', () => this.performCSG(INTERSECTION));
            safeListen('op-xor', 'click', () => this.performCSG(DIFFERENCE));
            safeListen('op-extrude', 'click', () => this.performExtrude());
            safeListen('add-axis', 'click', () => this.addNewAxis());

            // Sketch Toolbar
            safeListen('sketch-line', 'click', () => this.sketchMode = 'line');
            safeListen('sketch-rect', 'click', () => this.sketchMode = 'rect');
            safeListen('sketch-circle', 'click', () => this.sketchMode = 'circle');
            safeListen('sketch-finish', 'click', () => this.finishSketch());

            ['x', 'y', 'z'].forEach((axis, i) => {
                const el = document.getElementById(`clip-${axis}`);
                if (el) {
                    el.addEventListener('input', (e) => {
                        if (!this.activeWorkspace) return;
                        const val = parseFloat(e.target.value);
                        this.activeWorkspace.clippingPlanes[i].constant = val;
                        const label = document.getElementById(`${axis}-val`);
                        if (label) label.innerText = val >= 999 ? 'OFF' : val.toFixed(1);
                    });
                }
            });

            if (this.renderer && this.renderer.domElement) {
                this.renderer.domElement.addEventListener('pointerdown', (e) => this.onPointerDown(e));
                this.renderer.domElement.addEventListener('pointermove', (e) => this.onPointerMove(e));
            }

            window.addEventListener('keydown', (e) => {
                const key = e.key.toLowerCase();
                if (this.isSketching && key === 'escape') this.finishSketch();
                if (key === 'q') this.setTool('select');
                if (key === 'w') { this.transformMode = 'translate'; this.setTool('move'); }
                if (key === 'e') { this.transformMode = 'rotate'; this.setTool('move'); }
                if (key === 'r') { this.transformMode = 'scale'; this.setTool('move'); }
                if (key === 'm') this.setTool('measure');
                if (key === 's' && !this.isSketching) this.startSketch();
                if (key === 'a') this.toggleAxis();
                if (e.ctrlKey && key === 'c') this.copySelected();
                if (key === 'delete' || key === 'backspace') this.deleteSelected();
            });
            console.log("Event listeners setup complete.");
        } catch (err) {
            console.error("Error setting up event listeners:", err);
        }
    },

    setTool(tool) {
        this.activeTool = tool;
        document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
        
        const btnId = `tool-${tool === 'move' ? this.transformMode : tool}`;
        const btn = document.getElementById(btnId) || document.getElementById(`tool-${tool}`);
        if (btn) btn.classList.add('active');

        if (this.transformControls) {
            this.transformControls.setMode(this.transformMode);
            if (tool === 'move' && this.activeWorkspace.selectedObjects.length > 0) {
                this.transformControls.attach(this.activeWorkspace.selectedObjects[0]);
            } else {
                this.transformControls.detach();
            }
        }

        if (tool !== 'measure') this.clearMeasurement();
    },

    onPointerDown(event) {
        if (!this.activeWorkspace) return;
        if (this.transformControls.dragging) return;

        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.activeWorkspace.camera);

        if (this.isSketching) {
            this.handleSketchClick();
            return;
        }

        if (this.activeTool === 'select' || this.activeTool === 'move') {
            const intersects = this.raycaster.intersectObjects([...this.activeWorkspace.modelGroup.children, ...this.activeWorkspace.helpersGroup.children], true);
            if (intersects.length > 0) {
                let obj = intersects[0].object;
                while (obj.parent && obj.parent !== this.activeWorkspace.modelGroup && obj.parent !== this.activeWorkspace.helpersGroup && obj.parent.type !== 'Scene') {
                    obj = obj.parent;
                }
                
                if (event.ctrlKey || event.shiftKey) {
                    this.toggleObjectSelection(obj);
                } else {
                    this.selectObject(obj);
                }
            } else {
                this.selectObject(null);
            }
        } else if (this.activeTool === 'measure') {
            const intersects = this.raycaster.intersectObjects(this.activeWorkspace.modelGroup.children, true);
            if (intersects.length > 0) {
                this.addMeasurePoint(intersects[0].point);
            }
        }
    },

    onPointerMove(event) {
        if (!this.activeWorkspace || !this.isSketching) return;
        
        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        this.raycaster.setFromCamera(this.mouse, this.activeWorkspace.camera);

        const intersects = this.raycaster.intersectObject(this.workPlane);
        if (intersects.length > 0) {
            const point = intersects[0].point;
            this.updateSketchPreview(point);
        }
    },

    selectObject(obj) {
        this.activeWorkspace.selectedObjects.forEach(o => this.highlightObject(o, false));
        this.activeWorkspace.selectedObjects = obj ? [obj] : [];
        
        if (obj) {
            this.highlightObject(obj, true);
            if (this.transformControls) {
                if (this.activeTool === 'move') this.transformControls.attach(obj);
            }
            this.updatePropertyPanel(obj);
            
            // Enable/Disable Extrude
            document.getElementById('op-extrude').disabled = !(obj.userData && obj.userData.isSketch);
        } else {
            if (this.transformControls) this.transformControls.detach();
            document.getElementById('prop-content').innerText = '선택된 객체 없음';
            document.getElementById('op-extrude').disabled = true;
        }
        this.updateTreeView();
    },

    toggleObjectSelection(obj) {
        const idx = this.activeWorkspace.selectedObjects.indexOf(obj);
        if (idx > -1) {
            this.highlightObject(obj, false);
            this.activeWorkspace.selectedObjects.splice(idx, 1);
        } else {
            this.highlightObject(obj, true);
            this.activeWorkspace.selectedObjects.push(obj);
        }
        
        if (this.activeWorkspace.selectedObjects.length === 1) {
            if (this.transformControls && this.activeTool === 'move') this.transformControls.attach(this.activeWorkspace.selectedObjects[0]);
            this.updatePropertyPanel(this.activeWorkspace.selectedObjects[0]);
        } else {
            if (this.transformControls) this.transformControls.detach();
            document.getElementById('prop-content').innerText = `${this.activeWorkspace.selectedObjects.length}개 객체 선택됨`;
        }
        this.updateTreeView();
    },

    highlightObject(obj, enabled) {
        if (!obj) return;
        obj.traverse(child => {
            if (child.isMesh && child.material) {
                const materials = Array.isArray(child.material) ? child.material : [child.material];
                materials.forEach(mat => {
                    if (enabled) {
                        if (!mat._oldEmissive && mat.emissive) {
                            mat._oldEmissive = mat.emissive.clone();
                        }
                        if (mat.emissive) mat.emissive.setHex(0x333333);
                    } else if (mat._oldEmissive) {
                        if (mat.emissive) mat.emissive.copy(mat._oldEmissive);
                    }
                });
            }
        });
    },

    updatePropertyPanel(obj) {
        if (!obj) return;
        const box = new THREE.Box3().setFromObject(obj);
        const size = box.getSize(new THREE.Vector3());
        let colorHex = "#cccccc";
        
        obj.traverse(child => {
            if (child.isMesh && child.material) {
                const materials = Array.isArray(child.material) ? child.material : [child.material];
                const mat = materials[0];
                if (mat && mat.color) {
                    colorHex = "#" + mat.color.getHexString();
                }
            }
        });

        const html = `
            <div class="prop-row"><span class="prop-label">이름:</span> <input type="text" id="prop-name" value="${obj.name || ''}" style="width: 100px; font-size: 0.75rem;"></div>
            <div class="prop-row"><span class="prop-label">색상:</span> <input type="color" id="prop-color" value="${colorHex}"></div>
            <div style="height: 1px; background: #eee; margin: 8px 0;"></div>
            <div class="prop-row"><span class="prop-label">위치 X:</span> <span class="prop-value">${obj.position.x.toFixed(2)}</span></div>
            <div class="prop-row"><span class="prop-label">위치 Y:</span> <span class="prop-value">${obj.position.y.toFixed(2)}</span></div>
            <div class="prop-row"><span class="prop-label">위치 Z:</span> <span class="prop-value">${obj.position.z.toFixed(2)}</span></div>
        `;
        document.getElementById('prop-content').innerHTML = html;

        const nameInput = document.getElementById('prop-name');
        if (nameInput) {
            nameInput.addEventListener('change', (e) => {
                obj.name = e.target.value;
                this.updateTreeView();
            });
        }
        
        const colorInput = document.getElementById('prop-color');
        if (colorInput) {
            colorInput.addEventListener('input', (e) => {
                const color = new THREE.Color(e.target.value);
                obj.traverse(child => {
                    if (child.isMesh && child.material) {
                        const materials = Array.isArray(child.material) ? child.material : [child.material];
                        materials.forEach(m => { if (m.color) m.color.copy(color); });
                    }
                });
            });
        }
    },

    // CAD Operations
    async performCSG(operation) {
        const selected = this.activeWorkspace.selectedObjects.filter(o => o.isMesh || (o.children && o.children.some(c => c.isMesh)));
        if (selected.length < 2) {
            alert("연산을 위해 최소 2개의 객체를 선택하세요. (Ctrl+클릭)");
            return;
        }

        document.getElementById('loading').style.display = 'block';
        
        try {
            const evaluator = new Evaluator();
            let resultBrush = this.createBrushFromObject(selected[0]);

            for (let i = 1; i < selected.length; i++) {
                const nextBrush = this.createBrushFromObject(selected[i]);
                resultBrush = evaluator.evaluate(resultBrush, nextBrush, operation);
            }

            resultBrush.material = new THREE.MeshStandardMaterial({ 
                color: 0x3498db, 
                roughness: 0.3, 
                metalness: 0.2,
                clippingPlanes: this.activeWorkspace.clippingPlanes
            });
            resultBrush.name = "CSG_Result_" + Date.now();
            
            this.activeWorkspace.modelGroup.add(resultBrush);
            
            // Optionally remove originals
            // selected.forEach(o => o.parent.remove(o));
            
            this.selectObject(resultBrush);
            this.updateTreeView();
        } catch (err) {
            console.error("CSG Error:", err);
            alert("CSG 연산 중 오류가 발생했습니다.");
        } finally {
            document.getElementById('loading').style.display = 'none';
        }
    },

    createBrushFromObject(obj) {
        // If it's a group, we need to merge it or pick the first mesh
        let mesh;
        if (obj.isMesh) {
            mesh = obj;
        } else {
            obj.traverse(c => { if (c.isMesh && !mesh) mesh = c; });
        }
        
        if (!mesh) throw new Error("선택된 객체에 메쉬가 없습니다.");
        
        const brush = new Brush(mesh.geometry, mesh.material);
        obj.updateMatrixWorld();
        brush.applyMatrix4(obj.matrixWorld);
        return brush;
    },

    // Sketching
    startSketch() {
        console.log("Starting sketch mode...");
        if (this.isSketching) return;
        this.isSketching = true;
        document.getElementById('sketch-toolbar').style.display = 'flex';
        this.setTool('sketch');

        // Create a workplane (grid helper + invisible plane for raycasting)
        const grid = new THREE.GridHelper(500, 50, 0x888888, 0xcccccc);
        grid.rotation.x = Math.PI / 2;
        grid.name = "sketch_grid";
        
        const planeGeo = new THREE.PlaneGeometry(2000, 2000);
        const planeMat = new THREE.MeshBasicMaterial({ visible: false });
        this.workPlane = new THREE.Mesh(planeGeo, planeMat);
        this.workPlane.name = "sketch_plane";

        this.activeWorkspace.helpersGroup.add(grid);
        this.activeWorkspace.helpersGroup.add(this.workPlane);
        
        this.sketchPoints = [];
        this.currentSketchGroup = new THREE.Group();
        this.currentSketchGroup.name = "Sketch_" + Date.now();
        this.activeWorkspace.modelGroup.add(this.currentSketchGroup);
        console.log("Sketch mode active, group created.");
    },

    handleSketchClick() {
        const intersects = this.raycaster.intersectObject(this.workPlane);
        if (intersects.length > 0) {
            const p = intersects[0].point;
            this.sketchPoints.push(p.clone());
            
            if (this.sketchMode === 'line') {
                if (this.sketchPoints.length > 1) {
                    this.addSketchLine(this.sketchPoints[this.sketchPoints.length-2], p);
                }
            } else if (this.sketchMode === 'rect' || this.sketchMode === 'circle') {
                if (this.sketchPoints.length === 2) {
                    this.finalizeSketchShape();
                }
            }
        }
    },

    updateSketchPreview(point) {
        if (this.sketchPoints.length === 0) return;
        const start = this.sketchPoints[this.sketchPoints.length - 1];
        
        if (this.sketchMode === 'line') {
            if (this.previewLine) this.currentSketchGroup.remove(this.previewLine);
            const geo = new THREE.BufferGeometry().setFromPoints([start, point]);
            this.previewLine = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffff00 }));
            this.currentSketchGroup.add(this.previewLine);
        }
    },

    addSketchLine(p1, p2) {
        const geo = new THREE.BufferGeometry().setFromPoints([p1, p2]);
        const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0x0000ff, linewidth: 2 }));
        this.currentSketchGroup.add(line);
    },

    finalizeSketchShape() {
        const p1 = this.sketchPoints[0];
        const p2 = this.sketchPoints[1];
        
        if (this.sketchMode === 'rect') {
            const shape = new THREE.Shape();
            shape.moveTo(p1.x, p1.y);
            shape.lineTo(p2.x, p1.y);
            shape.lineTo(p2.x, p2.y);
            shape.lineTo(p1.x, p2.y);
            shape.lineTo(p1.x, p1.y);
            
            const geo = new THREE.ShapeGeometry(shape);
            const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x3498db, transparent: true, opacity: 0.5, side: THREE.DoubleSide }));
            this.currentSketchGroup.add(mesh);
        } else if (this.sketchMode === 'circle') {
            const r = p1.distanceTo(p2);
            const geo = new THREE.CircleGeometry(r, 32);
            const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x3498db, transparent: true, opacity: 0.5, side: THREE.DoubleSide }));
            mesh.position.copy(p1);
            this.currentSketchGroup.add(mesh);
        }
        this.sketchPoints = [];
    },

    finishSketch() {
        this.isSketching = false;
        document.getElementById('sketch-toolbar').style.display = 'none';
        
        const toRemove = [];
        this.activeWorkspace.helpersGroup.traverse(o => {
            if (o.name === "sketch_grid" || o.name === "sketch_plane") toRemove.push(o);
        });
        toRemove.forEach(o => o.parent.remove(o));
        
        if (this.previewLine) this.currentSketchGroup.remove(this.previewLine);
        this.previewLine = null;
        
        this.currentSketchGroup.userData.isSketch = true;
        this.setTool('select');
        this.updateTreeView();
    },

    performExtrude() {
        const obj = this.activeWorkspace.selectedObjects[0];
        if (!obj || !obj.userData.isSketch) return;

        const depth = parseFloat(prompt("Extrude 깊이 (mm):", "50"));
        if (isNaN(depth)) return;

        // Simplified extrusion: if it has meshes, extrude them
        obj.traverse(child => {
            if (child.isMesh && child.geometry.type === 'ShapeGeometry') {
                const shape = child.geometry.parameters.shapes;
                const extrudeSettings = { depth: depth, bevelEnabled: false };
                const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
                const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: 0x95a5a6, clippingPlanes: this.activeWorkspace.clippingPlanes }));
                mesh.position.copy(child.position);
                mesh.name = "Extrusion_" + Date.now();
                this.activeWorkspace.modelGroup.add(mesh);
            }
        });
        
        this.updateTreeView();
    },

    addNewAxis() {
        console.log("Adding new axis helper...");
        const helper = new THREE.AxesHelper(100);
        helper.name = "Local_Axis_" + Date.now();
        this.activeWorkspace.helpersGroup.add(helper);
        this.selectObject(helper);
        this.updateTreeView();
        console.log("Axis added to scene.");
    },

    deleteSelected() {
        if (this.activeWorkspace.selectedObjects.length === 0) return;
        if (confirm(`${this.activeWorkspace.selectedObjects.length}개 객체를 삭제하시겠습니까?`)) {
            this.activeWorkspace.selectedObjects.forEach(obj => obj.parent.remove(obj));
            this.selectObject(null);
            this.updateTreeView();
        }
    },

    clearAll() {
        if (confirm("모든 객체를 삭제하시겠습니까?")) {
            [...this.activeWorkspace.modelGroup.children].forEach(c => this.activeWorkspace.modelGroup.remove(c));
            [...this.activeWorkspace.helpersGroup.children].forEach(c => this.activeWorkspace.helpersGroup.remove(c));
            this.selectObject(null);
            this.updateTreeView();
        }
    },

    addMeasurePoint(point) {
        this.measurePoints.push(point.clone());
        const geo = new THREE.SphereGeometry(2);
        const mat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
        const sphere = new THREE.Mesh(geo, mat);
        sphere.position.copy(point);
        sphere.name = "measure_marker";
        this.activeWorkspace.scene.add(sphere);

        if (this.measurePoints.length === 2) {
            this.drawMeasureLine();
        } else if (this.measurePoints.length > 2) {
            this.clearMeasurement();
            this.addMeasurePoint(point);
        }
    },

    drawMeasureLine() {
        const p1 = this.measurePoints[0];
        const p2 = this.measurePoints[1];
        const geometry = new THREE.BufferGeometry().setFromPoints([p1, p2]);
        const material = new THREE.LineBasicMaterial({ color: 0xff0000, linewidth: 2, depthTest: false });
        this.measureLine = new THREE.Line(geometry, material);
        this.measureLine.name = "measure_line";
        this.activeWorkspace.scene.add(this.measureLine);

        const dist = p1.distanceTo(p2);
        const label = document.getElementById('measure-label');
        label.style.display = 'block';
        label.innerText = `${dist.toFixed(2)} mm`;
        this.updateLabelPosition(p1.clone().add(p2).multiplyScalar(0.5));
    },

    updateLabelPosition(point) {
        const label = document.getElementById('measure-label');
        const vector = point.clone().project(this.activeWorkspace.camera);
        const x = (vector.x + 1) / 2 * window.innerWidth;
        const y = -(vector.y - 1) / 2 * window.innerHeight;
        label.style.left = x + 'px';
        label.style.top = y + 'px';
    },

    clearMeasurement() {
        this.measurePoints = [];
        const toRemove = [];
        this.activeWorkspace.scene.traverse(obj => {
            if (obj.name === "measure_marker" || obj.name === "measure_line") toRemove.push(obj);
        });
        toRemove.forEach(o => o.parent.remove(o));
        document.getElementById('measure-label').style.display = 'none';
    },

    copySelected() {
        const obj = this.activeWorkspace.selectedObjects[0];
        if (!obj) return;
        const clone = obj.clone();
        clone.position.x += 20;
        clone.name = obj.name + "_copy";
        obj.parent.add(clone);
        this.selectObject(clone);
        this.updateTreeView();
    },

    toggleAxis() {
        if (!this.activeWorkspace) return;
        this.activeWorkspace.axesHelper.visible = !this.activeWorkspace.axesHelper.visible;
    },

    async handleFileUpload(event) {
        const files = Array.from(event.target.files);
        if (files.length === 0) return;
        document.getElementById('loading').style.display = 'block';
        for (const file of files) {
            const extension = file.name.split('.').pop().toLowerCase();
            const reader = new FileReader();
            const promise = new Promise((resolve) => {
                reader.onload = async (e) => {
                    try { await this.loadModel(e.target.result, extension, file.name); } catch (err) { console.error(err); }
                    resolve();
                };
            });
            if (['obj', 'stl', 'step', 'stp'].includes(extension)) {
                reader.readAsArrayBuffer(file);
                await promise;
            }
        }
        document.getElementById('loading').style.display = 'none';
        this.updateTreeView();
    },

    async loadSample() {
        document.getElementById('loading').style.display = 'block';
        try {
            const response = await fetch('models/sample.step');
            const buffer = await response.arrayBuffer();
            await this.loadModel(buffer, 'step', 'sample.step');
            this.updateTreeView();
        } catch (err) { console.error(err); }
        finally { document.getElementById('loading').style.display = 'none'; }
    },

    async loadModel(buffer, extension, fileName) {
        let object;
        const clippingPlanes = this.activeWorkspace.clippingPlanes;

        if (extension === 'step' || extension === 'stp') {
            object = await this.loadStepModel(buffer, clippingPlanes);
        } else if (extension === 'stl') {
            const loader = new STLLoader();
            const geometry = loader.parse(buffer);
            const material = new THREE.MeshPhongMaterial({ color: 0x999999, specular: 0x111111, shininess: 200, clippingPlanes, side: THREE.DoubleSide });
            object = new THREE.Mesh(geometry, material);
        } else if (extension === 'obj') {
            const loader = new OBJLoader();
            const text = new TextDecoder().decode(buffer);
            object = loader.parse(text);
            object.traverse(child => { if (child.isMesh) { child.material.clippingPlanes = clippingPlanes; child.material.side = THREE.DoubleSide; } });
        }

        if (object) {
            object.name = fileName;
            this.activeWorkspace.modelGroup.add(object);
            if (this.activeWorkspace.modelGroup.children.length === 1) {
                const box = new THREE.Box3().setFromObject(object);
                const size = box.getSize(new THREE.Vector3());
                const maxDim = Math.max(size.x, size.y, size.z);
                this.activeWorkspace.camera.position.set(maxDim, maxDim, maxDim);
                this.controls.update();
            }
        }
    },

    async loadStepModel(buffer, clippingPlanes) {
        console.log("Loading STEP model...");
        return new Promise((resolve, reject) => {
            if (typeof occtimportjs === 'undefined') {
                console.error("occtimportjs not found!");
                return reject(new Error("occtimportjs library not loaded"));
            }
            occtimportjs({ locateFile: (path) => 'js/' + path }).then(async (occt) => {
                console.log("occt library initialized");
                const result = occt.ReadStepFile(new Uint8Array(buffer));
                if (!result.success) {
                    console.error("STEP parsing failed", result);
                    return reject(new Error('STEP parsing failed'));
                }
                console.log("STEP parsed, creating meshes...", result.meshes.length);
                const group = new THREE.Group();
                result.meshes.forEach(resultMesh => {
                    const geometry = new THREE.BufferGeometry();
                    geometry.setAttribute('position', new THREE.Float32BufferAttribute(resultMesh.attributes.position.array, 3));
                    if (resultMesh.attributes.normal) geometry.setAttribute('normal', new THREE.Float32BufferAttribute(resultMesh.attributes.normal.array, 3));
                    geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(resultMesh.index.array), 1));
                    group.add(new THREE.Mesh(geometry, new THREE.MeshPhongMaterial({ color: 0xcccccc, specular: 0x111111, shininess: 200, clippingPlanes, side: THREE.DoubleSide })));
                });
                console.log("meshes created");
                resolve(group);
            }).catch(err => {
                console.error("occt error:", err);
                reject(err);
            });
        });
    },

    updateTreeView() {
        const container = document.getElementById('tree-view');
        container.innerHTML = '';
        if (!this.activeWorkspace) return;
        const buildTree = (obj, parentEl) => {
            if (obj.isTransformControls || obj.name === "measure_marker" || obj.name === "measure_line" || obj.name === "sketch_plane" || obj.name === "sketch_grid") return;
            const li = document.createElement('li');
            li.className = 'tree-item' + (this.activeWorkspace.selectedObjects.includes(obj) ? ' selected' : '');
            const visibilityIcon = obj.visible ? '👁️' : '🕶️';
            li.innerHTML = `<span class="visibility-toggle">${visibilityIcon}</span> <span class="type-icon">${obj.isMesh ? '🧊' : '📁'}</span> <span class="item-name" style="flex: 1;">${obj.name || "Object"}</span> <span class="delete-item">×</span>`;
            li.querySelector('.item-name').addEventListener('click', (e) => { e.stopPropagation(); if (e.ctrlKey) this.toggleObjectSelection(obj); else this.selectObject(obj); });
            li.querySelector('.visibility-toggle').addEventListener('click', (e) => { e.stopPropagation(); obj.visible = !obj.visible; this.updateTreeView(); });
            li.querySelector('.delete-item').addEventListener('click', (e) => { e.stopPropagation(); obj.parent.remove(obj); this.updateTreeView(); });
            parentEl.appendChild(li);
            if (obj.children && obj.children.length > 0) {
                const ul = document.createElement('ul');
                ul.className = 'tree-children';
                obj.children.forEach(child => buildTree(child, ul));
                if (ul.children.length > 0) parentEl.appendChild(ul);
            }
        };
        this.activeWorkspace.modelGroup.children.forEach(child => buildTree(child, container));
        this.activeWorkspace.helpersGroup.children.forEach(child => buildTree(child, container));
    },

    updateClippingUI() {
        const ws = this.activeWorkspace;
        ['x', 'y', 'z'].forEach((axis, i) => {
            const val = ws.clippingPlanes[i].constant;
            document.getElementById(`clip-${axis}`).value = val;
            document.getElementById(`${axis}-val`).innerText = val >= 999 ? 'OFF' : val.toFixed(1);
        });
    },

    resetView() {
        if (!this.activeWorkspace) return;
        this.controls.reset();
        this.activeWorkspace.clippingPlanes.forEach(p => p.constant = 1000);
        this.updateClippingUI();
    },

    onWindowResize() {
        if (!this.activeWorkspace) return;
        this.activeWorkspace.camera.aspect = window.innerWidth / window.innerHeight;
        this.activeWorkspace.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    },

    animate() {
        requestAnimationFrame(() => this.animate());
        if (this.activeWorkspace) {
            this.controls.update();
            this.renderer.render(this.activeWorkspace.scene, this.activeWorkspace.camera);
            if (this.activeTool === 'measure' && this.measurePoints.length === 2) {
                this.updateLabelPosition(this.measurePoints[0].clone().add(this.measurePoints[1]).multiplyScalar(0.5));
            }
        }
    }
};

App.init();
