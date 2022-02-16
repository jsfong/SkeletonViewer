import * as THREE from 'three'
import { Vector3 } from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import { TransformControls } from 'three/examples/jsm/controls/TransformControls'

const scene = new THREE.Scene()

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
camera.position.z = 20

const renderer = new THREE.WebGLRenderer()
renderer.setSize(window.innerWidth, window.innerHeight)
document.body.appendChild(renderer.domElement)
const controls = new OrbitControls(camera, renderer.domElement)

// //Draw edge
// const x1 = new THREE.Vector3(10, 0, 0);
// const x2 = new THREE.Vector3(-10, 0, 0);
// drawEdge([x1, x2], 0.25);

//Draw face - 4 points
const f1 = new THREE.Vector3(0, 0, 0);
const f2 = new THREE.Vector3(1, 0, 0);
const f3 = new THREE.Vector3(1, 0, 1);
const f4 = new THREE.Vector3(0, 0, 1);
drawFace([f1, f2, f3, f4])

const axesHelper = new THREE.AxesHelper(5);
scene.add(axesHelper);

window.addEventListener('resize', onWindowResize, false)
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(window.innerWidth, window.innerHeight)
    render()
}

function animate() {
    requestAnimationFrame(animate)

    controls.update()

    render()
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
    scene.add(trimesh)

}
animate()
