export {
    SmootScroll,
    AnimationControl,
    loadData,
    setStartPositionAndScroll,
    redirectToTarget,
    transition,
    webGL
};

import { drawProjects } from './work.js';

let webGL = {};

window.addEventListener("popstate", redirectToTarget);

window.addEventListener('resize', resize());

document.addEventListener('DOMContentLoaded', () => {
    setDataWebGL();
    document.getElementById('main').prepend(webGL.data.canvas);
    insertPageContent(window.location.pathname.slice(1));
    document.querySelectorAll('.menu-item').forEach(item =>
        item.addEventListener('click', redirectToTarget));
    document.querySelector('.menu-call').addEventListener('click', () => {
        document.onclick = event => {
            let menuItemGroup = document.querySelector('.menu-item-group');
            if (!menuItemGroup.classList.contains('show-adaptive-menu')) {
                menuItemGroup.classList.add('show-adaptive-menu');
                menuItemGroup.classList.remove('hide-adaptive-menu');
            } else if (!event.target.closest('.menu-item-group')) {
                menuItemGroup.classList.add('hide-adaptive-menu');
                menuItemGroup.classList.remove('show-adaptive-menu');
                document.onclick = null;
            }
        }
    });
});

class SmootScroll {
    constructor(scrollable, speed) {
        this.scrollable = scrollable;
        this.speed = speed || .15;
    }
    position = 0;
    animation;
    customHandler;
    animate = () => {
        if (window.scrollY == this.position) {
            window.cancelAnimationFrame(this.animation);
            this.animation = null;
        } else {
            let position = (window.scrollY - this.position) * this.speed;
            this.animation = window.requestAnimationFrame(this.animate);
            this.position += window.scrollY < this.position ? Math.floor(position) : Math.ceil(position);
            this.scrollable.style.transform = `matrix(1,0,0,1,0,${-this.position})`;
            if (this.customHandler)
                this.customHandler(this.position);
        }
    }
    addListener = () => {
        let isLocked;
        window.onscroll = () => {
            if (!document.body.hasAttribute('data-resizing')) {
                if (!isLocked) {
                    isLocked = true;
                    setTimeout(() => {
                        if (!this.animation)
                            this.animate();
                        isLocked = false;
                    }, 50);
                }
            } else {
                this.position += window.scrollY - this.position;
                this.scrollable.style.transform = `matrix(1,0,0,1,0,${-this.position})`;
            }
        }
    }
    removeListener = () =>
        window.onscroll = null;
}

class AnimationControl {
    static id;
    static run(options = { duration, iteration, timing, preliminary, draw }, callback) {
        if (options) {
            let startTime = performance.now(),
                animate = () => {
                    let progress = (performance.now() - startTime) / options.duration;
                    options.iteration
                        ? this.id = requestAnimationFrame(animate)
                        : progress >= 1
                            ? progress = 1
                            : this.id = requestAnimationFrame(animate);
                    options.draw(options.timing(progress));
                    if (progress == 1 && callback && !options.iteration)
                        callback();
                };
            if (options.preliminary)
                options.preliminary();
            animate(startTime);
        } else {
            let animate = () => {
                callback();
                this.id = requestAnimationFrame(animate);
            }
            animate();
        }
    }
    static cancel() {
        cancelAnimationFrame(this.id);
        this.id = null;
    }
}

