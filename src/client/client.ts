import * as THREE from 'three'
import { Vector3 } from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import Stats from 'three/examples/jsm/libs/stats.module'
import * as jsonpath from 'jsonpath';
const skeleton = require("./skeleton.json");
import { GUI } from 'dat.gui'

const canvas = document.getElementById('canvas') as HTMLDivElement
let camera: THREE.PerspectiveCamera;
let scene: THREE.Scene;
let renderer: THREE.WebGL1Renderer;
let light: THREE.Object3D<THREE.Event> | THREE.PointLight;
let plane;
let cube: THREE.Object3D<THREE.Event> | THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
let stats: Stats;
let debugView: HTMLDivElement;
let rollOverMesh: THREE.Object3D<THREE.Event> | THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial>, rollOverMaterial;

//Material
// const normalMaterial = new THREE.MeshNormalMaterial({
//     opacity: 0.7,
//     transparent: true,
//     side: THREE.FrontSide
// })
let normalMaterial = new THREE.MeshLambertMaterial({
    color: 0x939393,
    emissive: 0x2d2d2d
});
const highlightedMaterial = new THREE.MeshBasicMaterial({
    wireframe: true,
    color: 0x00ff00
})
const selectedMaterial = new THREE.MeshNormalMaterial({
    side: THREE.DoubleSide
})

//Picking Config
let raycaster: THREE.Raycaster;
let intersects: THREE.Intersection[]
const pickableObjects: THREE.Mesh[] = [];
let currentPickedObject: THREE.Object3D | null;
let intersectObject: THREE.Object3D | null;
const originalMaterials: { [id: string]: THREE.Material | THREE.Material[] } = {}
const debugDiv = document.getElementById('debug1') as HTMLTextAreaElement

//GUI
const gui = new GUI()
let lightConfig = {
    followCamera: false
};

//ThreeJs Drawing 
function init() {
    //Camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
    camera.position.set(20, 20, 20);
    camera.lookAt(0, 0, 0);

    //Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f0f0);

    //Renderer
    renderer = new THREE.WebGL1Renderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    canvas.appendChild(renderer.domElement);

    //Light
    light = new THREE.PointLight(0xffffff, 2)
    light.position.set(50, 50, 30)
    scene.add(light)

    //Stat
    stats = Stats()
    canvas.appendChild(stats.dom)

    //Raycaster
    raycaster = new THREE.Raycaster();

    //Grid
    const gridHelper = new THREE.GridHelper(100, 100, 0x444444, 0x888888);
    scene.add(gridHelper);

    //Plane
    const geometry = new THREE.PlaneBufferGeometry(100, 100);
    geometry.rotateX(- Math.PI / 2);
    plane = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ visible: false }));
    plane.name = "floor";
    scene.add(plane);

    //Debug view
    debugView = document.getElementById('debug1') as HTMLDivElement
    //  debugView.innerText = 'Matrix\n' + dot.matrix.elements.toString().replace(/,/g, '\n')


    //Orbit control
    new OrbitControls(camera, renderer.domElement)

    //Event listener
    document.addEventListener('resize', onWindowResize);
    renderer.domElement.addEventListener('mousemove', onDocumentMouseMove, false);
    renderer.domElement.addEventListener('pointerdown', onDocumentMouseDown, false);
}

function initGUI() {
    const meshLambertMaterialFolder = gui.addFolder('THREE.MeshLambertMaterial')
    const data = {
        color: normalMaterial.color.getHex(),
        emissive: normalMaterial.emissive.getHex(),
    }
    const options = {
        side: {
            FrontSide: THREE.FrontSide,
            BackSide: THREE.BackSide,
            DoubleSide: THREE.DoubleSide,
        },
        combine: {
            MultiplyOperation: THREE.MultiplyOperation,
            MixOperation: THREE.MixOperation,
            AddOperation: THREE.AddOperation,
        },
    }
    meshLambertMaterialFolder.addColor(data, 'color').onChange(() => {
        normalMaterial.color.setHex(Number(data.color.toString().replace('#', '0x')))
    })
    meshLambertMaterialFolder.addColor(data, 'emissive').onChange(() => {
        normalMaterial.emissive.setHex(
            Number(data.emissive.toString().replace('#', '0x'))
        )
    })
    meshLambertMaterialFolder.open()

    const lightFolder = gui.addFolder('Light')
    lightFolder.add(lightConfig, 'followCamera', false).onChange(() => {
        light.position.copy(camera.position)
    })

}

