import * as THREE from 'three'
import { Vector3 } from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import Stats from 'three/examples/jsm/libs/stats.module'
import * as jsonpath from 'jsonpath';
const htypeSkeleton = require("./htypeSkeleton.json");
const itypeOutput = require("./itypeOutput.json");
import { GUI } from 'dat.gui'
import { prettyPrintJson, FormatOptions } from 'pretty-print-json';
import { emitWarning } from 'process';
import * as Parser from "./skeletonParser";
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry';

const options: FormatOptions = { indent: 2, lineNumbers: false };

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

const enum orientation { NS, EW };

//Font
var font;
var loader = new FontLoader();
loader.load('path/to/fontfile.js', function (response) {
    font = response;
});


//JSON
let jSkeleton = htypeSkeleton;
let jSkeleton2 = htypeSkeleton;
let jOutput = itypeOutput;

//Material
let normalMaterial = new THREE.MeshLambertMaterial({
    color: 0x939393,
    emissive: 0x2d2d2d
});

let panelMaterial = new THREE.MeshLambertMaterial({
    color: 0x049ef4,
    emissive: 0x2d2d2d,
    transparent: true,
    opacity: 0.7
});

const highlightedMaterial = new THREE.MeshBasicMaterial({
    wireframe: true,
    color: 0x00ff00
})
const selectedMaterial = new THREE.MeshNormalMaterial({
    side: THREE.DoubleSide
})
const wireFrameMaterial = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 })


//Picking Config
let raycaster: THREE.Raycaster;
let intersects: THREE.Intersection[]
let pickableObjects: THREE.Mesh[] = [];
let wireframeObjects: THREE.LineSegments[] = [];
let panelWireframeObjects: THREE.LineSegments[] = [];
let currentPickedObject: THREE.Object3D | THREE.Mesh | any | null;
let intersectObject: THREE.Object3D | null;
const originalMaterials: { [id: string]: THREE.Material | THREE.Material[] } = {}
const debugDiv = document.getElementById('debug1') as HTMLPreElement
const debugDiv2 = document.getElementById('debugDiv2') as HTMLDivElement
const bReadSkeleton = document.getElementById('bAddSkeleton') as HTMLButtonElement;
const tSkeletonSrc = document.getElementById('tSkeletonSrc') as HTMLTextAreaElement;
const bReadResult = document.getElementById('bAddResult') as HTMLButtonElement;
const tResultSrc = document.getElementById('tResultSrc') as HTMLTextAreaElement;
const snackbar = document.getElementById('snackbar') as HTMLDivElement;
const tOutputSrc = document.getElementById('tOutputSrc') as HTMLTextAreaElement;
const bAddOutput = document.getElementById('bAddOutput') as HTMLButtonElement;
const inputFile = document.getElementById("customFile") as HTMLInputElement;
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
    columnColumnConnectorLevelToDraw: 'NONE',
    plateLevelToDraw: 'NONE',
    showFaceWireframe: false,
    showPanelWireframe: false
};

