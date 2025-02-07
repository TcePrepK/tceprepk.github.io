const RandGandBToHex = function (R, G, B) {
    var r = colorToHex(R);
    var g = colorToHex(G);
    var b = colorToHex(B);
    return r + g + b;
};

const colorToHex = function (color) {
    var hex = Number(color).toString(16);
    if (hex.length < 2) {
        hex = "0" + hex;
    }
    return hex;
};

const defaultColors = {
    r: "ff666a",
    g: "78ff66",
    b: "66a7ff",
    p: "dd66ff",
    c: "00fcff",
    y: "fcf52a",
    u: "aaa",
    w: "fff",
    k: "000",
};

let scale = 1;

/** @enum {string} */
const enumSubShape = {
    rect: "rect",
    circle: "circle",
    star: "star",
    windmill: "windmill",
};

/** @enum {string} */
const enumSubShapeToShortcode = {
    [enumSubShape.rect]: "R",
    [enumSubShape.circle]: "C",
    [enumSubShape.star]: "S",
    [enumSubShape.windmill]: "W",
};

/** @enum {enumSubShape} */
const enumShortcodeToSubShape = {};
for (const key in enumSubShapeToShortcode) {
    enumShortcodeToSubShape[enumSubShapeToShortcode[key]] = key;
}

const arrayQuadrantIndexToOffset = [
    { x: 1, y: -1 }, // tr
    { x: 1, y: 1 }, // br
    { x: -1, y: 1 }, // bl
    { x: -1, y: -1 }, // tl
];

CanvasRenderingContext2D.prototype.beginCircle = function (x, y, r) {
    if (r < 0.05) {
        this.beginPath();
        this.rect(x, y, 1, 1);
        return;
    }
    this.beginPath();
    this.arc(x, y, r, 0, 2.0 * Math.PI);
};

const canvas = /** @type {HTMLCanvasElement} */ (
    document.getElementById("result")
);

const code = document.getElementById("code");

const hexColor = document.getElementById("hexcolor");
hexColor.addEventListener("input", watchColorPicker, false);

/////////////////////////////////////////////////////

function radians(degrees) {
    return (degrees * Math.PI) / 180.0;
}

/**
 * Generates the definition from the given short key
 * @param {String} key
 */
function fromShortKey(key) {
    const sourceLayers = key.split(":");
    const layerAmount = sourceLayers.length;

    let layers = [];
    for (let i = 0; i < layerAmount; ++i) {
        let text = sourceLayers[i];
        let shapeString = text
            .replace(/(?=\().*?(?<=\))/gm, "")
            .replace(/--/gm, "-");

        if (shapeString.length == 1) {
            text += text.repeat(3);
            shapeString += shapeString.repeat(3);
        } else if (shapeString.length == 2) {
            text += text;
            shapeString += shapeString;
        } else if (shapeString.length != 4) {
            throw new Error("Shapez must have 4 corners");
        }

        if (text === "--".repeat(4)) {
            throw new Error("Empty layers are not allowed");
        }

        const emptyString = text.replace(/[^-]*/gm, "");
        if (emptyString.length % 2 != 0) {
            throw new Error("Invalid shape: " + text);
        }

        const quads = [null, null, null, null];
        for (let quad = 0; quad < 4; quad++) {
            const shapeText = shapeString[quad];
            const subShape = enumShortcodeToSubShape[shapeText];
            if (subShape) {
                quads[quad] = { subShape };
            } else if (shapeText !== "-") {
                throw new Error("Invalid shape key: " + shapeText);
            }
        }

        const colors = [...(text.matchAll(/(?<=\().*?(?=\))/gm) || [])];

        let emptyCornerAmount = 0;
        for (let quad = 0; quad < 4; quad++) {
            if (!quads[quad]) emptyCornerAmount++;
        }

        const emptyCorners = [...(text.matchAll(/--/gm) || [])];
        if (emptyCorners.length != emptyCornerAmount) {
            throw new Error("Invalid shape: " + text);
        }

        if (colors.length + emptyCornerAmount !== 4) {
            throw new Error(
                "Invalid color count: " + (colors.length + emptyCornerAmount)
            );
        }

        for (let i = 0; i < colors.length; i++) {
            const color = colors[i][0];
            colors[i] = color;

            const len = color.length;
            if (len !== 6 && len !== 3 && len !== 1) {
                throw new Error("Invalid color: " + color);
            } else if (len == 1) {
                const c = defaultColors[color];
                if (!c) {
                    throw new Error("Invalid color: " + color);
                }
                colors[i] = c;
            }
        }

        for (let quad = 0; quad < 4; quad++) {
            if (quads[quad]) {
                quads[quad].color = colors.shift();
            }
        }

        layers.push(quads);
    }

    return layers;
}

