import * as THREE from 'three'
import { Vector3 } from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import Stats from 'three/examples/jsm/libs/stats.module'
import * as jsonpath from 'jsonpath';
// import * as skeleton from './skeleton.json';
const skeleton = require("./skeleton.json");


let camera: THREE.PerspectiveCamera;
let scene: THREE.Scene;
let renderer: THREE.WebGL1Renderer;
let plane;
let cube: THREE.Object3D<THREE.Event> | THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
let stats: Stats;
let raycaster: THREE.Raycaster;
let debugView: HTMLDivElement;
let rollOverMesh: THREE.Object3D<THREE.Event> | THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial>, rollOverMaterial;
let objects: THREE.Object3D<THREE.Event>[] | (THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial> | THREE.Mesh<THREE.BoxGeometry, THREE.MeshNormalMaterial>)[] = [];




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
    document.body.appendChild(renderer.domElement);

    //Stat
    stats = Stats()
    document.body.appendChild(stats.dom)

    // //Raycaster
    // raycaster = new THREE.Raycaster();

    //Grid
    const gridHelper = new THREE.GridHelper(100, 100);
    scene.add(gridHelper);

    //Plane
    const geometry = new THREE.PlaneBufferGeometry(100, 100);
    geometry.rotateX(- Math.PI / 2);
    plane = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ visible: false }));
    plane.name = "floor";
    scene.add(plane);
    objects.push(plane);

    //Debug view
    debugView = document.getElementById('debug1') as HTMLDivElement
    //  debugView.innerText = 'Matrix\n' + dot.matrix.elements.toString().replace(/,/g, '\n')


    //Orbit control
    new OrbitControls(camera, renderer.domElement)

    //Event listener
    document.addEventListener('resize', onWindowResize);
    // renderer.domElement.addEventListener('mousemove', onPointerMove, false);
    // renderer.domElement.addEventListener('pointerdown', onPointerDown, false);
}


function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(window.innerWidth, window.innerHeight)
    render()
}

function animate() {
    requestAnimationFrame(animate)

    render()
    stats.update()
}

function render() {
    renderer.render(scene, camera)
}

//Json parsing
function parseEdges(data: any) {
    const x = "$.cells.*.faces.*.edges.*";
    let edges = jsonpath.query(data, x);

    let vEdges = edges.map(e => {
        let vStart = new THREE.Vector3(e.start.x, e.start.z, e.start.y);
        let vEnd = new THREE.Vector3(e.end.x, e.end.z, e.end.y);
        return [vStart, vEnd];
    });

    return vEdges;
}

function parseSlabs(data: any) {

    const x = "$.cells.*.faces.*";
    let faces = jsonpath.query(data, x);

    const vFaces = faces.filter(f => getFaceFloorNum(f).length == 1);
    const slabs = vFaces.map(f => {
        const [floorNo] = getFaceFloorNum(f);
        return {
            "vertex": getSlabVertex(f),
            "floorNo": floorNo
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


function isEdgeVertical(points: Vector3[]) {
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

function getUnique(points: Vector3[][]) {

    let output: Vector3[][] = [];

    points.forEach(p => {
        if (isUnique(p, output)) {
            output.push(p);
        }
    })

    return output;
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

    const geometry = new THREE.BoxGeometry(x, y, z)
    const material = new THREE.MeshNormalMaterial()
    const cube = new THREE.Mesh(geometry, material)

    const xp = (p1.x - p2.x) / 2;
    const yp = (p1.y - p2.y) / 2;
    const zp = (p1.z - p2.z) / 2;

    console.log([xp, yp, zp])
    cube.position.set(xp, yp, zp);
    scene.add(cube)

}

function drawVEdge(points: Vector3[], thickness: number) {
    const p1 = points[0];
    const p2 = points[1];

    let x = Math.abs(p1.x - p2.x);
    let y = Math.abs(p1.y - p2.y);
    let z = Math.abs(p1.z - p2.z);

    x = x > 0 ? x : thickness;
    y = y > 0 ? y : thickness;
    z = z > 0 ? z : thickness;

    const geometry = new THREE.BoxBufferGeometry(x, y, z)
    const material = new THREE.MeshNormalMaterial()
    const cube = new THREE.Mesh(geometry, material)

    //Move into place
    cube.position.setX(p1.x);
    cube.position.setY(Math.min(p1.y, p2.y) + y / 2);
    cube.position.setZ(p1.z);

    scene.add(cube)
    objects.push(cube)

}

function drawFace(points: Vector3[]) {

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
    const trimesh = new THREE.Mesh(tri, new THREE.MeshNormalMaterial({ wireframe: false, side: THREE.DoubleSide }));

    console.log(trimesh)
    trimesh.rotateX(Math.PI / 2)
    trimesh.position.setY(p1.y);
    scene.add(trimesh)

}



init()

//Draw edge
let vEdge = parseEdges(skeleton);
let verticalEdge = getUnique(vEdge.filter(isEdgeVertical));
verticalEdge.forEach(e => drawVEdge(e, 1));

//Draw face
const slabs = parseSlabs(skeleton)
console.log(slabs)
slabs.forEach(s => drawFace(s.vertex))

// const x1 = new THREE.Vector3(10, 0, 0);
// const x2 = new THREE.Vector3(-10, 0, 0);
// drawEdge([x1, x2], 0.25);

// //Draw face - 4 points
// const f1 = new THREE.Vector3(0, 0, 0);
// const f2 = new THREE.Vector3(1, 0, 0);
// const f3 = new THREE.Vector3(1, 0, 1);
// const f4 = new THREE.Vector3(0, 0, 1);
// drawFace([f1, f2, f3, f4])



animate()