class ClickEffect {
    static id;
    static texture;
    static cropCoord;
    static options = {
        duration: 800,
        iteration: false,
        timing: progress => progress < .5 ? 4 * Math.pow(progress, 3) : 1 - Math.pow(-2 * progress + 2, 3) / 2,
        preliminary: () => {
            this.id = document.querySelector('.page-2 [data-enable="true"]').getAttribute('data-id');
            this.texture = webGL.data.createAndSetupTexture(new Uint8Array([10, 10, 10, 1]));
        },
        draw: progress => {
            webGL.data.prepareCanvas();
            for (let i = 0; i < 3; i++) {
                let texture;
                if (i === 1) {
                    webGL.uniform.u_Band.value = progress < .5 ? -.8 * progress : -.8 * (1 - progress);
                    webGL.uniform.u_CropCoord.value = 0;
                    webGL.uniform.u_Matrix.value = Matrix_4x4.multiply(
                        Matrix_4x4.setPerspectiveProjection(),
                        Matrix_4x4.setView(),
                        Matrix_4x4.setTranslate(0, 1.14 - 1.14 * progress, -2)); // -2 + 1.8443 * progress 
                    texture = this.texture;
                } else {
                    webGL.uniform.u_Band.value = 0;
                    webGL.uniform.u_CropCoord.value = i === 0 ? 0 : this.cropCoord;
                    webGL.uniform.u_Matrix.value = Matrix_4x4.multiply(
                        Matrix_4x4.setPerspectiveProjection(),
                        Matrix_4x4.setView(),
                        Matrix_4x4.setTranslate(0, 0, -2));
                    texture = webGL.texture[this.id];
                }
                webGL.data.drawFrame(webGL.program, webGL.geometry, webGL.uniform, texture);
            }
        }
    }
}

function resize() {
    let timer, block;
    return function () {
        let resizing = document.querySelector('.resizing'),
            pathname = window.location.pathname.slice(1);
        clearTimeout(timer);
        timer = setTimeout(() => {
            let scrollable = document.getElementById('scrollable');
            setTimeout(() => {
                block = false;
                document.body.removeAttribute('data-resizing');
                resizing.removeAttribute('style');
                if (pathname === 'home')
                    document.querySelector('.no-transition')?.classList.remove('no-transition');
            }, 100);
            document.body.style.height = `${scrollable.parentNode.clientHeight + scrollable.parentNode.offsetTop}px`;
            webGL.data.canvas.width = window.innerWidth;
            webGL.data.canvas.height = window.innerHeight;
            if ('home work'.includes(pathname)) {
                setGeometry();
                webGL.data.prepareCanvas(null, true);
                if (pathname === 'home') {
                    let pageNumber = +window.sessionStorage.getItem('pageNumber'),
                        page = document.querySelector(`.page-${pageNumber}`);
                    if (pageNumber === 1 || pageNumber === 3) {
                        let itemGroup = page.querySelector('.item-title-group'),
                            position;
                        // ?????????????????
                        if ([-100, -300, -500, -900].includes(new WebKitCSSMatrix(getComputedStyle(itemGroup).transform).m42))
                            position = -itemGroup.offsetParent.offsetTop;
                        else position = -itemGroup.offsetParent.offsetTop - itemGroup.offsetTop;
                        page.querySelector('[data-enable="true"]').style.transform = `matrix(1,0,0,1,0,${position})`;
                    } else if (pageNumber === 2) {
                        if (document.querySelector('.hide-current-item')) {
                            webGL.uniform.u_AnimationMode.value = 2;
                            openProject();
                        } else webGL.data.drawFrame(webGL.program, webGL.geometry, webGL.uniform, webGL.texture[0]);
                    }
                } else {
                    webGL.uniform.u_AnimationMode.value = 2;
                    document.querySelector('.hide-current-item')
                        ? openProject()
                        : drawProjects(false, window.scrollY);
                }
            }
            if (document.body.clientWidth > 520)
                document.querySelector('.menu-item-group').className = 'menu-item-group';
        }, 200);
        if (!block) {
            block = true;
            document.body.setAttribute('data-resizing', '');
            resizing.style.visibility = 'visible';
            if (pathname === 'home') {
                let pageNumber = +window.sessionStorage.getItem('pageNumber');
                if (pageNumber === 1 || pageNumber === 3)
                    document.querySelector(`.page-${pageNumber} [data-enable="true"]`).classList.add('no-transition');
            }
        }
    }
}

function insertPageContent(pathname) {
    let startTime = performance.now(),
        module = import(`./${pathname}.js`);
    loadData('node', `./templates/${pathname}.html`).then(response => {
        let currentTime = performance.now() - startTime,
            main = document.getElementById('main'),
            canvas = document.getElementById('canvas_webgl');
        setTimeout(() => {
            module.then(response =>
                response[pathname]());
            response.querySelectorAll('.redirection').forEach(item =>
                item.addEventListener('click', redirectToTarget));
            if (AnimationControl.id)
                AnimationControl.cancel();
            if ('home work'.includes(pathname)) {
                setGeometry();
                webGL.data.prepareCanvas(null, true);
            }
            if (pathname == 'home')
                main.removeAttribute('data-state');
            else main.setAttribute('data-state', 'belowe');
            if (pathname == 'work')
                Object.assign(canvas.style, {
                    visibility: 'visible',
                    top: 0
                });
            else canvas.style.visibility = 'hidden';
            main.removeAttribute('style');
            document.getElementById('scrollable').replaceChildren(response);
            setStartPositionAndScroll(pathname);
        }, currentTime < 300 ? 300 - currentTime : 0);
    });
}

