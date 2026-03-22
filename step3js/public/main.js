import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';

let scene, camera, renderer, controls, modelGroup;
let clippingPlanes = [
    new THREE.Plane(new THREE.Vector3(-1, 0, 0), 100),
    new THREE.Plane(new THREE.Vector3(0, -1, 0), 100),
    new THREE.Plane(new THREE.Vector3(0, 0, -1), 100)
];

const statsEl = document.getElementById('stats');
const loadingEl = document.getElementById('loading');

init();
animate();

// Call backend API when app starts
fetch('/api/analytics', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event: 'app_start', timestamp: new Date().toISOString() })
});

function init() {
    // Scene setup
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f2f5);

    // Camera setup
    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 10000);
    camera.position.set(200, 200, 200);

    // Renderer setup
    renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.localClippingEnabled = true; // Essential for section view
    document.getElementById('canvas-container').appendChild(renderer.domElement);

    // Controls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    // Lights
    const ambientLight = new THREE.AmbientLight(0x404040, 2);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 2);
    dirLight1.position.set(100, 100, 100);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0xffffff, 1);
    dirLight2.position.set(-100, -100, -100);
    scene.add(dirLight2);

    modelGroup = new THREE.Group();
    scene.add(modelGroup);

    // UI Events
    document.getElementById('file-upload').addEventListener('change', handleFileUpload);
    document.getElementById('load-sample').addEventListener('click', loadSample);
    document.getElementById('reset-view').addEventListener('click', resetView);

    // Clipping UI Events
    ['x', 'y', 'z'].forEach((axis, index) => {
        const el = document.getElementById(`clip-${axis}`);
        el.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            clippingPlanes[index].constant = val;
            document.getElementById(`${axis}-val`).innerText = val === 100 ? 'OFF' : val.toFixed(1);
        });
    });

    window.addEventListener('resize', onWindowResize);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

async function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const extension = file.name.split('.').pop().toLowerCase();
    loadingEl.style.display = 'block';

    const reader = new FileReader();
    reader.onload = async (e) => {
        const buffer = e.target.result;
        try {
            await loadModel(buffer, extension, file.name);
        } catch (err) {
            console.error('Error loading model:', err);
            alert('모델 로딩 실패: ' + err.message);
        } finally {
            loadingEl.style.display = 'none';
        }
    };

    if (extension === 'obj' || extension === 'stl' || extension === 'step' || extension === 'stp') {
        reader.readAsArrayBuffer(file);
    } else {
        alert('지원하지 않는 형식입니다.');
        loadingEl.style.display = 'none';
    }
}

async function loadSample() {
    loadingEl.style.display = 'block';
    try {
        const response = await fetch('models/sample.step');
        if (!response.ok) throw new Error('Sample file not found');
        const buffer = await response.arrayBuffer();
        await loadModel(buffer, 'step', 'sample.step');
    } catch (err) {
        console.error(err);
        alert('샘플 로딩 실패');
    } finally {
        loadingEl.style.display = 'none';
    }
}

async function loadModel(buffer, extension, fileName) {
    // Clear previous model
    while (modelGroup.children.length > 0) {
        modelGroup.remove(modelGroup.children[0]);
    }

    let object;

    if (extension === 'step' || extension === 'stp') {
        object = await loadStepModel(buffer);
    } else if (extension === 'stl') {
        const loader = new STLLoader();
        const geometry = loader.parse(buffer);
        const material = new THREE.MeshPhongMaterial({
            color: 0x999999,
            specular: 0x111111,
            shininess: 200,
            clippingPlanes: clippingPlanes,
            clipShadows: true,
            side: THREE.DoubleSide
        });
        object = new THREE.Mesh(geometry, material);
    } else if (extension === 'obj') {
        const loader = new OBJLoader();
        const text = new TextDecoder().decode(buffer);
        object = loader.parse(text);
        object.traverse(child => {
            if (child.isMesh) {
                child.material.clippingPlanes = clippingPlanes;
                child.material.clipShadows = true;
                child.material.side = THREE.DoubleSide;
            }
        });
    }

    if (object) {
        modelGroup.add(object);

        // Center model
        const box = new THREE.Box3().setFromObject(object);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        
        object.position.sub(center);

        // Adjust camera
        const maxDim = Math.max(size.x, size.y, size.z);
        camera.position.set(maxDim * 1.5, maxDim * 1.5, maxDim * 1.5);
        camera.lookAt(0, 0, 0);
        controls.target.set(0, 0, 0);
        controls.update();

        // Update clipping sliders range
        const limit = maxDim / 2 + 5;
        ['x', 'y', 'z'].forEach((axis, i) => {
            const el = document.getElementById(`clip-${axis}`);
            el.min = -limit;
            el.max = limit;
            el.value = limit;
            clippingPlanes[i].constant = limit;
            document.getElementById(`${axis}-val`).innerText = 'OFF';
        });

        statsEl.innerText = `객체 정보: ${fileName} (${Math.round(buffer.byteLength / 1024)} KB)`;

        // Notify backend of loaded model
        fetch('/api/analytics', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                event: 'model_loaded', 
                fileName: fileName,
                fileSize: buffer.byteLength,
                extension: extension
            })
        });
    }
}

async function loadStepModel(buffer) {
    return new Promise((resolve, reject) => {
        // occtimportjs is a global function from occt-import-js.js
        occtimportjs({
            locateFile: (path) => {
                return 'js/' + path;
            }
        }).then(async (occt) => {
            const result = occt.ReadStepFile(new Uint8Array(buffer));
            if (!result.success) {
                reject(new Error('STEP parsing failed'));
                return;
            }

            const group = new THREE.Group();
            for (let i = 0; i < result.meshes.length; i++) {
                const resultMesh = result.meshes[i];
                const geometry = new THREE.BufferGeometry();
                
                geometry.setAttribute('position', new THREE.Float32BufferAttribute(resultMesh.attributes.position.array, 3));
                if (resultMesh.attributes.normal) {
                    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(resultMesh.attributes.normal.array, 3));
                }
                
                const index = new Uint32Array(resultMesh.index.array);
                geometry.setIndex(new THREE.BufferAttribute(index, 1));

                const material = new THREE.MeshPhongMaterial({
                    color: 0xcccccc,
                    specular: 0x111111,
                    shininess: 200,
                    clippingPlanes: clippingPlanes,
                    clipShadows: true,
                    side: THREE.DoubleSide
                });

                const mesh = new THREE.Mesh(geometry, material);
                group.add(mesh);
            }
            resolve(group);
        }).catch(reject);
    });
}

function resetView() {
    controls.reset();
    ['x', 'y', 'z'].forEach((axis, i) => {
        const el = document.getElementById(`clip-${axis}`);
        el.value = el.max;
        clippingPlanes[i].constant = parseFloat(el.max);
        document.getElementById(`${axis}-val`).innerText = 'OFF';
    });
}
