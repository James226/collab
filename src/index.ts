var svgNS = 'http://www.w3.org/2000/svg';

let selectedElement: SVGGraphicsElement = null;
let offset: Vector2 = null;

interface Vector2 {
    x: number;
    y: number;
}

interface DiagramNode {
    id: string
    children: { [id: string] : DiagramNode; }
    x: number
    y: number
    content: string
}

interface Diagram {
    root: DiagramNode
}

let socket = new WebSocket("ws://127.0.0.1:3000/ws");
//let socket = new WebSocket("ws://34.107.148.107/ws");
//let socket = new WebSocket("wss://jachaela-recipe-book.ew.r.appspot.com/ws");
console.log("Attempting Connection...");

socket.onopen = () => {
    console.log("Successfully Connected");
    socket.send(JSON.stringify({username: 'James', message: 'Hello world!'}))
};

socket.onclose = event => {
    console.log("Socket Closed Connection: ", event);
};

socket.onerror = error => {
    console.log("Socket Error: ", error);
};

let diagram: Diagram = {
    root: {
        id: 'root',
        children: {},
        x: 0,
        y: 0,
        content: ''
    }
}

socket.onmessage = e => {
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
                diagram.root.children[id] = ({ id, children: {}, x, y, content: '' });
                break;
            }

        case 'setContent':
            {
                const { id, content } = message;
                const node = diagram.root.children[id];
                node.content = content;
                break;
            }

        case 'diagram':
            {
                diagram = message.diagram;
                break;
            }
        default:
            console.log('Unknown message received', message);
    }

    reconsile(diagram);
}

setInterval(() => {
    socket.send(JSON.stringify({ username: 'James', type: 'heartbeat' }))
}, 10000);

const findDraggableElement = (element: HTMLElement): HTMLElement | null  => {
    if (element.classList.contains('draggable')) {
        return element;
    }

    if (!element.parentElement) return null;

    return findDraggableElement(element.parentElement);
}

const getMousePosition = (evt: MouseEvent): Vector2 => {
    var CTM = svg.getScreenCTM();
    return {
      x: (evt.clientX - CTM.e) / CTM.a,
      y: (evt.clientY - CTM.f) / CTM.d
    };
  }

const startDrag = (event: MouseEvent) => {
    const target = event.target as HTMLElement;

    const draggableElement = findDraggableElement(target);

    if (!draggableElement) return;

    selectedElement = draggableElement as unknown as SVGGraphicsElement;
    draggableElement.classList.add('selected');

    const [_, x, y] = selectedElement.getAttribute('transform').match(/translate\((\-?[\d\.]+),(\-?[\d\.]+)\)/)

    offset = getMousePosition(event);
    offset.x -= parseFloat(x);
    offset.y -= parseFloat(y);
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
        selectedElement.setAttribute('transform', `translate(${x},${y})`);
    }
};

const endDrag = () => {
    if (!selectedElement) return;

    const [_, rawX, rawY] = selectedElement.getAttribute('transform').match(/translate\((\-?[\d\.]+),(\-?[\d\.]+)\)/)
    const id = selectedElement.id;

    const x = parseFloat(rawX);
    const y = parseFloat(rawY);

    const node = diagram.root.children[id];
    node.x = x;
    node.y = y;

    reconsile(diagram);

    socket.send(JSON.stringify({ username: 'James', type: 'translate', id, x, y }));

    selectedElement.classList.remove('selected');
    selectedElement = null;
};

const svg = document.getElementById('canvas') as unknown as SVGGraphicsElement;
svg.addEventListener('mousedown', startDrag);
svg.addEventListener('mousemove', drag);
svg.addEventListener('mouseup', endDrag);
svg.addEventListener('mouseleave', endDrag);

const root = document.createElementNS(svgNS, 'g');
root.setAttribute('id', 'root');
svg.appendChild(root);

let nodeCount = 0;

const add = (nodeId: string = null, x: number = 50, y: number = 50): Element => {
    const id = `${nodeId}`;
    var group = document.createElementNS(svgNS, 'g');
    group.setAttribute('id', id);
    group.setAttribute('transform', `translate(${x},${y})`);
    group.setAttribute('class', 'draggable');
    root.appendChild(group);

    var shape = document.createElementNS(svgNS,'rect');
    shape.setAttribute('id','mycircle');
    shape.setAttribute('width','80');
    shape.setAttribute('height','40');
    shape.setAttribute('fill','white');
    shape.setAttribute('stroke-width', '1');
    shape.setAttribute('stroke', 'black');
    group.appendChild(shape);

    

    var text = document.createElementNS(svgNS, 'text');
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('alignment-baseline', 'middle');
    text.setAttribute('x', '40');
    text.setAttribute('y', '20');
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
            socket.send(JSON.stringify({ username: 'James', type: 'setContent', id, content }));
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

    nodeCount++;

    return group;
};

const getOrCreateElement = (node: DiagramNode): Element => {
    const element = root.querySelector(`#${node.id}`);
    if (element !== null) return element;
    return add(node.id, node.x, node.y);
}

const reconsile = (diagram: Diagram) => {
    root.querySelectorAll('g').forEach(element => {
        if (!diagram.root.children[element.id as string]) {
            root.removeChild(element);
        }
    });

    for (const id in diagram.root.children) {
        if (Object.prototype.hasOwnProperty.call(diagram.root.children, id)) {
            const node = diagram.root.children[id];
            const element = getOrCreateElement(node);
            element.setAttribute('transform', `translate(${node.x},${node.y})`);

            // const textNode = element.getElementsByClassName('c-texteditor__text')[0] as HTMLElement;
            // textNode.innerText = node.content;
            element.querySelector('text').textContent = node.content;
        }
    }
}

document.getElementById('add').addEventListener('click', () => {
    const nodeId = `node${nodeCount}`;
    diagram.root.children[nodeId] = ({ id: nodeId, children: {}, x: 50, y: 50, content: '' });
    reconsile(diagram);
    socket.send(JSON.stringify({ username: 'James', type: 'add', id: nodeId, x: 50, y: 50 }));
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