function updateScale(value) {
    const max = 512;

    if (value > 1) value = 1;
    if (value < 0.25) value = 0.25;
    scale = value;

    let size = max * value;
    canvas.width = size;
    canvas.height = size;
    generate();
}

function renderShape(layers) {
    const context = canvas.getContext("2d");

    context.save();
    context.clearRect(0, 0, 1000, 1000);

    const w = canvas.width;
    const h = canvas.height;
    const dpi = 1;

    context.translate((w * dpi) / 2, (h * dpi) / 2);
    context.scale((dpi * w) / 23, (dpi * h) / 23);

    context.fillStyle = "#e9ecf7";

    const quadrantSize = 10;
    const quadrantHalfSize = quadrantSize / 2;

    context.fillStyle = "rgba(40, 50, 65, 0.1)";
    context.beginCircle(0, 0, quadrantSize * 1.15);
    context.fill();

    const layerAmount = layers.length;
    for (let layerIndex = 0; layerIndex < layerAmount; ++layerIndex) {
        const quadrants = layers[layerIndex];

        let off = 0.22;
        if (layerAmount > 4)
            off = off - (off * (layerAmount - 4)) / (layerAmount - 1);
        const layerScale = Math.max(0.1, 0.9 - layerIndex * off);

        for (let quadrantIndex = 0; quadrantIndex < 4; ++quadrantIndex) {
            if (!quadrants[quadrantIndex]) {
                continue;
            }
            const { subShape, color } = quadrants[quadrantIndex];

            const quadrantPos = arrayQuadrantIndexToOffset[quadrantIndex];
            const centerQuadrantX = quadrantPos.x * quadrantHalfSize;
            const centerQuadrantY = quadrantPos.y * quadrantHalfSize;

            const rotation = radians(quadrantIndex * 90);

            context.translate(centerQuadrantX, centerQuadrantY);
            context.rotate(rotation);

            context.fillStyle = "#" + color;
            context.strokeStyle = "#555";
            context.lineWidth = 1;

            const insetPadding = 0.0;

            switch (subShape) {
                case enumSubShape.rect: {
                    context.beginPath();
                    const dims = quadrantSize * layerScale;
                    context.rect(
                        insetPadding + -quadrantHalfSize,
                        -insetPadding + quadrantHalfSize - dims,
                        dims,
                        dims
                    );

                    break;
                }
                case enumSubShape.star: {
                    context.beginPath();
                    const dims = quadrantSize * layerScale;

                    let originX = insetPadding - quadrantHalfSize;
                    let originY = -insetPadding + quadrantHalfSize - dims;

                    const moveInwards = dims * 0.4;
                    context.moveTo(originX, originY + moveInwards);
                    context.lineTo(originX + dims, originY);
                    context.lineTo(
                        originX + dims - moveInwards,
                        originY + dims
                    );
                    context.lineTo(originX, originY + dims);
                    context.closePath();
                    break;
                }

                case enumSubShape.windmill: {
                    context.beginPath();
                    const dims = quadrantSize * layerScale;

                    let originX = insetPadding - quadrantHalfSize;
                    let originY = -insetPadding + quadrantHalfSize - dims;
                    const moveInwards = dims * 0.4;
                    context.moveTo(originX, originY + moveInwards);
                    context.lineTo(originX + dims, originY);
                    context.lineTo(originX + dims, originY + dims);
                    context.lineTo(originX, originY + dims);
                    context.closePath();
                    break;
                }

                case enumSubShape.circle: {
                    context.beginPath();
                    context.moveTo(
                        insetPadding + -quadrantHalfSize,
                        -insetPadding + quadrantHalfSize
                    );
                    context.arc(
                        insetPadding + -quadrantHalfSize,
                        -insetPadding + quadrantHalfSize,
                        quadrantSize * layerScale,
                        -Math.PI * 0.5,
                        0
                    );
                    context.closePath();
                    break;
                }

                default: {
                    assertAlways(false, "Unkown sub shape: " + subShape);
                }
            }

            context.fill();
            context.stroke();

            context.rotate(-rotation);
            context.translate(-centerQuadrantX, -centerQuadrantY);
        }
    }

    context.restore();
}

