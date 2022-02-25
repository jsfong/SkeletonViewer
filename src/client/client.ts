import * as THREE from 'three'
import { Vector3 } from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import Stats from 'three/examples/jsm/libs/stats.module'
import * as jsonpath from 'jsonpath';
const skeleton = require("./skeleton.json");
const cube8Cells = require("./cube8Cells.json");
const outputData = require("./output.json");
const cube8CellsOutputData = require("./cube8CellsOutput.json");
import { GUI } from 'dat.gui'
import { type } from 'os';
import { text } from 'stream/consumers';

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

//JSON
let jSkeleton = cube8Cells;
let jOutput = cube8CellsOutputData;

//Material
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
const bReadSkeleton = document.getElementById('bAddSkeleton') as HTMLButtonElement;
const tSkeletonSrc = document.getElementById('tSkeletonSrc') as HTMLTextAreaElement;
const bReadResult = document.getElementById('bAddResult') as HTMLButtonElement;
const tResultSrc = document.getElementById('tResultSrc') as HTMLTextAreaElement;

//GUI
const gui = new GUI()
let floorDropDownController
let lightConfig = {
    followCamera: false
};
var settings = {
    floorLevelToDraw: 'ALL'
};



//ThreeJs Drawing 
function init() {
    //Camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 300)
    camera.position.set(50, 50, 50);
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
    const gridHelper = new THREE.GridHelper(500, 500, 0x444444, 0x888888);
    scene.add(gridHelper);

    //Plane
    const geometry = new THREE.PlaneBufferGeometry(500, 500);
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

    renderer.domElement.addEventListener('wheel', onDocumentMouseScroll, false);
    renderer.domElement.addEventListener('mousemove', onDocumentMouseMove, false);
    renderer.domElement.addEventListener('pointerdown', onDocumentMouseDown, false);

    bReadSkeleton.addEventListener("click", readSkeleton, false);
    bReadResult.addEventListener("click", readResult, false);
    tSkeletonSrc.value = JSON.stringify(jSkeleton, null, 2);
    tResultSrc.value = JSON.stringify(jOutput, null, 2);
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

    const lightFolder = gui.addFolder('Light')
    lightFolder.add(lightConfig, 'followCamera', false).onChange(() => {
        light.position.copy(camera.position)
    })


    const levelFolder = gui.addFolder('Level')
    floorDropDownController = levelFolder.add(settings, 'floorLevelToDraw', ['ALL']).onChange(() => {
        parseAndDrawSkeleton()
    });

}

function readSkeleton(this: HTMLElement, ev: Event) {
    console.log("Read Skeleton")
    ev.preventDefault();

    if (tSkeletonSrc.value) {
        console.log("Detected skeleton input")
        jSkeleton = JSON.parse(tSkeletonSrc.value)
    }

    console.log("Redrawing Skeleton ..")
    parseAndDrawSkeleton();
}

function readResult (this: HTMLElement, ev: Event) {
    console.log("Read Result")
    ev.preventDefault();

    if (tResultSrc.value) {
        console.log("Detected Result input")
        jOutput = JSON.parse(tResultSrc.value)
    }
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
    // render()
}

function onDocumentMouseScroll() {
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

    render()
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
        const id = currentPickedObject.userData.uuid;
        const data = getOutputData(id);
        debugDiv.value = `ID: ${id} \n${data}`;
    }
    pickableObjects.forEach((o: THREE.Mesh, i) => {
        if (currentPickedObject && currentPickedObject.uuid === o.uuid) {
            pickableObjects[i].material = selectedMaterial;
        } else {
            pickableObjects[i].material = originalMaterials[o.uuid]
        }
    })

    render()
}

function animate() {
    requestAnimationFrame(animate)

    //To save process only render when needed
    // render()
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

    console.log("faceId: " + face.userData.uuid)
    const points = face.vertex;

    const [firstP, ...restOfP] = points

    const triangleShape = new THREE.Shape();
    triangleShape.moveTo(firstP.x, firstP.z);
    restOfP.forEach((p: { x: number; z: number; }) => triangleShape.lineTo(p.x, p.z))
    triangleShape.lineTo(firstP.x, firstP.z); // close path

    // const extrudeSettings = { depth: 1, bevelEnabled: true, bevelSegments: 1, steps: 1, bevelSize: 1, bevelThickness: 1 };
    // const tri = new THREE.ExtrudeGeometry(triangleShape, extrudeSettings);
    const tri = new THREE.ShapeBufferGeometry(triangleShape);
    let material = normalMaterial
    material.side = THREE.DoubleSide
    const trimesh = new THREE.Mesh(tri, material);
    trimesh.userData = face.userData

    trimesh.rotateX(Math.PI / 2)
    trimesh.position.setY(firstP.y);
    scene.add(trimesh)
    pickableObjects.push(trimesh);
    originalMaterials[trimesh.uuid] = trimesh.material;

}