//Skeleton Config
const EDGE_THICKNESS = 1
const CONNECTOR_THICKNESS = 2
const PLATE_OFFSET = 0.2
let columnShowLevel = 'ALL'
let slabShowLevel = 'ALL'
let beamShowLevel = 'ALL'
let colColConShowLevel = 'NONE'
let plateShowLevel = 'NONE'

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

    // Axes Helper
    const axesHelper = new THREE.AxesHelper(50);
    scene.add(axesHelper);

    //Raycaster
    raycaster = new THREE.Raycaster();

    //Grid
    const gridHelper = new THREE.GridHelper(2000, 2000, 0x444444, 0x888888);
    scene.add(gridHelper);

    //Plane
    const geometry = new THREE.PlaneBufferGeometry(2000, 2000);
    geometry.rotateX(- Math.PI / 2);
    plane = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ visible: false }));
    plane.name = "floor";
    scene.add(plane);

    //Debug view
    debugView = document.getElementById('debug1') as HTMLDivElement

    //Orbit control
    new OrbitControls(camera, renderer.domElement)

    //Event listener
    document.addEventListener('resize', onWindowResize);

    renderer.domElement.addEventListener('wheel', onDocumentMouseScroll, false);
    renderer.domElement.addEventListener('mousemove', onDocumentMouseMove, false);
    renderer.domElement.addEventListener('pointerdown', onDocumentMouseDown, false);

    bReadSkeleton.addEventListener("click", readSkeleton, false);
    bReadResult.addEventListener("click", readResult, false);
    bAddOutput.addEventListener("click", readOutput, false);
    tOutputSrc.value = JSON.stringify(jOutput, null, 2);
    inputFile.addEventListener("change", handleFiles, false);

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
        updateStructureInScene('face')
    });
    levelFolder.add(settings, 'columnLevelToDraw', ['ALL', '1', '2', '3', '4', '5', 'NONE']).onChange((value) => {
        columnShowLevel = value
        updateStructureInScene('column')
    });
    levelFolder.add(settings, 'beamLevelToDraw', ['ALL', '1', '2', '3', '4', '5', 'NONE']).onChange((value) => {
        beamShowLevel = value
        updateStructureInScene('beam')
    });
    levelFolder.add(settings, 'columnColumnConnectorLevelToDraw', ['ALL', '1', '2', '3', '4', '5', 'NONE']).onChange((value) => {
        colColConShowLevel = value
        updateStructureInScene('columnColumnConnector')
    });
    levelFolder.add(settings, 'plateLevelToDraw', ['ALL', '1', '2', '3', '4', '5', 'NONE']).onChange((value) => {
        plateShowLevel = value
        updateStructureInScene('plate')
    });
    levelFolder.add(settings, 'showFaceWireframe').onChange((value) => {
        displayWireframe()
    });
    levelFolder.add(settings, 'showPanelWireframe').onChange((value) => {
        displayPanelWireframe()
    })

    levelFolder.open()

}

function updateSkeletonInfo() {
    const slabCount = pickableObjects.filter(o => o.userData.type === 'face').filter(o => o.visible === true).length
    const beamCount = pickableObjects.filter(o => o.userData.type === 'beam').filter(o => o.visible === true).length
    const columnCount = pickableObjects.filter(o => o.userData.type === 'column').filter(o => o.visible === true).length
    const plateCount = pickableObjects.filter(o => o.userData.type === 'plate').filter(o => o.visible === true).length
    const columnColumnConnectorCount = pickableObjects.filter(o => o.userData.type === 'columnColumnConnector').filter(o => o.visible === true).length
    debugDiv2.innerText = `Excluding ground floor\nFace : ${slabCount}\nBeam : ${beamCount}\nPlate: ${plateCount}\nColumn : ${columnCount}\nColumnColumnConnector: ${columnColumnConnectorCount}`
}

function displayWireframe() {

    if (settings.showFaceWireframe) {
        const objsToDisplay = wireframeObjects.filter(e => (settings.floorLevelToDraw === 'ALL' ? true : e.userData.floorLevel == slabShowLevel))
        const objsToNotDisplay = wireframeObjects.filter(e => (settings.floorLevelToDraw === 'ALL' ? false : e.userData.floorLevel != slabShowLevel))
        objsToDisplay.forEach(w => w.visible = true)
        objsToNotDisplay.forEach(w => w.visible = false)

    } else {
        wireframeObjects.forEach(w => w.visible = false)
    }

}

function displayPanelWireframe() {

    if (settings.showPanelWireframe) {
        const objsToDisplay = panelWireframeObjects.filter(e => (settings.plateLevelToDraw === 'ALL' ? true : e.userData.floorLevel == plateShowLevel))
        const objsToNotDisplay = panelWireframeObjects.filter(e => (settings.plateLevelToDraw === 'ALL' ? false : e.userData.floorLevel != plateShowLevel))
        objsToDisplay.forEach(w => w.visible = true)
        objsToNotDisplay.forEach(w => w.visible = false)

    } else {
        panelWireframeObjects.forEach(w => w.visible = false)
    }

}

