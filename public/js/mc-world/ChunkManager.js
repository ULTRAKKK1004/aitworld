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
        this.material = new THREE.MeshLambertMaterial({ 
            map: texture, 
            transparent: true, 
            alphaTest: 0.1, 
            side: THREE.DoubleSide 
        });
        
        // 5 Unique Villages
        this.villages = [
            {cx: 0, cz: 0, name: "Origin Grove", theme: "grass", floor: 1, pillar: 4},
            {cx: 10, cz: 10, name: "Iron Bastion", theme: "stone", floor: 8, pillar: 3},
            {cx: -10, cz: 10, name: "Water's Edge", theme: "water", floor: 9, pillar: 10},
            {cx: 10, cz: -10, name: "Sun Valley", theme: "sand", floor: 2, pillar: 7},
            {cx: -10, cz: -10, name: "Dark Crag", theme: "lava", floor: 3, pillar: 3}
        ];
    }

    getChunkId(cx, cz) {
        return `${cx},${cz}`;
    }

    getVillage(cx, cz) {
        return this.villages.find(v => v.cx === cx && v.cz === cz);
    }

    getNoise(x, z) {
        const sin = Math.sin(x * 0.1) * 3 + Math.cos(z * 0.1) * 3;
        return Math.floor(sin + 12);
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
                        if (y < h) b = 2; // Dirt base
                        if (y === h - 1) b = village.floor;
                        // Add some village structures
                        if (y >= h && y < h + 4 && (lx % 8 === 0) && (lz % 8 === 0)) b = village.pillar;
                        if (y === h + 4 && (lx % 8 === 0) && (lz % 8 === 0)) b = 9; // Planks roof start
                        this.setVoxelData(chunk, lx, y, lz, b);
                    }
                } else {
                    const h = this.getNoise(wx, wz);
                    for (let y = 0; y < 64; y++) {
                        let b = 0;
                        if (y < h) {
                            b = 2;
                            if (y === h - 1) b = 1;
                            if (y < h - 4) b = 3;
                        } else if (y < 10) b = 11;
                        this.setVoxelData(chunk, lx, y, lz, b);
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
        if (!chunk) return 0;
        
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
        
        if (lx === 0) this.updateChunkMesh(cx - 1, cz);
        if (lx === this.chunkSize - 1) this.updateChunkMesh(cx + 1, cz);
        if (lz === 0) this.updateChunkMesh(cx, cz - 1);
        if (lz === this.chunkSize - 1) this.updateChunkMesh(cx, cz + 1);
    }

    updateChunkMesh(cx, cz) {
        const id = this.getChunkId(cx, cz);
        const chunk = this.chunks.get(id);
        if (!chunk) return;

        const positions = [], normals = [], uvs = [], indices = [];
        const startX = cx * this.chunkSize, startZ = cz * this.chunkSize;

        const faces = [
            { dir: [-1, 0, 0], v: [[0,1,0,0,1],[0,1,1,1,1],[0,0,0,0,0],[0,0,1,1,0]] },
            { dir: [1, 0, 0], v: [[1,1,1,0,1],[1,1,0,1,1],[1,0,1,0,0],[1,0,0,1,0]] },
            { dir: [0, -1, 0], v: [[1,0,1,1,0],[0,0,1,0,0],[1,0,0,1,1],[0,0,0,0,1]] },
            { dir: [0, 1, 0], v: [[0,1,1,1,1],[1,1,1,0,1],[0,1,0,1,0],[1,1,0,0,0]] },
            { dir: [0, 0, -1], v: [[1,1,0,0,1],[0,1,0,1,1],[1,0,0,0,0],[0,0,0,1,0]] },
            { dir: [0, 0, 1], v: [[0,1,1,0,1],[1,1,1,1,1],[0,0,1,0,0],[1,0,1,1,0]] }
        ];

        for (let y = 0; y < 64; ++y) {
            for (let lz = 0; lz < this.chunkSize; ++lz) {
                for (let lx = 0; lx < this.chunkSize; ++lx) {
                    const voxel = this.getVoxelData(chunk, lx, y, lz);
                    if (voxel) {
                        const uvVoxel = voxel - 1;
                        for (const face of faces) {
                            const nx = lx + face.dir[0], ny = y + face.dir[1], nz = lz + face.dir[2];
                            let neighbor = 0;
                            if (nx>=0 && nx<this.chunkSize && ny>=0 && ny<64 && nz>=0 && nz<this.chunkSize) {
                                neighbor = this.getVoxelData(chunk, nx, ny, nz);
                            } else {
                                neighbor = this.getVoxelGlobal(startX + nx, ny, startZ + nz);
                            }
                            
                            const isTrans = (v) => v === 0 || v === 5 || v === 6 || v === 7 || v === 8 || v === 11;
                            if (isTrans(neighbor) || (voxel !== neighbor)) {
                                const ndx = positions.length / 3;
                                for (const vert of face.v) {
                                    let py = vert[1];
                                    if (voxel === 11 && face.dir[1] === 1) py -= 0.15;
                                    positions.push(vert[0] + startX + lx, py + y, vert[2] + startZ + lz);
                                    normals.push(...face.dir);
                                    uvs.push((uvVoxel + vert[3]) * this.tileSize / this.tileTextureWidth, vert[4]);
                                }
                                indices.push(ndx, ndx+1, ndx+2, ndx+2, ndx+1, ndx+3);
                            }
                        }
                    }
                }
            }
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
        geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        geometry.setIndex(indices);

        let mesh = this.meshes.get(id);
        if (mesh) {
            mesh.geometry.dispose();
            mesh.geometry = geometry;
        } else {
            mesh = new THREE.Mesh(geometry, this.material);
            this.scene.add(mesh);
            this.meshes.set(id, mesh);
        }
    }

    updatePlayerPosition(px, pz) {
        const cx = Math.floor(px / this.chunkSize);
        const cz = Math.floor(pz / this.chunkSize);
        const viewDistance = 2;

        for (let x = cx - viewDistance; x <= cx + viewDistance; x++) {
            for (let z = cz - viewDistance; z <= cz + viewDistance; z++) {
                const id = this.getChunkId(x, z);
                if (!this.chunks.has(id)) {
                    this.chunks.set(id, this.generateChunkData(x, z));
                    this.updateChunkMesh(x, z);
                }
            }
        }

        for (let [id, mesh] of this.meshes.entries()) {
            const [mx, mz] = id.split(',').map(Number);
            if (Math.abs(mx - cx) > viewDistance + 1 || Math.abs(mz - cz) > viewDistance + 1) {
                this.scene.remove(mesh);
                mesh.geometry.dispose();
                this.meshes.delete(id);
                this.chunks.delete(id);
            }
        }
    }
}