function redirectToTarget(event) {
    let main = document.getElementById('main'),
        pathname;
    event.preventDefault();
    if (event.type !== 'popstate') {
        pathname = event.currentTarget.pathname.slice(1);
        window.history.pushState(null, null, pathname);
        if (event.currentTarget.classList.contains('redirection'))
            event.currentTarget.classList.add('disable');
    } else pathname = event.target.location.pathname.slice(1);
    if (window.onscroll instanceof Function)
        window.onscroll = null;
    if (window.onwheel instanceof Function)
        window.onwheel = null;
    if (!document.querySelector(`link[href*="${pathname}"]`))
        document.head.insertAdjacentHTML('beforeend', `<link rel="stylesheet" href="./styles/${pathname}.css">`);
    Object.assign(main.style, {
        opacity: getComputedStyle(main).opacity,
        transform: getComputedStyle(main).transform
    });
    main.setAttribute('data-state', 'hidden');
    document.title = `${pathname[0].toUpperCase() + pathname.slice(1)}`;
    document.querySelector('.menu').classList.remove('hide-current-item');
    document.querySelector('.current-item').classList.remove('current-item');
    document.querySelector(`.menu-item[href=${pathname}]`).classList.add('current-item');
    insertPageContent(pathname);
}

function setDataWebGL() {
    let projects = document.body.getAttribute('data-project').toUpperCase().split(',');
    webGL.data = new WebGL();
    webGL.data.prepareCanvas({ r: 10, g: 10, b: 10, a: 1 }); // <---
    Promise.all(['vertex', 'fragment'].map(name =>
        loadData('text', `./shaders/${name}_shader.glsl`))).then(response => {
            webGL.program = webGL.data.createShaderProgram(response[0], response[1]);
            webGL.texture = new Array(projects.length).fill(webGL.data.createAndSetupTexture(new Uint8Array([238, 238, 238, 1])));
            new FontFace('Special', 'url(./fonts/Special.woff2)').load().then(responce => {
                document.fonts.add(responce);
                for (let i = 0; i < projects.length; i++)
                    setTimeout(() => webGL.texture[i] = webGL.data.createAndSetupTexture(getImageOnCanvas(projects[i], 1400, 700)));
            });
        });
}

function setGeometry(width, height) {
    let geometryWidth = width ?? Math.min(document.getElementById('scrollable').clientWidth, window.location.pathname == '/home' ? 1100 : 1400),
        geometryHeight = height ?? geometryWidth / 2,
        segmentsByWidth = Math.round(geometryWidth / 72), // 72
        segmentsByHeight = Math.round(window.location.pathname == '/home' ? segmentsByWidth : geometryHeight / 72); // 72
    webGL.geometry = WebGLGeometry.createPlane(webGL.data.canvas, geometryWidth, geometryHeight, segmentsByWidth, segmentsByHeight, true);
    webGL.data.initializeBuffer(webGL.geometry, true);
    webGL.data.setAttribute(webGL.program, webGL.geometry, { a_Position: 2, a_TextureCoords: 2 });
    webGL.uniform = setDefaultUniform();
}

function setDefaultUniform() {
    return {
        u_AnimationMode: { type: 'int', value: 0 },
        u_Distance: { type: 'float', value: 0 },
        u_Distortion: { type: 'float', value: 0 },
        u_Progress: { type: 'float', value: 0 },
        u_Band: { type: 'float', value: 0 },
        u_Wave: { type: 'float', value: 0 },
        u_CanvasWidthRatio: { type: 'float', value: Math.max(-1 / 500 * webGL.data.canvas.clientWidth + 6, 2) }, // уравнение прямой линии (y = kx + b)
        u_Matrix: {
            type: 'mat4',
            value: Matrix_4x4.multiply(
                Matrix_4x4.setPerspectiveProjection(),
                Matrix_4x4.setView(),
                Matrix_4x4.setTranslate(0, 0, -2))
        }
    }
}

