import * as THREE from 'three';

export class ChunkManager {
    constructor(scene, texture) {
        this.scene = scene;
        this.texture = texture;
        this.chunkSize = 32;
        this.tileSize = 32;
        this.tileTextureWidth = 512;
        this.chunks = new Map();
        this.meshes = new Map();
        
        this.solidMaterial = new THREE.MeshLambertMaterial({ map: texture, side: THREE.FrontSide });
        this.alphaMaterial = new THREE.MeshLambertMaterial({ map: texture, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide });
        this.waterMaterial = new THREE.MeshLambertMaterial({ map: texture, transparent: true, opacity: 0.6, side: THREE.DoubleSide });
        
        this.villages = [
            {cx: 0, cz: 0, name: "Origin Grove", theme: "grass", floor: 1, wall: 3},
            {cx: 10, cz: 10, name: "Iron Bastion", theme: "stone", floor: 8, wall: 8},
            {cx: -10, cz: 10, name: "Water's Edge", theme: "water", floor: 9, wall: 10},
            {cx: 10, cz: -10, name: "Sun Valley", theme: "sand", floor: 2, wall: 7},
            {cx: -10, cz: -10, name: "Dark Crag", theme: "lava", floor: 3, wall: 3}
        ];
    }

    getChunkId(cx, cz) { return `${cx},${cz}`; }
    getVillage(cx, cz) { return this.villages.find(v => v.cx === cx && v.cz === cz); }

    getNoise(x, z) {
        const f1 = 0.02, f2 = 0.08, f3 = 0.2;
        const a1 = 15, a2 = 5, a3 = 2;
        const n1 = Math.sin(x * f1) * Math.cos(z * f1);
        const n2 = Math.sin(x * f2 + 1.2) * Math.cos(z * f2 + 0.5);
        const n3 = Math.sin(x * f3) * Math.sin(z * f3);
        let h = 12 + n1 * a1 + n2 * a2 + n3 * a3;
        if (n1 > 0.4) h += 10;
        if (n1 < -0.4) h -= 8;
        if (Math.abs(n1) < 0.03) h = 8; 
        return Math.floor(h);
    }

    generateChunkData(cx, cz) {
        const chunk = new Uint8Array(this.chunkSize * 64 * this.chunkSize);
        const village = this.getVillage(cx, cz);
        for (let lx = 0; lx < this.chunkSize; lx++) {
            for (let lz = 0; lz < this.chunkSize; lz++) {
                const wx = cx * this.chunkSize + lx;
                const wz = cz * this.chunkSize + lz;
                if (village) {
                    const h = 15;
                    for (let y = 0; y < 64; y++) {
                        let b = 0;
                        if (y < h) b = 2;
                        if (y === h - 1) b = village.floor;
                        const wallWidth = 2;
                        const isWallX = (lx < wallWidth || lx >= this.chunkSize - wallWidth);
                        const isWallZ = (lz < wallWidth || lz >= this.chunkSize - wallWidth);
                        if (y >= h && y < h + 5) {
                            if (isWallX || isWallZ) {
                                const isGateX = (lz >= 14 && lz <= 17);
                                const isGateZ = (lx >= 14 && lx <= 17);
                                if ((isWallX && isGateX) || (isWallZ && isGateZ)) b = 0; 
                                else b = village.wall;
                            }
                        }
                        this.setVoxelData(chunk, lx, y, lz, b);
                    }
                } else {
                    const h = this.getNoise(wx, wz);
                    const hash = (Math.abs(Math.sin(wx * 12.9898 + wz * 78.233)) * 43758.5453) % 1;
                    for (let y = 0; y < 64; y++) {
                        let b = 0;
                        if (y < h) {
                            b = 2;
                            if (y === h - 1) b = 1;
                            if (y < h - 4) b = 3;
                            if (Math.sin(wx * 0.03) + Math.cos(wz * 0.03) > 1.2) { b = 2; if (y === h - 1) b = 2; }
                        } else if (y < 10) { b = 11; }
                        this.setVoxelData(chunk, lx, y, lz, b);
                    }
                    if (h >= 10 && h < 45) {
                        const groundType = this.getVoxelData(chunk, lx, h-1, lz);
                        if (groundType === 1 || groundType === 2) {
                            if (hash < 0.02) { 
                                const treeH = 4 + Math.floor(hash * 100) % 3;
                                for (let th = 0; th < treeH; th++) this.setVoxelData(chunk, lx, h + th, lz, 4);
                                for (let ox = -2; ox <= 2; ox++) {
                                    for (let oz = -2; oz <= 2; oz++) {
                                        for (let oy = treeH - 1; oy <= treeH + 1; oy++) {
                                            if (Math.abs(ox) + Math.abs(oz) + Math.abs(oy - treeH) < 4) {
                                                this.setVoxelData(chunk, lx + ox, h + oy, lz + oz, 5);
                                            }
                                        }
                                    }
                                }
                            } else if (hash > 0.985) { this.setVoxelData(chunk, lx, h, lz, 6); }
                            else if (hash > 0.975 && groundType === 2) { 
                                this.setVoxelData(chunk, lx, h, lz, 7); 
                                this.setVoxelData(chunk, lx, h+1, lz, 7); 
                            }
                        }
                    }
                }
            }
        }
        return chunk;
    }

