import * as THREE from 'three'
import { Vector3 } from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import Stats from 'three/examples/jsm/libs/stats.module'
import * as jsonpath from 'jsonpath';
const skeleton = require("./skeleton.json");
const cube8Cells = require("./cube8Cells.json");
const itypeSkeleton = require("./itypeSkeleton.json");
const htypeSkeleton = require("./htypeSkeleton.json");
const outputData = require("./output.json");
const cube8CellsOutputData = require("./cube8CellsOutput.json");
import { GUI } from 'dat.gui'
import { type } from 'os';
import { text } from 'stream/consumers';
import * as e from 'express';

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
let jSkeleton = htypeSkeleton;
let jOutput = cube8CellsOutputData;
const DECIMAL_POINT = 6;

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
let pickableObjects: THREE.Mesh[] = [];
let currentPickedObject: THREE.Object3D | THREE.Mesh | any | null;
let intersectObject: THREE.Object3D | null;
const originalMaterials: { [id: string]: THREE.Material | THREE.Material[] } = {}
const debugDiv = document.getElementById('debug1') as HTMLTextAreaElement
const debugDiv2 = document.getElementById('debugDiv2') as HTMLDivElement
const bReadSkeleton = document.getElementById('bAddSkeleton') as HTMLButtonElement;
const tSkeletonSrc = document.getElementById('tSkeletonSrc') as HTMLTextAreaElement;
const bReadResult = document.getElementById('bAddResult') as HTMLButtonElement;
const tResultSrc = document.getElementById('tResultSrc') as HTMLTextAreaElement;
const snackbar = document.getElementById('snackbar') as HTMLDivElement;
let timer: NodeJS.Timeout;

//GUI
const gui = new GUI()
let floorDropDownController
let lightConfig = {
    followCamera: false
};
var settings = {
    floorLevelToDraw: 'ALL',
    columnLevelToDraw: 'ALL',
    beamLevelToDraw: 'ALL',
};

//Skeleton Config
const EDGE_THICKNESS = 1
let columnShowLevel = 'ALL'
let slabShowLevel = 'ALL'
let beamShowLevel = 'ALL'

//ThreeJs Drawing 
function init() {
    //Camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 300)
    camera.position.set(100, 50, 100);
    camera.lookAt(20, 0, 20);

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
    const gridHelper = new THREE.GridHelper(1000, 1000, 0x444444, 0x888888);
    scene.add(gridHelper);

    //Plane
    const geometry = new THREE.PlaneBufferGeometry(1000, 1000);
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
    levelFolder.add(settings, 'floorLevelToDraw', ['ALL', '1', '2', '3', '4', '5', 'NONE']).onChange((value) => {
        slabShowLevel = value
        updateStructureInScene('slab')
    });
    levelFolder.add(settings, 'columnLevelToDraw', ['ALL', '1', '2', '3', '4', '5', 'NONE']).onChange((value) => {
        columnShowLevel = value
        updateStructureInScene('column')
    });
    levelFolder.add(settings, 'beamLevelToDraw', ['ALL', '1', '2', '3', '4', '5', 'NONE']).onChange((value) => {
        beamShowLevel = value
        updateStructureInScene('beam')
    });
    levelFolder.open()

}

function updateSkeletonInfo() {
    const slabCount = pickableObjects.filter(o => o.userData.type === 'slab').filter(o => o.visible === true).length
    const beamCount = pickableObjects.filter(o => o.userData.type === 'beam').filter(o => o.visible === true).length
    const columnCount = pickableObjects.filter(o => o.userData.type === 'column').filter(o => o.visible === true).length
    debugDiv2.innerText = `Slab : ${slabCount}\nBeam : ${beamCount}\nColumn : ${columnCount}`
}

function sendNotification(msg: string) {
    clearTimeout(timer)
    snackbar.innerText = msg
    snackbar.className = "show"
    timer = setTimeout(() => {
        snackbar.className = snackbar.className.replace("show", "")
    }, 3000);

}

function readSkeleton(this: HTMLElement, ev: Event) {
    console.log("Read Skeleton")
    sendNotification("Reading Skeleton...")
    ev.preventDefault();
    if (tSkeletonSrc.value) {
        console.log("Detected skeleton input")
        jSkeleton = JSON.parse(tSkeletonSrc.value)
    }

    console.log("Redrawing Skeleton..")
    sendNotification("Drawing Skeleton...")
    parseAndDrawSkeleton();

}