function setStartPositionAndScroll(pathname, height) {
    let scrollable = document.getElementById('scrollable');
    scrollable.style.transform = 'matrix(1,0,0,1,0,0)';
    if ('work contacts'.includes(pathname) || pathname === true) {
        new SmootScroll(scrollable).addListener();
        document.body.style.height = `${height ?? scrollable.parentNode.clientHeight}px`;
        window.scrollTo(0, 0);
    } else {
        window.onscroll = null;
        document.body.style.height = 0;
    }
}

async function loadData(responseType, URL) {
    let response = await fetch(URL);
    switch (responseType) {
        case 'node':
            let temp = document.createElement('template');
            temp.innerHTML = await response.text();
            return temp.content;
        case 'text':
            return response.text();
        case 'bitmap':
            let blob = await response.blob();
            return createImageBitmap(blob, { imageOrientation: "flipY" });
        default: throw new TypeError('Incorrect response type specified');
    }
}

// -------------------------------------------
// FROM HOME AND WORK
// -------------------------------------------

function transition(event) {
    event.preventDefault();
    let startTime = performance.now(),
        pathname = window.location.pathname,
        time = pathname === '/home' ? 1100 : 300,
        canvas = document.createElement('canvas'),
        context = canvas.getContext('2d'),
        text;
    loadData('node', `./templates/work/${event.currentTarget.pathname}.php`).then(response => {
        let currentTime = performance.now() - startTime;
        setTimeout(() => {
            setTimeout(() => {
                let currentItem = document.querySelector('.current-item'),
                    children = currentItem.parentElement.children,
                    back = document.querySelector('.back-item');
                for (let i = 0; i < children.length; i++)
                    if (children[i] === currentItem)
                        back.style.left = `calc(100% * ${1 / children.length * i})`;
                document.querySelector('.menu').classList.add('hide-current-item');
                back.addEventListener('click', backToListWorks);
                document.getElementById('main').setAttribute('data-state', 'belowe');
                document.querySelectorAll('video[data-ratio]').forEach(video => video.play());
                webGL.uniform = setDefaultUniform();
                webGL.uniform.u_AnimationMode.value = 2;

            }, 100);
            document.getElementById('scrollable').replaceChildren(response);
            document.getElementById('canvas_webgl').style.top = 0;
            openProject(true);
        }, currentTime < time ? time - currentTime : 0);
    });
    if (pathname === '/home') {
        canvas.setAttribute('width', 1400);
        canvas.setAttribute('height', 700);
        context.font = '180px Special';
        text = document.querySelector('.page-2 [data-enable="true"]').textContent;
        window.onwheel = null;
        webGL.uniform.u_CropCoord = { type: 'float', value: 0 };
        ClickEffect.cropCoord = (canvas.width - context.measureText(text.toUpperCase()).width) / canvas.width / 2;
        AnimationControl.run(ClickEffect.options, () => {
            document.getElementById('main').setAttribute('data-state', 'hidden');
            webGL.uniform.u_CropCoord.value = 0;
        });
        Object.assign(document.querySelector('.project-source').style, {
            pointerEvents: 'none',
            cursor: 'default'
        });
    } else document.getElementById('main').setAttribute('data-state', 'hidden');
}

