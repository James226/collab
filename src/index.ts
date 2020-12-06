import { nanoid } from "../node_modules/nanoid/index";
import RealTimeCommunications from './rtc';

var svgNS = 'http://www.w3.org/2000/svg';

const apiUrl = 'https://collab-api-lyvvylp2ia-ew.a.run.app';
//const apiUrl = 'http://localhost:3000';

let selectedElement: SVGGraphicsElement = null;
let selectedNode: DiagramNode = null;
let offset: Vector2 = null;

let selected: HTMLElement = null;

let selectedLine: DiagramConnectorNode = null;

const diagramId = window.location.hash ? window.location.hash.substring(2) : 'default';

window.onhashchange = () => {
    window.location.reload();
}

interface Vector2 {
    x: number;
    y: number;
}

interface DiagramNode {
    id: string
    children: { [id: string] : DiagramNode; }
    connectors: { [id: string] : DiagramConnectorNode }
    x: number
    y: number
    content: string
}

interface DiagramConnectorNode {
    id: string
    from: DiagramNode | Vector2
    to: DiagramNode | Vector2
}

interface Diagram {
    root: DiagramNode
}

const comms: { [id: string]: RealTimeCommunications } = {};
let clientId = '';

const processMessage = (e: MessageEvent<any>) => {
    const message = JSON.parse(e.data);
    switch (message.type) {
        case 'translate':
            {
                const { id, x, y } = message;
                const node = diagram.root.children[id];
                node.x = x;
                node.y = y;
                break;
            }

        case 'add':
            {
                const { id, x, y } = message;
                diagram.root.children[id] = ({ id, children: {}, x, y, content: '', connectors: {} });
                break;
            }

        case 'deleteNode':
            {
                const { id } = message;
                delete diagram.root.children[id];
                break;
            }

        case 'setContent':
            {
                const { id, content } = message;
                const node = diagram.root.children[id];
                node.content = content;
                break;
            }

        case 'addConnector':
            {
                const { id, from, to } = message;

                const connector = { id, from, to };

                if ('id' in connector.from) {
                    connector.from = diagram.root.children[connector.from.id];
                }
                if ('id' in connector.to) {
                    connector.to = diagram.root.children[connector.to.id];
                }
                
                diagram.root.connectors[id] = connector;
                break;
            }

        case 'deleteConnector':
            {
                const { id } = message;
                delete diagram.root.connectors[id];
                break;
            }

        case 'diagram':
            {
                diagram = message.diagram;
                clientId = message.clientId;
                for (const id in diagram.root.connectors) {
                    if (Object.prototype.hasOwnProperty.call(diagram.root.connectors, id)) {
                        const connector = diagram.root.connectors[id];
                        if ('id' in connector.from) {
                            connector.from = diagram.root.children[connector.from.id];
                        }
                        if ('id' in connector.to) {
                            connector.to = diagram.root.children[connector.to.id];
                        }
                    }
                }

                for (let i = 0; i < message.clients.length; i++) {
                    console.log('Creating comms channel for client', message.clients[i]);
                    const client = message.clients[i];
                    const realTimeComms = new RealTimeCommunications(ice => {
                        sendData(JSON.stringify({ message: JSON.stringify(ice), for: client, username: clientId, type: 'ice' }))
                    }, processMessage);
                    comms[message.clients[i]] = realTimeComms;
                    realTimeComms.offer().then(offer => {
                        sendData(JSON.stringify({ message: JSON.stringify(offer), for: client, username: clientId, type: 'offer' }))
                    });
                }
                break;
            }

        case 'offer':
            {
                const offer = JSON.parse(message.message);
                const realTimeComms = new RealTimeCommunications(ice => {
                    sendData(JSON.stringify({ message: JSON.stringify(ice), for: message.username, username: clientId, type: 'ice' }))
                }, processMessage);
                comms[message.username] = realTimeComms;
                realTimeComms.answer(offer).then(desc => {
                    sendData(JSON.stringify({ message: JSON.stringify(desc), for: message.username, username: clientId, type: 'answer' }))
                });
                break;
            }

        case 'answer':
            {
                const desc = JSON.parse(message.message);
                const channel = comms[message.username];
                channel.complete(desc);
                break;
            }

        case 'ice':
            {
                const ice = JSON.parse(message.message);
                const channel = comms[message.username];
                channel.addIce(ice);
                break;
            }
        default:
            console.log('Unknown message received', message);
    }

    reconsile(diagram);
}