    setVoxelData(chunk, x, y, z, v) {
        if (x < 0 || x >= this.chunkSize || y < 0 || y >= 64 || z < 0 || z >= this.chunkSize) return;
        chunk[y * this.chunkSize * this.chunkSize + z * this.chunkSize + x] = v;
    }

    getVoxelData(chunk, x, y, z) {
        if (x < 0 || x >= this.chunkSize || y < 0 || y >= 64 || z < 0 || z >= this.chunkSize) return 0;
        return chunk[y * this.chunkSize * this.chunkSize + z * this.chunkSize + x];
    }

    getVoxelGlobal(x, y, z) {
        if (y < 0 || y >= 64) return 0;
        const cx = Math.floor(x / this.chunkSize);
        const cz = Math.floor(z / this.chunkSize);
        const id = this.getChunkId(cx, cz);
        const chunk = this.chunks.get(id);
        if (!chunk) return -1; 
        const lx = THREE.MathUtils.euclideanModulo(Math.floor(x), this.chunkSize);
        const lz = THREE.MathUtils.euclideanModulo(Math.floor(z), this.chunkSize);
        return this.getVoxelData(chunk, lx, Math.floor(y), lz);
    }

    setVoxelGlobal(x, y, z, v) {
        if (y < 0 || y >= 64) return;
        const cx = Math.floor(x / this.chunkSize);
        const cz = Math.floor(z / this.chunkSize);
        const id = this.getChunkId(cx, cz);
        let chunk = this.chunks.get(id);
        if (!chunk) {
            chunk = this.generateChunkData(cx, cz);
            this.chunks.set(id, chunk);
        }
        const lx = THREE.MathUtils.euclideanModulo(Math.floor(x), this.chunkSize);
        const lz = THREE.MathUtils.euclideanModulo(Math.floor(z), this.chunkSize);
        this.setVoxelData(chunk, lx, Math.floor(y), lz, v);
        this.updateChunkMesh(cx, cz);
        [-1, 1].forEach(ox => this.updateChunkMesh(cx + ox, cz));
        [-1, 1].forEach(oz => this.updateChunkMesh(cx, cz + oz));
    }

