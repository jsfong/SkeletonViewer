import * as jsonpath from 'jsonpath';
import * as THREE from 'three'
import { Vector3 } from 'three'

const DECIMAL_POINT = 6;

export function parseEdges(data: any) {
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
                points: [vStart, vEnd],
                dimension: {
                    x: Math.abs(vStart.x - vEnd.x),
                    y: Math.abs(vStart.y - vEnd.y),
                    z: Math.abs(vStart.z - vEnd.z)
                }
            },
            vertex: [vStart, vEnd]
        }
    });

    return vEdges;
}

export function parseFaces(data: any) {

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
                type: "face",
                uuid: uuid,
                floorLevel: floorLevel,
                points: vertexs
            },
            vertex: vertexs
        }
    });

    return slabs;
}

export function parsePlateSet(output: any) {
    const plateSetRegex = "$.data.elements[?(@.type === 'plateSet')]";
    let plateSetObj = jsonpath.query(output, plateSetRegex);


    const plateSets = plateSetObj.map(p => {
        return {
            floorLevel: p.attributes.floor,
            plates: p.attributes.plates
        }

    })

    let plates : any[]= [];
    plateSets.forEach(ps => {
        const plateObj = parsePlate(ps)
        plateObj.forEach(p => plates.push(p))
    })   

    return plates;

}

function parsePlate(plateSet: any) {

    const platesObj: any[] = plateSet.plates
    const floorLevel = plateSet.floorLevel
    const plates = platesObj.map(p => {
        return {
            userData: {
                type: "plate",
                uuid: p.plateId,
                floorLevel: floorLevel,
                points: p.boundary.points
            }
        }
    })

    return plates;
}

function parseRenderPlate(plateSet: any) {

    const platesObj: any[] = plateSet.plates
    const floorLevel = plateSet.floorLevel
    const plates = platesObj.map(p => {
        return {
            userData: {
                type: "plate",
                uuid: p.plateId,
                floorLevel: floorLevel,
                points: p.boundaryForRender.points
            }
        }
    })

    return plates;
}

export function parseColumnColumnConnector(output: any, pickableObjects: THREE.Mesh[]) {
    const columnColumnConnectorRegex = "$.data.elements[?(@.type === 'columnColumnConnector')]";
    let columnColumnConnector = jsonpath.query(output, columnColumnConnectorRegex);

    //Get edge id    
    const connectorIds = columnColumnConnector.map(c => {
        const columnEdgeIdRegex = `$.data.elements[?(@.id === '${c.attributes.columnAboveId}')]`;
        let edgeId = jsonpath.query(output, columnEdgeIdRegex);
        return {
            id: c.externalRefId,
            edgeId: edgeId[0].attributes.edgeId
        }
    })

    //Get related edge
    const objs = connectorIds.map(ids => {
        const obj = pickableObjects.filter(obj => obj.userData.uuid === ids.edgeId);
        let userData = { ...obj[0].userData };

        //Update data
        userData.uuid = ids.id;

        return userData;

    })

    return objs;

}

export function getSlabBeamConnectorOutput(output: any, slabId: any) {
    const columnColumnConnectorRegex = `$.data.elements[?(@.type === 'slabBeamConnector' && @.attributes.connectedSlabId ==='${slabId}')]`;
    
    //Get connectors for a slab
    let slabBeamConnector = jsonpath.query(output, columnColumnConnectorRegex);

    //Collect information for each connector
    const connectors= slabBeamConnector.map(c => {

        //Get connected beam
        const beamIdRegex = `$.data.elements[?(@.id === '${c.attributes.connectedBeamId}')]`;
        let beams = jsonpath.query(output, beamIdRegex);

        //Get connector identifier

        //Get corresponding relationship
        const relationshipRegex = `$.data.relationships[?(@.type=== 'hasConfiguration' && @.sourceExternalRefId ==='${c.externalRefId}')]`
        const relationships = jsonpath.query(output, relationshipRegex);

        if(!relationships || relationships.length == 0) {
            console.log(`ERROR: Unable to find relationship for slabBeamConnecter ${c.externalRefId}`)
            return;
        }
        const connectorConfigExtRefId = relationships[0].targetExternalRefId;
        

        const connectorConfigRegex = `$.data.elements[?(@.type === 'slabBeamConnectorConfiguration' && @.externalRefId ==='${connectorConfigExtRefId}')]`
        const connectorConfig = jsonpath.query(output, connectorConfigRegex);

        return {
            id: c.externalRefId,
            slabId: slabId,
            beamId: beams[0].id,
            beamEdgeId: beams[0].attributes.edgeId,
            config: connectorConfig[0]
        }
    })

    return connectors
}

export function getUniqueFace(faces: any[]) {
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

export function isEdgeVertical(edge: any) {

    const points = edge.vertex

    return isVertexsVertical(points)

}

export function getUnique(points: any[]) {
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

export function getOutputData(jOutput: any, id: any) {
    // const x = `$.data.elements[?(@.type == 'column' && @.attributes.edgeId == '${id}')]`
    const edge = `$.data.elements[?(@.attributes.edgeId == '${id}')]`
    const face = `$.data.elements[?(@.attributes.faceId == '${id}')]`
    let edgeData = jsonpath.query(jOutput, edge);
    let faceData = jsonpath.query(jOutput, face);


    return edgeData.concat(faceData)
}


export function getSlabOutputData(jOutput: any, id: any){
    const slab = `$.data.elements[?(@.attributes.plateId == '${id}')]`
    let slabData = jsonpath.query(jOutput, slab);
    return slabData;
}

export function getFaceOutputData(jOutput: any, id: any){
    const face = `$.data.elements[?(@.attributes.faceId == '${id}')]`
    let faceData = jsonpath.query(jOutput, face);
    return faceData;
}

export function getOutputDataWithConfig(jOutput: any, id: any) {

    const columnJPath = `$.elements[?(@.type == 'column' && @.attributes.edgeId == '${id}')].attributes.columnConfigExternalRefId`
    let columnConfigIds = jsonpath.query(jOutput, columnJPath);

    const configId = columnConfigIds[0];
    const columnConfigJPath = `$.elements[?(@.type == 'columnConfiguration' && @.externalRefId == '${configId}')]`
    let data = jsonpath.query(jOutput, columnConfigJPath)

    return data
}

export function getOutputConnectorData(jOutput: any, id: any) {
    const con = `$.data.elements[?(@.externalRefId == '${id}')]`
    let conData = jsonpath.query(jOutput, con);


    return conData
}

function isVertexEqual(e1: Vector3, e2: Vector3) {
    return e1.x === e2.x && e1.y === e2.y && e1.z === e2.z;
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

function precise(data: Vector3) {
    return new THREE.Vector3(
        parseFloat(data.x.toFixed(DECIMAL_POINT)),
        parseFloat(data.y.toFixed(DECIMAL_POINT)),
        parseFloat(data.z.toFixed(DECIMAL_POINT)));
}