function sendNotification(msg: string) {
    clearTimeout(timer)
    snackbar.innerText = msg
    snackbar.className = "show"
    timer = setTimeout(() => {
        snackbar.className = snackbar.className.replace("show", "")
    }, 3000);

}

function readOutput(this: HTMLElement, ev: Event) {
    console.log("Read Output")
    sendNotification("Reading Output...")
    ev.preventDefault();
    if (tOutputSrc.value) {
        jOutput = JSON.parse(tOutputSrc.value)
        const jElement: any[] = jOutput.data.elements;
        jSkeleton = jElement.find(e => e.type === "skeleton").attributes

        console.log(jSkeleton)
        console.log("Drawing Skeleton..")
        sendNotification("Drawing Skeleton...")
        parseAndDrawSkeleton(jSkeleton);
        sendNotification("Done")
    }
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
    parseAndDrawSkeleton(jSkeleton);

}

function readResult(this: HTMLElement, ev: Event) {
    console.log("Read Result")
    ev.preventDefault();

    if (tResultSrc.value) {
        console.log("Detected Result input")
        jOutput = JSON.parse(tResultSrc.value)
    }
    sendNotification("Done parsing result")
}

function handleFiles(this: HTMLElement, ev: Event) {
    console.log("handleFiles")
    let files = (ev.target as HTMLInputElement).files;
    if (files) {
        let file = files[0]

        const reader = new FileReader();
        reader.addEventListener('load', (event) => {
            const result = event.target?.result;
            if (typeof result === 'string') {
                const json = atob(result.substring(29));
                jOutput = JSON.parse(json);
                const jElement: any[] = jOutput.data.elements;
                jSkeleton = jElement.find(e => e.type === "skeleton").attributes
                jSkeleton2 = jElement.find(e => e.type === "skeletonForRender").attributes

                parseAndDrawSkeleton(jSkeleton);
                parseAndDrawSkeleton(jSkeleton2, false);
                sendNotification("Done")
            }

        })

        reader.readAsDataURL(file);
        sendNotification("Drawing Skeleton...")
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

    let structuralData: any;
    let slabData: any;
    let faceData: any;
    let connectorData: any;

    const intersectableObj = pickableObjects.filter(o => o.visible === true);
    intersects = raycaster.intersectObjects(intersectableObj, false);
    if (intersects.length > 0) {
        currentPickedObject = intersects[0].object;
        let position = {
            x: currentPickedObject.position.x,
            y: currentPickedObject.position.z,
            z: currentPickedObject.position.y
        };

        if (currentPickedObject.userData.points) {
            position = currentPickedObject.userData.points
        }

        const type = currentPickedObject.userData.type;
        const id = currentPickedObject.userData.uuid;
        const dimension = currentPickedObject.userData.dimension;

        // let structuralData = Parser.getOutputData(jOutput, id);
        // let columnConfig = Parser.getOutputDataWithConfig(jOutput, id);
        // const connectorData = Parser.getOutputConnectorData(jOutput, id);        

        switch (type) {
            case 'column':
                structuralData = Parser.getOutputData(jOutput, id);
                break;
            case 'columnColumnConnector':
                structuralData = Parser.getOutputConnectorData(jOutput, id);
                break;
            case 'plate':
                slabData = Parser.getSlabOutputData(jOutput, id);
                faceData = Parser.getFaceOutputData(jOutput, id);

                const slabBeamConnector = Parser.getSlabBeamConnectorOutput(jOutput, slabData[0].id);
                connectorData = {
                    Num: slabBeamConnector.filter(o => o).length,
                    slabBeamConnector: slabBeamConnector
                }

                break;
            default:
                structuralData = Parser.getOutputData(jOutput, id);
        }

        let data = { Type: type, ID: id, Position: position, Dimension: dimension, connectorData: connectorData, structuralData: structuralData, slabData: slabData, faceData: faceData };
        debugDiv.innerHTML = prettyPrintJson.toHtml(data, options);

        //Highlight selected obj
        intersectableObj.forEach((o: THREE.Mesh, i) => {
            if (currentPickedObject && currentPickedObject.uuid === o.uuid) {
                intersectableObj[i].material = selectedMaterial;
            } else {
                intersectableObj[i].material = originalMaterials[o.uuid]
            }
        })

        //Highlight connected slab Beam 
        if (currentPickedObject.userData.type === 'plate') {
            //Get array of connected beamEdgeId
            const connectedBeamEdgeId = connectorData.slabBeamConnector.map((c: { beamEdgeId: any; }) => c.beamEdgeId)
            connectedBeamEdgeId.forEach((id: any) => {
                intersectableObj.forEach((o: THREE.Mesh, i) => {
                    if (o.userData.uuid == id) {
                        intersectableObj[i].material = selectedMaterial;
                    }
                })
            })
        }

    }




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

    x = Math.round(x * 1e2) / 1e2
    y = Math.round(y * 1e2) / 1e2
    z = Math.round(z * 1e2) / 1e2

    const beamOrientation = x > 0 ? orientation.NS : orientation.EW
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

    if (beamOrientation === orientation.NS) {
        cube.position.setZ(cube.position.z - (EDGE_THICKNESS / 2))
    }

    if (beamOrientation === orientation.EW) {
        cube.position.setX(cube.position.x - (EDGE_THICKNESS / 2))
    }
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

    //draw shape
    const triangleShape = new THREE.Shape();
    triangleShape.moveTo(firstP.x, firstP.z);
    restOfP.forEach((p: { x: number; z: number; }) => triangleShape.lineTo(p.x, p.z))
    triangleShape.lineTo(firstP.x, firstP.z); // close path

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

    //draw wireframe
    const geo = new THREE.EdgesGeometry(trimesh.geometry);
    const wireframe = new THREE.LineSegments(geo, wireFrameMaterial);
    wireframe.renderOrder = 1;

    wireframe.rotateX(Math.PI / 2);
    wireframe.position.setY(firstP.y);
    wireframe.visible = (settings.showFaceWireframe) ? true : false
    wireframe.userData = face.userData
    scene.add(wireframe);
    wireframeObjects.push(wireframe);


}

function drawPlate(plate: any) {

    const points = plate.userData.points;
    const [firstP, ...restOfP] = points

    //draw shape
    const triangleShape = new THREE.Shape();
    triangleShape.moveTo(firstP.x, firstP.y);
    restOfP.forEach((p: { x: number; y: number; }) => triangleShape.lineTo(p.x, p.y))

    const tri = new THREE.ShapeBufferGeometry(triangleShape);
    let material = panelMaterial
    material.side = THREE.DoubleSide
    const trimesh = new THREE.Mesh(tri, material);
    trimesh.userData = plate.userData

    trimesh.rotateX(Math.PI / 2)
    trimesh.position.setY(firstP.z + PLATE_OFFSET);
    trimesh.renderOrder = 2;
    scene.add(trimesh)
    pickableObjects.push(trimesh);
    originalMaterials[trimesh.uuid] = trimesh.material;

    //draw wireframe
    const geo = new THREE.EdgesGeometry(trimesh.geometry);
    const wireframe = new THREE.LineSegments(geo, wireFrameMaterial);
    wireframe.renderOrder = 3;

    wireframe.rotateX(Math.PI / 2);
    wireframe.position.setY(firstP.z + PLATE_OFFSET);
    wireframe.visible = (settings.showPanelWireframe) ? true : false
    wireframe.userData = plate.userData
    scene.add(wireframe);
    panelWireframeObjects.push(wireframe);

}

function drawCCConnector(edgeUserData: any) {
    const p1 = edgeUserData.points[0];

    let x = Math.abs(p1.x);
    let y = Math.abs(p1.y);
    let z = Math.abs(p1.z);

    const geometry = new THREE.BoxBufferGeometry(CONNECTOR_THICKNESS, CONNECTOR_THICKNESS, CONNECTOR_THICKNESS)
    const material = normalMaterial
    const cube = new THREE.Mesh(geometry, material)

    //Move into place
    cube.position.setX(p1.x);
    cube.position.setY(p1.y);
    cube.position.setZ(p1.z);
    cube.userData = edgeUserData
    cube.userData.type = 'columnColumnConnector'
    scene.add(cube)
    pickableObjects.push(cube);
    originalMaterials[cube.uuid] = cube.material;
}


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
        case 'face':
            showLevel = slabShowLevel
            break;
        case 'columnColumnConnector':
            showLevel = colColConShowLevel;
            break;
        case 'plate':
            showLevel = plateShowLevel;
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

    displayWireframe()
    updateSkeletonInfo()
}