function readResult(this: HTMLElement, ev: Event) {
    console.log("Read Result")
    sendNotification("Parsing result...")
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

    const intersectableObj = pickableObjects.filter(o => o.visible === true);
    intersects = raycaster.intersectObjects(intersectableObj, false);
    if (intersects.length > 0) {
        intersectObject = intersects[0].object;
    } else {
        intersectObject = null;
    }

    intersectableObj.forEach((o: THREE.Mesh, i) => {
        if (intersectObject && intersectObject.uuid === o.uuid) {
            intersectableObj[i].material = highlightedMaterial;

        } else {
            if (currentPickedObject && intersectableObj[i].uuid === currentPickedObject.uuid) {
                intersectableObj[i].material = selectedMaterial
            } else {
                intersectableObj[i].material = originalMaterials[o.uuid]
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

    const intersectableObj = pickableObjects.filter(o => o.visible === true);
    intersects = raycaster.intersectObjects(intersectableObj, false);
    if (intersects.length > 0) {
        currentPickedObject = intersects[0].object;
        let position = JSON.stringify({
            x: currentPickedObject.position.x,
            y: currentPickedObject.position.z,
            z: currentPickedObject.position.y
        });

        if (currentPickedObject.userData.points) {
            position = JSON.stringify(currentPickedObject.userData.points, null, 2)
        }

        const id = currentPickedObject.userData.uuid;
        const columnData = getOutputData(id);
        const columnConfig = getOutputDataWithConfig(id);
        debugDiv.value = `ID: ${id} \nPosition: ${position} \n${columnData}\n${columnConfig}`;


    }
    intersectableObj.forEach((o: THREE.Mesh, i) => {
        if (currentPickedObject && currentPickedObject.uuid === o.uuid) {
            intersectableObj[i].material = selectedMaterial;
        } else {
            intersectableObj[i].material = originalMaterials[o.uuid]
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

function drawHEdge(edge: any) {

    const p1 = edge.vertex[0];
    const p2 = edge.vertex[1];

    let x = Math.abs(p1.x - p2.x);
    let y = Math.abs(p1.y - p2.y);
    let z = Math.abs(p1.z - p2.z);

    x = x > 0 ? x : EDGE_THICKNESS;
    y = y > 0 ? y : EDGE_THICKNESS;
    z = z > 0 ? z : EDGE_THICKNESS;

    const geometry = new THREE.BoxBufferGeometry(x, y, z)
    const material = normalMaterial
    const cube = new THREE.Mesh(geometry, material)

    //Move into place
    cube.position.setX(Math.min(p1.x, p2.x) + x / 2);
    cube.position.setY(Math.min(p1.y, p2.y) - y / 2);
    cube.position.setZ(Math.min(p1.z, p2.z) + z / 2);
    cube.userData = edge.userData
    scene.add(cube)
    pickableObjects.push(cube);
    originalMaterials[cube.uuid] = cube.material;

}

function drawVEdge(edge: any) {


    const p1 = edge.vertex[0];
    const p2 = edge.vertex[1];

    let x = Math.abs(p1.x - p2.x);
    let y = Math.abs(p1.y - p2.y);
    let z = Math.abs(p1.z - p2.z);

    x = x > 0 ? x : EDGE_THICKNESS;
    y = y > 0 ? y : EDGE_THICKNESS;
    z = z > 0 ? z : EDGE_THICKNESS;

    const geometry = new THREE.BoxBufferGeometry(x, y, z)
    const material = normalMaterial
    const cube = new THREE.Mesh(geometry, material)

    //Move into place
    cube.position.setX(p1.x);
    cube.position.setY(Math.min(p1.y, p2.y) + y / 2);
    cube.position.setZ(p1.z);
    cube.userData = edge.userData
    scene.add(cube)
    pickableObjects.push(cube);
    originalMaterials[cube.uuid] = cube.material;

}

function drawFace(face: any) {

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
        const isVertical = isVertexsVertical([vStart, vEnd])
        let type = isVertical ? 'column' : 'beam';
        let floorLevel = isVertical ? Math.max(e.start.floor, e.end.floor) : e.start.floor;
        return {
            userData: {
                type: type,
                uuid: uuid,
                floorLevel: floorLevel,
                points: [vStart, vEnd]
            },
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
        const [floorLevel] = getFaceFloorNum(f);
        const uuid = f.uuid;
        const vertexs = getSlabVertex(f)
        return {
            userData: {
                type: "slab",
                uuid: uuid,
                floorLevel: floorLevel,
                points: vertexs
            },
            vertex: vertexs
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

function isVertexsVertical(vertexs: Vector3[]) {
    const p1 = vertexs[0];
    const p2 = vertexs[1];

    if (Math.abs(p1.y - p2.y) > 0
        && Math.abs(p1.x - p2.x) < 1
        && Math.abs(p1.z - p2.z) < 1) {
        return true;
    } else {
        return false;
    }
}

function isEdgeVertical(edge: any) {

    const points = edge.vertex

    return isVertexsVertical(points)

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

    const PRECISION = 1e-8;
    return (
        (precise(e1[0]).equals(precise(e2[0])) && precise(e1[1]).equals(precise(e2[1])))
        || (precise(e1[0]).equals(precise(e2[1])) && precise(e1[1]).equals(precise(e2[0])))
    )
}

function getOutputData(id: any) {
    const x = `$.elements[?(@.type == 'column' && @.attributes.edgeId == '${id}')]`
    let data = jsonpath.query(jOutput, x);

    return JSON.stringify(data, null, 2)
}

function getOutputDataWithConfig(id: any) {

    const columnJPath = `$.elements[?(@.type == 'column' && @.attributes.edgeId == '${id}')].attributes.columnConfigExternalRefId`
    let columnConfigIds = jsonpath.query(jOutput, columnJPath);

    const configId = columnConfigIds[0];
    const columnConfigJPath = `$.elements[?(@.type == 'columnConfiguration' && @.externalRefId == '${configId}')]`
    let data = jsonpath.query(jOutput, columnConfigJPath)

    return JSON.stringify(data, null, 2)
}


function precise(data: Vector3) {
    return new THREE.Vector3(
        parseFloat(data.x.toFixed(DECIMAL_POINT)),
        parseFloat(data.y.toFixed(DECIMAL_POINT)),
        parseFloat(data.z.toFixed(DECIMAL_POINT)));
}

//End of - Json parsing

function updateStructureInScene(typeToUpdate: any) {
    const objs = pickableObjects.filter(obj => obj.userData.type === typeToUpdate)
    objs.forEach(obj => obj.visible = false)

    let showLevel: string;
    switch (typeToUpdate) {
        case 'column':
            showLevel = columnShowLevel
            break;
        case 'beam':
            showLevel = beamShowLevel
            break;
        case 'slab':
            showLevel = slabShowLevel
            break;
        default:
            console.log(`Error`);
    }


    const filteredObject = objs
        .filter(e => e.userData.floorLevel !== 0)
        .filter(e => (showLevel === 'ALL' ? true : e.userData.floorLevel == showLevel))

    filteredObject.forEach(obj => {
        obj.visible = true
    })

    updateSkeletonInfo()
}

function removeStructureFromScene() {
    pickableObjects.forEach(obj => scene.remove(obj))
    pickableObjects = []
}

function parseAndDrawSkeleton() {

    //Clear when redraw
    removeStructureFromScene()

    //Draw column
    const vEdge = parseEdges(jSkeleton);
    const verticalEdge = getUnique(vEdge.filter(isEdgeVertical));
    console.log("Num of unique verticalEdge " + verticalEdge.length)

    const displayColumn = verticalEdge.filter(e => e.userData.floorLevel !== 0)
    displayColumn.forEach(e => drawVEdge(e));

    //Draw face
    const slabs = parseSlabs(jSkeleton)
    const uniqueSlabs = getUniqueFace(slabs)
    console.log("Num of unique horizantal slabs " + uniqueSlabs.length)

    const displaySlabs = uniqueSlabs.filter(e => e.userData.floorLevel !== 0)
    displaySlabs.forEach(s => drawFace(s))

    //Draw beam
    const hEdge = parseEdges(jSkeleton);
    const horizontalEdge = getUnique(hEdge.filter(e => !isEdgeVertical(e)))
    console.log("Num of horizontalEdge " + horizontalEdge.length)

    const displayBeams = horizontalEdge.filter(e => e.userData.floorLevel !== 0)
    displayBeams.forEach(e => drawHEdge(e))

    //Update count info
    updateSkeletonInfo()
}

init()
initGUI()
animate()

