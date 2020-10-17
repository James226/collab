var svgNS = 'http://www.w3.org/2000/svg';

let selectedElement: SVGGraphicsElement = null;
let offset: Vector2 = null;

interface Vector2 {
    x: number;
    y: number;
}

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

    const [_, x, y] = selectedElement.getAttribute('transform').match(/translate\((\-?[\d]+),(\-?[\d]+)\)/)

    offset = getMousePosition(event);
    offset.x -= parseFloat(x);
    offset.y -= parseFloat(y);
};

const drag = (event: MouseEvent) => {
    event.preventDefault();
    if (selectedElement) {
        var coord = getMousePosition(event);
        selectedElement.setAttribute('transform', `translate(${coord.x - offset.x},${coord.y - offset.y})`);
    }
};

const endDrag = () => {
    if (!selectedElement) return;

    selectedElement.classList.remove('selected');
    selectedElement = null;
};

const svg = document.getElementById('canvas') as unknown as SVGGraphicsElement;
svg.addEventListener('mousedown', startDrag);
svg.addEventListener('mousemove', drag);
svg.addEventListener('mouseup', endDrag);
svg.addEventListener('mouseleave', endDrag);

const add = () => {
    var group = document.createElementNS(svgNS, 'g');
    group.setAttribute('transform', 'translate(50,50)');
    group.setAttribute('class', 'draggable');
    svg.appendChild(group);

    var shape = document.createElementNS(svgNS,'rect');
    shape.setAttribute('id','mycircle');
    shape.setAttribute('width','50');
    shape.setAttribute('height','50');
    shape.setAttribute('fill','transparent');
    shape.setAttribute('stroke-width', '1');
    group.appendChild(shape);

    var text = document.createElementNS(svgNS, 'text');
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('alignment-baseline', 'middle');
    text.setAttribute('x', '25');
    text.setAttribute('y', '25');
    text.setAttribute('width', '50');
    text.textContent = 'Misha';
    group.appendChild(text);
};

add();

document.getElementById('add').addEventListener('click', add);