function watchColorPicker(event) {
    const hexColor = document.getElementById("hexcolor");
    const hexLabel = document.getElementById("hexlabel");
    hexLabel.innerHTML = hexColor.value;
}

/////////////////////////////////////////////////////

function showError(msg) {
    const errorDiv = document.getElementById("error");
    errorDiv.classList.toggle("hasError", !!msg);
    if (msg) {
        errorDiv.innerText = msg;
    } else {
        errorDiv.innerText = "Shape generated";
    }
}

canvas.addEventListener("wheel", (event) => {
    const delta = event.wheelDelta;
    const off = delta > 0 ? 0.95 : 1.05;

    // scale *= off;

    updateScale(scale * off);
});

window.generate = () => {
    showError(null);

    let parsed = null;
    try {
        parsed = fromShortKey(code.value.trim());
    } catch (ex) {
        showError(ex);
        return;
    }

    renderShape(parsed);
};

window.debounce = (fn) => {
    setTimeout(fn, 0);
};

window.addEventListener("load", () => {
    if (window.location.search) {
        const key = window.location.search.substr(1);
        document.getElementById("code").value = key;
    }
    generate();
});

window.exportShape = () => {
    const imageURL = canvas.toDataURL("image/png");

    const dummyLink = document.createElement("a");
    dummyLink.download = "shape.png";
    dummyLink.href = imageURL;
    dummyLink.dataset.downloadurl = [
        "image/png",
        dummyLink.download,
        dummyLink.href,
    ].join(":");

    document.body.appendChild(dummyLink);
    dummyLink.click();
    document.body.removeChild(dummyLink);
};

window.viewShape = (key) => {
    document.getElementById("code").value = key;
    generate();
};

window.shareShape = () => {
    const code = document.getElementById("code").value.trim();
    const url = "https://tceprepk.github.io/shapez/ColorZ-ShapeViewer/?" + code;
    alert("You can share this url: " + url);
};

function getRandomInt(max) {
    return Math.floor(Math.random() * Math.floor(max));
}

function getRandomShape() {
    let shapes = Object.values(enumSubShapeToShortcode);
    shapes.push("-");
    return shapes[getRandomInt(shapes.length)];
}

function getRandomColor() {
    const r = getRandomInt(255);
    const g = getRandomInt(255);
    const b = getRandomInt(255);
    return RandGandBToHex(r, g, b);
}

window.randomShape = () => {
    let layers = getRandomInt(4);
    let code = "";
    for (var i = 0; i <= layers; i++) {
        let layertext = "";
        for (var y = 0; y <= 3; y++) {
            let randomShape = getRandomShape();
            let randomColor = "(" + getRandomColor() + ")";

            if (randomShape === "-") {
                randomColor = "-";
            }
            layertext = layertext + randomShape + randomColor;
        }
        //empty layer not allowed
        if (layertext === "--".repeat(4)) {
            i--;
        } else {
            code = code + layertext + ":";
        }
    }
    code = code.replace(/:+$/, "");
    document.getElementById("code").value = code;
    generate();
};