function removeStructureFromScene() {
    pickableObjects.forEach(obj => scene.remove(obj))
    pickableObjects = []
    wireframeObjects = []
}

function parseAndDrawSkeleton(skeleton: any, clearStructure: boolean = true) {

    //Clear when redraw
    if (clearStructure) {
        removeStructureFromScene()
    }

    //Draw column
    const vEdge = Parser.parseEdges(skeleton);
    const verticalEdge = Parser.getUnique(vEdge.filter(Parser.isEdgeVertical));
    console.log("Num of unique verticalEdge " + verticalEdge.length)

    const displayColumn = verticalEdge.filter((e: any) => e.userData.floorLevel !== 0)
    displayColumn.forEach((e: any) => drawVEdge(e));

    //Draw face
    const slabs = Parser.parseFaces(skeleton)
    // const uniqueSlabs = slabs
    const uniqueSlabs = Parser.getUniqueFace(slabs)
    console.log("Num of unique horizantal slabs " + uniqueSlabs.length)

    const displaySlabs = uniqueSlabs.filter((e: { userData: { floorLevel: number; }; }) => e.userData.floorLevel !== 0)
    displaySlabs.forEach((s: any) => drawFace(s))

    //Draw beam
    const hEdge = Parser.parseEdges(skeleton);
    const horizontalEdge = Parser.getUnique(hEdge.filter((e: any) => !Parser.isEdgeVertical(e)))
    console.log("Num of horizontalEdge " + horizontalEdge.length)

    const displayBeams = horizontalEdge.filter((e: { userData: { floorLevel: number; }; }) => e.userData.floorLevel !== 0)
    displayBeams.forEach((e: any) => drawHEdge(e))

    //Plates
    const plates = Parser.parsePlateSet(jOutput)
    plates.forEach(p => drawPlate(p))
    updateStructureInScene('plate')


    //Draw connector
    const ccConnectorEdge = Parser.parseColumnColumnConnector(jOutput, pickableObjects);
    ccConnectorEdge.forEach((e: any) => drawCCConnector(e))
    updateStructureInScene('columnColumnConnector')


    //Collect slab Beam connector - slab
    //Calculate and display text on how many connector for each slab
    // When slab is selected highlight connected beam


    //Update count info
    updateSkeletonInfo()
}

function isPointOnLine(p1: Vector3, p2: Vector3, pointToCheck: Vector3) {
    let c = new THREE.Vector3();

    const vP1 = p1.clone().sub(pointToCheck)
    const vP2 = p2.clone().sub(pointToCheck)
    c.crossVectors(vP1, vP2)
    const length = c.length();
    const isOnPoint = length != 0;
    return isOnPoint;
}

function isPointOnHorizontalLine(p1: Vector3, p2: Vector3, pointToCheck: Vector3) {
    let c = new THREE.Vector3();

    const vP1 = p1.clone().sub(pointToCheck)
    const vP2 = p2.clone().sub(pointToCheck)
    c.crossVectors(vP1, vP2)
    const length = c.length();
    const isOnPoint = length != 0;
    return isOnPoint;
}

function getMidpoint(p1: Vector3, p2: Vector3) {
    let x = (p1.x + p2.x) / 2
    let y = (p1.y + p2.y) / 2
    let z = (p1.z + p2.z) / 2

    return new THREE.Vector3(x, y, z)
}

init()
initGUI()


animate()