    updateChunkMesh(cx, cz) {
        const id = this.getChunkId(cx, cz);
        const chunk = this.chunks.get(id);
        if (!chunk) return;

        const isSolid = (v) => v !== 0 && v !== 11 && v !== 5 && v !== 6 && v !== -1;
        const isTransparent = (v) => v === 0 || v === 11 || v === 5 || v === 6;

        const startX = cx * this.chunkSize, startZ = cz * this.chunkSize;
        const faces = [
            { dir: [-1, 0, 0], v: [[0, 0, 0, 0, 0], [0, 0, 1, 1, 0], [0, 1, 0, 0, 1], [0, 1, 1, 1, 1]] }, // Left
            { dir: [1, 0, 0], v: [[1, 0, 1, 0, 0], [1, 0, 0, 1, 0], [1, 1, 1, 0, 1], [1, 1, 0, 1, 1]] }, // Right
            { dir: [0, -1, 0], v: [[0, 0, 1, 0, 0], [1, 0, 1, 1, 0], [0, 0, 0, 0, 1], [1, 0, 0, 1, 1]] }, // Bottom
            { dir: [0, 1, 0], v: [[0, 1, 1, 0, 1], [1, 1, 1, 1, 1], [0, 1, 0, 0, 0], [1, 1, 0, 1, 0]] }, // Top
            { dir: [0, 0, -1], v: [[1, 0, 0, 0, 0], [0, 0, 0, 1, 0], [1, 1, 0, 0, 1], [0, 1, 0, 1, 1]] }, // Front
            { dir: [0, 0, 1], v: [[0, 0, 1, 0, 0], [1, 0, 1, 1, 0], [0, 1, 1, 0, 1], [1, 1, 1, 1, 1]] }  // Back
        ];

        let chunkGroup = this.meshes.get(id);
        if (!chunkGroup) {
            chunkGroup = new THREE.Group();
            this.scene.add(chunkGroup);
            this.meshes.set(id, chunkGroup);
        } else {
            chunkGroup.clear();
        }

        const layers = [
            { material: this.solidMaterial, voxels: [1,2,3,4,7,8,9,10] },
            { material: this.alphaMaterial, voxels: [5,6] },
            { material: this.waterMaterial, voxels: [11] }
        ];

        for (const layer of layers) {
            const positions = [], normals = [], uvs = [], indices = [];
            for (let y = 0; y < 64; ++y) {
                for (let lz = 0; lz < this.chunkSize; ++lz) {
                    for (let lx = 0; lx < this.chunkSize; ++lx) {
                        const voxel = this.getVoxelData(chunk, lx, y, lz);
                        if (voxel && layer.voxels.includes(voxel)) {
                            const uvVoxel = voxel - 1;
                            for (const face of faces) {
                                const nx = lx + face.dir[0], ny = y + face.dir[1], nz = lz + face.dir[2];
                                let neighbor = (nx >= 0 && nx < this.chunkSize && ny >= 0 && ny < 64 && nz >= 0 && nz < this.chunkSize) 
                                    ? this.getVoxelData(chunk, nx, ny, nz) 
                                    : this.getVoxelGlobal(startX + nx, ny, startZ + nz);

                                if (!isSolid(neighbor) || (isTransparent(voxel) && neighbor !== voxel)) {
                                    const ndx = positions.length / 3;
                                    for (const vert of face.v) {
                                        positions.push(vert[0] + startX + lx, (voxel === 11 && face.dir[1] === 1 ? vert[1] - 0.15 : vert[1]) + y, vert[2] + startZ + lz);
                                        normals.push(...face.dir);
                                        uvs.push((uvVoxel + vert[3]) * this.tileSize / this.tileTextureWidth, vert[4]);
                                    }
                                    indices.push(ndx, ndx + 1, ndx + 2, ndx + 2, ndx + 1, ndx + 3);
                                }
                            }
                        }
                    }
                }
            }
            if (positions.length > 0) {
                const geo = new THREE.BufferGeometry();
                geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
                geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
                geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
                geo.setIndex(indices);
                chunkGroup.add(new THREE.Mesh(geo, layer.material));
            }
        }
    }

    updatePlayerPosition(px, pz) {
        const cx = Math.floor(px / this.chunkSize);
        const cz = Math.floor(pz / this.chunkSize);
        const viewDistance = 4; 
        for (let x = cx - viewDistance; x <= cx + viewDistance; x++) {
            for (let z = cz - viewDistance; z <= cz + viewDistance; z++) {
                const id = this.getChunkId(x, z);
                if (!this.chunks.has(id)) {
                    this.chunks.set(id, this.generateChunkData(x, z));
                    this.updateChunkMesh(x, z);
                }
            }
        }
        for (let [id, group] of this.meshes.entries()) {
            const [mx, mz] = id.split(',').map(Number);
            if (Math.abs(mx - cx) > viewDistance + 1 || Math.abs(mz - cz) > viewDistance + 1) {
                this.scene.remove(group);
                group.traverse(c => { if(c.geometry) c.geometry.dispose(); });
                this.meshes.delete(id);
                this.chunks.delete(id);
            }
        }
    }
}