function updateMaterial() {
    normalMaterial.side = Number(normalMaterial.side)
    normalMaterial.combine = Number(normalMaterial.combine)
    normalMaterial.needsUpdate = true
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(window.innerWidth, window.innerHeight)
    render()
}

function onDocumentMouseMove(event: MouseEvent) {

    //Raycaster
    raycaster.setFromCamera(
        {
            x: (event.clientX / renderer.domElement.clientWidth) * 2 - 1,
            y: -(event.clientY / renderer.domElement.clientHeight) * 2 + 1
        },
        camera
    );

    intersects = raycaster.intersectObjects(pickableObjects, false);
    if (intersects.length > 0) {
        intersectObject = intersects[0].object;
    } else {
        intersectObject = null;
    }

    pickableObjects.forEach((o: THREE.Mesh, i) => {
        if (intersectObject && intersectObject.uuid === o.uuid) {
            pickableObjects[i].material = highlightedMaterial;

        } else {
            if (currentPickedObject && pickableObjects[i].uuid === currentPickedObject.uuid) {
                pickableObjects[i].material = selectedMaterial
            } else {
                pickableObjects[i].material = originalMaterials[o.uuid]
            }
        }
    })

    //Light
    if (lightConfig.followCamera) {
        light.position.copy(camera.position);
    }
}

function onDocumentMouseDown(event: MouseEvent) {
    raycaster.setFromCamera(
        {
            x: (event.clientX / renderer.domElement.clientWidth) * 2 - 1,
            y: -(event.clientY / renderer.domElement.clientHeight) * 2 + 1
        },
        camera
    );

    intersects = raycaster.intersectObjects(pickableObjects, false);
    if (intersects.length > 0) {
        currentPickedObject = intersects[0].object;
        debugDiv.value = JSON.stringify(currentPickedObject.userData, null, 2);
    }
    pickableObjects.forEach((o: THREE.Mesh, i) => {
        if (currentPickedObject && currentPickedObject.uuid === o.uuid) {
            pickableObjects[i].material = selectedMaterial;
        } else {
            pickableObjects[i].material = originalMaterials[o.uuid]
        }
    })
}

function animate() {
    requestAnimationFrame(animate)

    render()
    stats.update()
}

function render() {
    renderer.render(scene, camera)
}

function drawEdge(points: Vector3[], thickness: number) {

    const p1 = points[0];
    const p2 = points[1];

    let x = Math.abs(p1.x - p2.x);
    let y = Math.abs(p1.y - p2.y);
    let z = Math.abs(p1.z - p2.z);

    x = x > 0 ? x : thickness;
    y = y > 0 ? y : thickness;
    z = z > 0 ? z : thickness;

    const geometry = new THREE.BoxGeometry(x, y, z);
    const material = normalMaterial;
    const cube = new THREE.Mesh(geometry, material);

    const xp = (p1.x - p2.x) / 2;
    const yp = (p1.y - p2.y) / 2;
    const zp = (p1.z - p2.z) / 2;

    cube.position.set(xp, yp, zp);
    scene.add(cube)
    pickableObjects.push(cube);
    originalMaterials[cube.uuid] = cube.material;

}

function drawVEdge(edge: any, thickness: number) {


    const p1 = edge.vertex[0];
    const p2 = edge.vertex[1];

    let x = Math.abs(p1.x - p2.x);
    let y = Math.abs(p1.y - p2.y);
    let z = Math.abs(p1.z - p2.z);

    x = x > 0 ? x : thickness;
    y = y > 0 ? y : thickness;
    z = z > 0 ? z : thickness;

    const geometry = new THREE.BoxBufferGeometry(x, y, z)
    const material = normalMaterial
    const cube = new THREE.Mesh(geometry, material)

    //Move into place
    cube.position.setX(p1.x);
    cube.position.setY(Math.min(p1.y, p2.y) + y / 2);
    cube.position.setZ(p1.z);
    cube.userData = {
        type: edge.type,
        uuid: edge.uuid
    };


    scene.add(cube)
    pickableObjects.push(cube);
    originalMaterials[cube.uuid] = cube.material;

}