var client = new EventSource(`${apiUrl}/events/${diagramId}`);
client.onmessage = processMessage;

window.addEventListener("beforeunload", () => {
    client.close();
 }, false);

const sendData = async (data: string) => {
    const response = await fetch(`${apiUrl}/update/${diagramId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: data
      });

    return response;
};

let diagram: Diagram = {
    root: {
        id: 'root',
        children: {},
        x: 0,
        y: 0,
        content: '',
        connectors: {}
    }
}


const findElement = (element: HTMLElement, className: string): HTMLElement | null  => {
    if (!element) return null;

    if (element.classList.contains(className)) {
        return element;
    }

    if (!element.parentElement) return null;

    return findElement(element.parentElement, className);
}

const getPath = (element: HTMLElement): string[] | null  => {
    const path = [];
    path.push(element.id);

    let parent = element.parentElement;
    while (parent !== root as any && parent != null) {
        path.unshift(parent.id);
        parent = parent.parentElement;
    }
    
    return path;
}

const getConnectorPath = (element: HTMLElement): string[] | null  => {
    const path = [];
    path.push(element.id);

    let parent = element.parentElement.parentElement;
    while (parent !== root as any && parent != null) {
        path.unshift(parent.id);
        parent = parent.parentElement;
    }
    
    return path;
}

const getNodeForPath = (path: string[]): DiagramNode | null => {
    let position = diagram.root;

    for (let i = 0; i < path.length; i++) {
        position = position.children[path[i]];
    }

    return position;   
}

const getNodeForElement = (element: HTMLElement): DiagramNode | null => {
    const path = getPath(element);
    return getNodeForPath(path);
}

const getMousePosition = (evt: any): Vector2 => {
    var CTM = svg.getScreenCTM();

    const clientX = evt.clientX || evt.touches[0].clientX;
    const clientY = evt.clientY || evt.touches[0].clientY;
    return {
      x: (clientX - CTM.e) / CTM.a,
      y: (clientY - CTM.f) / CTM.d
    };
  }

const onEdge = (positionOffset: any, width: number, height: number) => {
    return Math.abs(positionOffset.x + width/2) < 5 || Math.abs(positionOffset.x - width/2) < 5 || Math.abs(positionOffset.y + height/2) < 5 || Math.abs(positionOffset.y - height/2) < 5;
}

const deleteButton = document.getElementById('deleteButton');

deleteButton.addEventListener('click', () => {
    if (!selected) return;

    if (selected.localName === 'path') {
        const connectorPath = getConnectorPath(selected);
        const id = connectorPath.join('.');
        sendData(JSON.stringify({ username: clientId, type: 'deleteConnector', id }));
    }

    if (selected.localName === 'g') {
        const connectorPath = getPath(selected);
        const id = connectorPath.join('.');
        sendData(JSON.stringify({ username: clientId, type: 'deleteNode', id }));
    }
});

const deselectElement = () => {
    if (selected) {
        selected.classList.remove('selected');
    }
    deleteButton.setAttribute('disabled', 'disabled');
}

const selectElement = (element: HTMLElement) => {
    element.classList.add('selected');
    selected = element;
    deleteButton.removeAttribute('disabled');
};

let startPosition: Vector2 = null;

const startDrag = (event: MouseEvent) => {
    const target = event.target as HTMLElement;

    deselectElement();
    const selectableElement = findElement(target, 'selectable');
    if (selectableElement) {
        selectElement(selectableElement);
    }
    
    const draggableElement = findElement(target, 'draggable');

    if (!draggableElement) return;

    const path = getPath(draggableElement);
    const node = getNodeForPath(path);
    const [_, x, y] = draggableElement.getAttribute('transform').match(/translate\((\-?[\d\.]+),(\-?[\d\.]+)\)/)

    startPosition = { x: node.x, y: node.y };

    const positionOffset = getMousePosition(event);
    positionOffset.x -= node.x;
    positionOffset.y -= node.y;

    if (onEdge(positionOffset, 80, 40)) {
        const parentPath = path.slice(0, -1);
        const parent = getNodeForPath(parentPath);

        var coord = getMousePosition(event);
        const snap = event.shiftKey ? largeSnap : event.ctrlKey ? noSnap : defaultSnap;
        const x = Math.round(coord.x/snap)*snap;
        const y = Math.round(coord.y/snap)*snap;
        
        const connector: DiagramConnectorNode = {
            id: nanoid().replace('-', '.'),
            from: node,
            to: { x, y }
        }

        selectedLine = connector;

        if (!parent.connectors) parent.connectors = {};

        parent.connectors[connector.id] = connector;
    } else {
        selectedNode = node;
        selectedElement = draggableElement as unknown as SVGGraphicsElement;
        offset = positionOffset;
    
        draggableElement.classList.add('selected');
    }
};

const largeSnap = 40;
const defaultSnap = 10;
const noSnap = 1;

const drag = (event: MouseEvent) => {
    event.preventDefault();
    if (selectedElement) {
        var coord = getMousePosition(event);
        const snap = event.shiftKey ? largeSnap : event.ctrlKey ? noSnap : defaultSnap;
        const x = Math.round((coord.x - offset.x)/snap)*snap;
        const y = Math.round((coord.y - offset.y)/snap)*snap;
        selectedNode.x = x;
        selectedNode.y = y;
        reconsile(diagram);

        for (const channelId in comms) {
            if (Object.prototype.hasOwnProperty.call(comms, channelId)) {
                const channel = comms[channelId];
                channel.send(JSON.stringify({ username: clientId, type: 'translate', id: selectedElement.id, x, y }));
            }
        }

        return;
    }

    if (selectedLine) {
        var coord = getMousePosition(event);

        //const target = document.elementFromPoint(coord.x, coord.y) as HTMLElement;
        const target = event.target as HTMLElement;
        const draggableElement = findElement(target, 'draggable');
        if (draggableElement) {
            const node = getNodeForElement(draggableElement);

            selectedLine.to = node;
            reconsile(diagram);
            return;
        }
        const snap = event.shiftKey ? largeSnap : event.ctrlKey ? noSnap : defaultSnap;
        const x = Math.round(coord.x/snap)*snap;
        const y = Math.round(coord.y/snap)*snap;

        selectedLine.to = { x, y };

        reconsile(diagram);
        return;
    }

    const target = event.target as HTMLElement;
    const draggableElement = findElement(target, 'draggable');

    if (!draggableElement) {
        svg.classList.remove('edgeHover');
        return;
    }

    const [_, x, y] = draggableElement.getAttribute('transform').match(/translate\((\-?[\d\.]+),(\-?[\d\.]+)\)/)

    const positionOffset = getMousePosition(event);
    positionOffset.x -= parseFloat(x);
    positionOffset.y -= parseFloat(y);

    if (onEdge(positionOffset, 80, 40)) {
        svg.classList.add('edgeHover');
    } else {
        svg.classList.remove('edgeHover');
    }
};

const endDrag = () => {
    if (selectedNode) {
        const id = selectedNode.id;
        const x = selectedNode.x;
        const y = selectedNode.y;

        const oldSelectedElement = selectedElement;

        selectedElement = null;
        selectedNode = null;

        if (startPosition.x == x && startPosition.y == y) return;

        sendData(JSON.stringify({ username: clientId, type: 'translate', id, x, y }));

        oldSelectedElement.classList.remove('selected');
        
    }

    
    if (selectedLine) {
        const id = selectedLine.id;
        const from = ('id' in selectedLine.from) ? { id: selectedLine.from.id } : { x: selectedLine.from.x, y: selectedLine.from.y };
        const to = ('id' in selectedLine.to) ? { id: selectedLine.to.id } : { x: selectedLine.to.x, y: selectedLine.to.y };

        sendData(JSON.stringify({ username: clientId, type: 'addConnector', id, from, to }));

        selectedLine = null;
    }
};

const svg = document.getElementById('canvas') as unknown as SVGGraphicsElement;
svg.addEventListener('mousedown', startDrag);
svg.addEventListener('mousemove', drag);
svg.addEventListener('mouseup', endDrag);
svg.addEventListener('mouseleave', endDrag);

svg.addEventListener('touchstart', startDrag);
svg.addEventListener('touchmove', drag);
svg.addEventListener('touchend', endDrag);

const root = document.createElementNS(svgNS, 'g');
root.setAttribute('id', 'root');
svg.appendChild(root);

const connectors = document.createElementNS(svgNS, 'g');
connectors.setAttribute('id', 'connectors');
root.appendChild(connectors);

const add = (nodeId: string = null, x: number = 50, y: number = 50): Element => {
    const id = `${nodeId}`;
    var group = document.createElementNS(svgNS, 'g');
    group.setAttribute('id', id);
    group.setAttribute('transform', `translate(${x},${y})`);
    group.classList.add('draggable', 'selectable');
    root.appendChild(group);

    var shape = document.createElementNS(svgNS,'rect');
    shape.setAttribute('transform', `translate(-40,-20)`);
    shape.setAttribute('width','80');
    shape.setAttribute('height','40');
    shape.setAttribute('fill','white');
    shape.setAttribute('stroke-width', '1');
    shape.setAttribute('stroke', 'black');
    group.appendChild(shape);

    var text = document.createElementNS(svgNS, 'text');
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('alignment-baseline', 'middle');
    text.setAttribute('width', '80');
    text.setAttribute('height', '40');
    text.setAttribute('visibility', 'visible');
    text.textContent = '';

    const enableEditor = () => {
        text.setAttribute('visibility', 'hidden');

        var textEditor = document.createElementNS(svgNS, 'foreignObject');
        textEditor.classList.add('c-texteditor');

        var textdiv = document.createElement("div");

        textdiv.setAttribute("contentEditable", "true");
        textdiv.setAttribute("width", "100%");
        textdiv.setAttribute("height", "40");
        textdiv.classList.add('c-texteditor__text');
        textdiv.style.height = '40px';
        textdiv.style.width = '80px';
        textdiv.style.textAlign = 'center';
        textEditor.setAttribute('transform', `translate(-40,-20)`);
        textEditor.setAttribute("width", "80");
        textEditor.setAttribute("height", "40");
        var textnode = document.createTextNode(text.textContent);
        textdiv.appendChild(textnode);
        textdiv.focus();
        window.setTimeout(function() {
            var sel, range;
            if (window.getSelection && document.createRange) {
                range = document.createRange();
                range.selectNodeContents(textdiv);
                sel = window.getSelection();
                sel.removeAllRanges();
                sel.addRange(range);
            } else if ((document.body as any).createTextRange) {
                range = (document.body as any).createTextRange();
                range.moveToElementText(textdiv);
                range.select();
            }
        }, 1);

        textdiv.addEventListener('blur', e => {
            const content = (e.target as HTMLElement).innerText;
            const node = diagram.root.children[id];
            node.content = content;
            group.removeChild(textEditor);
            text.setAttribute('visibility', 'visible');
            reconsile(diagram);
            sendData(JSON.stringify({ username: 'James', type: 'setContent', id, content }));
        });

        textdiv.addEventListener('keypress', e => {
            if (e.key === 'Enter') {
                e.preventDefault();
                (e.target as HTMLElement).blur();
            }
        });

        textEditor.appendChild(textdiv);
        group.appendChild(textEditor);
    }

    shape.addEventListener('dblclick', enableEditor);
    text.addEventListener('dblclick', enableEditor);
    group.appendChild(text);
    return group;
};

const getOrCreateElement = (node: DiagramNode): Element => {
    const element = root.querySelector(`#${CSS.escape(node.id)}`);
    if (element !== null) return element;
    return add(node.id, node.x, node.y);
}

const getOrCreateConnector = (node: DiagramConnectorNode): Element => {
    const element = root.querySelector(`#${CSS.escape(node.id)}`);
    if (element !== null) return element;
    const newElement = document.createElementNS(svgNS, 'path') as SVGPathElement;
    newElement.id = node.id;
    newElement.classList.add('selectable');
    connectors.appendChild(newElement);
    return newElement;
}

const reconsile = (diagram: Diagram) => {
    root.querySelectorAll('g').forEach(element => {
        if (element.id !== 'connectors' && !diagram.root.children[element.id]) {
            root.removeChild(element);
        }
    });

    for (const id in diagram.root.children) {
        if (Object.prototype.hasOwnProperty.call(diagram.root.children, id)) {
            
            const node = diagram.root.children[id];
            const element = getOrCreateElement(node);
            element.setAttribute('transform', `translate(${node.x},${node.y})`);

            element.querySelector('text').textContent = node.content;
        }
    }

    connectors.querySelectorAll('path').forEach(element => {
        if (!diagram.root.connectors[element.id]) {
            connectors.removeChild(element);
        }
    });

    for (const id in diagram.root.connectors) {
        if (Object.prototype.hasOwnProperty.call(diagram.root.connectors, id)) {
            const connector = diagram.root.connectors[id];
            const element = getOrCreateConnector(connector);
            const fromPosition: Vector2 = { x: connector.from.x, y: connector.from.y };
            const toPosition: Vector2 = { x: connector.to.x, y: connector.to.y };

            const lineWidth = 1/2.0;
            if (Math.abs(fromPosition.y - toPosition.y) > Math.abs(fromPosition.x - toPosition.x)) {
                element.setAttribute('d', `M ${fromPosition.x-lineWidth} ${fromPosition.y-lineWidth} H ${fromPosition.x+lineWidth} V ${toPosition.y-lineWidth} H ${fromPosition.x-lineWidth} Z M ${fromPosition.x-lineWidth} ${toPosition.y-lineWidth} V${toPosition.y+lineWidth} H ${toPosition.x-lineWidth} V ${toPosition.y-lineWidth} Z`);
            } else {
                element.setAttribute('d', `M ${fromPosition.x-lineWidth} ${fromPosition.y-lineWidth} V ${fromPosition.y+lineWidth} H ${toPosition.x-lineWidth} V ${fromPosition.y-lineWidth} Z M ${toPosition.x-lineWidth} ${fromPosition.y-lineWidth} H${toPosition.x+lineWidth} V ${toPosition.y-lineWidth} H ${toPosition.x-lineWidth} Z`);
//                element.setAttribute('d', `M ${fromPosition.x-lineWidth} ${fromPosition.y-lineWidth} V${toPosition.y+lineWidth} H ${toPosition.x-lineWidth} V ${toPosition.y-lineWidth} Z M ${fromPosition.x-lineWidth} ${fromPosition.y-lineWidth} H ${fromPosition.x+lineWidth} V ${toPosition.y-lineWidth} H ${fromPosition.x-lineWidth} Z`);
            }
        }
    }
}

document.getElementById('add').addEventListener('click', () => {
    const nodeId = nanoid().replace('-', '.');
    diagram.root.children[nodeId] = ({ id: nodeId, children: {}, x: 50, y: 50, content: '', connectors: {} });
    reconsile(diagram);
    sendData(JSON.stringify({ username: 'James', type: 'add', id: nodeId, x: 50, y: 50 }));
});

document.getElementById('export').addEventListener('click', () => {
    var image = new Image();
    var canvas = document.createElement("canvas");
    var ctx = canvas.getContext('2d');
    image.src = `data:image/svg+xml;base64,${btoa(svg.outerHTML)}`;
    image.onload = () => {
        canvas.width = image.width;
        canvas.height = image.height;
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(image, 0, 0);
        var url = canvas.toDataURL('image/png');
        var a = document.createElement("a");
        a.href = url;
        a.setAttribute("download", 'export.png');
        a.click();
    };
});