//End of - ThreeJs Drawing 

//Json parsing
function parseEdges(data: any) {
    const x = "$.cellComplex.cells.*.faces.*.edges.*";
    let edges = jsonpath.query(data, x);
    console.log("Num of edges " + edges.length)

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

    const x = "$.cellComplex.cells.*.faces.*";
    let faces = jsonpath.query(data, x);

    console.log("Number of face " + faces.length)
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

function isSameFace(f1: Vector3[], f2: Vector3[]) {
    if (f1 === f2) return true;
    if (f1 == null || f2 == null) return false;
    if (f1.length !== f2.length) return false;

    const oF1 = f1.sort()
    const oF2 = f2.sort()

    for (var i = 0; i < f1.length; ++i) {
        if (!oF1[i].equals(oF2[i])) return false;
    }
    return true;

}

function getUniqueFace(faces: any[]) {
    let output: any[] = [];

    faces.forEach(f => {

        let found = output.find(o => {
            return isSameFace(f.vertex, o.vertex)
        })
        if (!found) {
            output.push(f);
        }
    })

    return output

}

function isNotGroundFloor(face: any) {
    return face.userData.floorNo !== 0
}

function getFaceFloorNum(face: any) {
    const pFloorNum = "$.edges.*.*.floor";
    let floorNum = jsonpath.query(face, pFloorNum);

    // console.log("fn: \n" + floorNum)

    var filteredArray = floorNum.filter(function (item, pos) {
        return floorNum.indexOf(item) == pos;
    });
    // console.log("fn f: \n" + filteredArray)

    return filteredArray;
}

function getSlabVertex(face: any) {

    const x = "$.edges.*";
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

    let [firstV, ...restOfVs] = edges;

    const orderVertex: Vector3[] = []
    orderVertex.push(firstV.start);
    orderVertex.push(firstV.end);

    let index = firstV.end;
    while (orderVertex.length < edges.length) {

        const matchedStart = restOfVs.find(v => v && v.start.equals(index));
        if (matchedStart) {
            orderVertex.push(matchedStart.end);
            index = matchedStart.end;
            delete restOfVs[restOfVs.indexOf(matchedStart)]
            continue;
        }

        const matchedEnd = restOfVs.find(v => v && v.end.equals(index))
        if (matchedEnd) {
            orderVertex.push(matchedEnd.start);
            index = matchedEnd.start;
            delete restOfVs[restOfVs.indexOf(matchedEnd)]
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

function isVertexEqual(e1: Vector3, e2: Vector3) {
    return e1.x === e2.x && e1.y === e2.y && e1.z === e2.z;
}

function getUnique(points: any[]) {
    let output: any[] = [];

    points.forEach(p => {

        let found = output.find(o => {
            return isEdgeSame(p.vertex, o.vertex)
        })
        if (!found) {
            output.push(p);
        }

    })

    return output;
}

function isEdgeSame(e1: Vector3[], e2: Vector3[]) {
    return (
        (e1[0].equals(e2[0]) && e1[1].equals(e2[1]))
        || (e1[0].equals(e2[1]) && e1[1].equals(e2[0]))
    )
}

function getOutputData(id: any) {
    const x = `$.elements[?(@.type == 'column' && @.attributes.edgeId == '${id}')]`
    let data = jsonpath.query(jOutput, x);

    return JSON.stringify(data, null, 2)
}
//End of - Json parsing

function parseAndDrawSkeleton() {
    //Draw edge
    let vEdge = parseEdges(jSkeleton);
    console.log("Num of edges " + vEdge.length)

    let vE = vEdge.filter(isEdgeVertical);
    console.log("Num of verticalEdge " + vE.length)

    let verticalEdge = getUnique(vEdge.filter(isEdgeVertical));
    console.log("Num of unique verticalEdge " + verticalEdge.length)
    verticalEdge.forEach(e => drawVEdge(e, 1));

    //Draw face
    const slabs = parseSlabs(jSkeleton)
    console.log("Num of horizantal slabs " + slabs.length)

    const uniqueSlabs = getUniqueFace(slabs).filter(s => isNotGroundFloor(s))
    console.log("Num of unique horizantal slabs " + uniqueSlabs.length)

    uniqueSlabs.forEach(s => drawFace(s))
}

init()
initGUI()
// parseAndDrawSkeleton()
animate()