function drawFace(face: any) {

    const points = face.vertex;
    const p1 = points[0];
    const p2 = points[1];
    const p3 = points[2];
    const p4 = points[3];

    const triangleShape = new THREE.Shape();
    triangleShape.moveTo(p1.x, p1.z);
    triangleShape.lineTo(p2.x, p2.z);
    triangleShape.lineTo(p3.x, p3.z);
    triangleShape.lineTo(p4.x, p4.z);
    triangleShape.lineTo(p1.x, p1.z); // close path

    // const extrudeSettings = { depth: 1, bevelEnabled: true, bevelSegments: 1, steps: 1, bevelSize: 1, bevelThickness: 1 };
    // const tri = new THREE.ExtrudeGeometry(triangleShape, extrudeSettings);
    const tri = new THREE.ShapeBufferGeometry(triangleShape);
    let material = normalMaterial
    material.side = THREE.DoubleSide
    const trimesh = new THREE.Mesh(tri, material);
    trimesh.userData = face.userData

    trimesh.rotateX(Math.PI / 2)
    trimesh.position.setY(p1.y);
    scene.add(trimesh)
    pickableObjects.push(trimesh);
    originalMaterials[trimesh.uuid] = trimesh.material;

}

//End of - ThreeJs Drawing 

//Json parsing
function parseEdges(data: any) {
    const x = "$.cells.*.faces.*.edges.*";
    let edges = jsonpath.query(data, x);

    let vEdges = edges.map(e => {
        const uuid = e.uuid;
        let vStart = new THREE.Vector3(e.start.x, e.start.z, e.start.y);
        let vEnd = new THREE.Vector3(e.end.x, e.end.z, e.end.y);
        return {
            type: "column",
            uuid: uuid,
            vertex: [vStart, vEnd]
        }
    });

    return vEdges;
}

function parseSlabs(data: any) {

    const x = "$.cells.*.faces.*";
    let faces = jsonpath.query(data, x);

    const vFaces = faces.filter(f => getFaceFloorNum(f).length == 1);
    const slabs = vFaces.map(f => {
        const [floorNo] = getFaceFloorNum(f);
        const uuid = f.uuid;
        return {
            userData: {
                type: "slab",
                uuid: uuid,
                floorNo: floorNo
            },
            vertex: getSlabVertex(f)
        }
    });

    return slabs;
}

function getFaceFloorNum(face: any) {
    const pFloorNum = "$.edges.*.*.floor";
    let floorNum = jsonpath.query(face, pFloorNum);

    var filteredArray = floorNum.filter(function (item, pos) {
        return floorNum.indexOf(item) == pos;
    });


    return filteredArray;
}

function getSlabVertex(face: any) {

    const x = "$.edges.*";
    const floorNum = "$.edges.*.*.floor";

    let edges = jsonpath.query(face, x);

    const listOfVertex = edges.map(e => {
        return {
            "start": new Vector3(e.start.x, e.start.z, e.start.y),
            "end": new Vector3(e.end.x, e.end.z, e.end.y)
        }
    })

    return getOrderedVertexFromEdge(listOfVertex);

}

function getOrderedVertexFromEdge(edges: any[]) {

    const [firstV, ...restOfVs] = edges;

    const orderVertex: Vector3[] = []
    orderVertex.push(firstV.start);
    orderVertex.push(firstV.end);

    let index = firstV.end;
    while (orderVertex.length < edges.length) {

        const matchedStart = restOfVs.find(v => v.start.equals(index));
        if (matchedStart) {
            orderVertex.push(matchedStart.end);
            index = matchedStart.end;
            continue;
        }

        const matchedEnd = restOfVs.find(v => v.end.equals(index))
        if (matchedEnd) {
            orderVertex.push(matchedEnd.start);
            index = matchedEnd.start;
            continue;
        }
    }

    return orderVertex;

}


function isEdgeVertical(edge: any) {

    const points = edge.vertex

    const p1 = points[0];
    const p2 = points[1];

    if (Math.abs(p1.y - p2.y) > 0
        && Math.abs(p1.x - p2.x) < 1
        && Math.abs(p1.z - p2.z) < 1) {
        return true;
    } else {
        return false;
    }

}

function isUnique(edge: Vector3[], edges: Vector3[][]) {

    let found = edges.find(e => {
        return (
            edge[0].equals(e[0])
            || edge[0].equals(e[1])
            || edge[1].equals(e[0])
            || edge[1].equals(e[1])
        );
    });

    return !found;
}

function getUnique(points: any[]) {


    let output: any[] = [];

    points.forEach(p => {
        if (isUnique(p.vertex, output.map(o => o.vertex))) {
            output.push(p);
        }
    })

    return output;
}
//End of - Json parsing


init()
initGUI()
//Draw edge
let vEdge = parseEdges(skeleton);
let verticalEdge = getUnique(vEdge.filter(isEdgeVertical));
verticalEdge.forEach(e => drawVEdge(e, 1));

//Draw face
const slabs = parseSlabs(skeleton)
slabs.forEach(s => drawFace(s))


animate()