function openProject(onload) {
    let mediaAll = document.querySelectorAll('img[data-ratio],video[data-ratio]'),
        scroll = new SmootScroll(document.getElementById('scrollable')),
        grid = document.querySelector('.grid'),
        matrix = Matrix_4x4.multiply(Matrix_4x4.setPerspectiveProjection(), Matrix_4x4.setView()),
        texture = webGL.data.createAndSetupTexture(new Uint8Array([238, 238, 238, 1])),
        data = [],
        overallHeight = 0,
        margin = window.innerWidth < 1200 ? window.innerWidth * .05 : 60;
    mediaAll.forEach((source, index) => {
        let geometryWidth = source.clientWidth,
            geometryHeight = Math.round(source.clientWidth * source.getAttribute('data-ratio')),
            canvasRatio = webGL.data.canvas.clientWidth / webGL.data.canvas.clientHeight,
            segmentsByWidth = Math.round(geometryWidth / 72),
            segmentsByHeight = Math.round(geometryHeight / 72),
            top, left;
        source.style.height = `${geometryHeight}px`;
        [top, left] = WebGLHelper.convertCoords(webGL.data.canvas, source.offsetTop + source.offsetParent.offsetTop, source.getBoundingClientRect().left);
        data[index] = {
            geometry: WebGLGeometry.createPlane(webGL.data.canvas, geometryWidth, geometryHeight, segmentsByWidth, segmentsByHeight, true, true, true),
            top: top * canvasRatio,
            left: left / canvasRatio,
            y: -top * canvasRatio,
            texture: texture
        }
        if (onload)
            ['load', 'canplay'].forEach(eventName => {
                source.addEventListener(eventName, () => {
                    if (eventName === 'canplay')
                        data[index].source = source;
                    data[index].texture = webGL.data.createAndSetupTexture(source);
                    source.removeAttribute('style');
                }, { once: true });
            });
        else {
            if (source.localName == 'video')
                data[index].source = source;
            data[index].texture = webGL.data.createAndSetupTexture(source);
            source.removeAttribute('style');
        }
        if (!source.parentElement.classList.contains('mobile') && !source.parentElement.nextElementSibling?.classList.contains('wide-mobile')) {
            overallHeight += geometryHeight;
            if (index !== mediaAll.length - 1)
                overallHeight += margin;
        }
    });
    setStartPositionAndScroll(true, grid.offsetTop + overallHeight + parseFloat(getComputedStyle(grid).marginBottom));
    scroll.customHandler = position => {
        let progress = (window.scrollY - position) * .00045;
        for (let i = 0; i < data.length; i++)
            data[i].y = -data[i].top + position / (webGL.data.canvas.clientHeight / 2);
        webGL.uniform.u_Band.value = progress >= 0 ? Math.min(progress, .06) : Math.max(progress, -.06);
        webGL.uniform.u_Progress.value = Math.max(-Math.abs(progress * 4.5), -.45);
    };
    scroll.addListener();
    AnimationControl.cancel();
    AnimationControl.run(null, () => {
        webGL.data.prepareCanvas();
        for (let i = 0; i < data.length; i++) {
            webGL.data.initializeBuffer(data[i].geometry);
            webGL.uniform.u_Matrix.value = Matrix_4x4.multiply(matrix, Matrix_4x4.setTranslate(data[i].left, data[i].y, -2));
            webGL.data.drawFrame(webGL.program, data[i].geometry, webGL.uniform, data[i].source ? webGL.data.updateTexture(data[i].texture, data[i].source) : data[i].texture);
        }
    });
}

function getImageOnCanvas(text, width, height) {
    let canvas = document.createElement('canvas'),
        context = canvas.getContext('2d'),
        string = `  ${text}`,
        lineOffset, textWidth, count;
    canvas.setAttribute('width', width);
    canvas.setAttribute('height', height);
    context.font = '180px Special';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    textWidth = context.measureText(string).width;
    lineOffset = height / 4;
    count = Math.ceil(width / textWidth);
    context.fillStyle = '#0a0a0a';
    context.fillRect(0, 0, width, height);
    context.fillStyle = '#eeeeee';
    for (let i = 0; i < count; i++)
        text += string;
    for (let i = 0; i < 5; i++)
        count % 2 === 0
            ? i % 2 === 0
                ? context.fillText(text, width / 2, lineOffset * i)
                : context.fillText(text, (width + textWidth) / 2, lineOffset * i)
            : i % 2 === 0
                ? context.fillText(text, (width + textWidth) / 2, lineOffset * i)
                : context.fillText(text, width / 2, lineOffset * i);
    return canvas;
}

function backToListWorks(event) {
    event.preventDefault();
    document.querySelector('.menu').classList.remove('hide-current-item');
    document.getElementById('main').setAttribute('data-state', 'hidden');
    insertPageContent(window.location.pathname.slice(1));
}