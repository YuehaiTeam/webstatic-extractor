function extname(url) {
    if (url.indexOf('data:') === 0) {
        const mime = url.match(/data:([^;]+)/)[1];
        return mime.split('/')[1];
    }
    return url.split('.').pop();
}
function basename(url) {
    if (url.indexOf('data:') === 0) {
        return '';
    }
    return url.split('/').pop();
}
function createWebpackRequire(modules, base = '') {
    const installedModules = {};
    function __webpack_require__(moduleId) {
        if (installedModules[moduleId]) return installedModules[moduleId].exports;
        var module = (installedModules[moduleId] = {
            exports: {},
            id: moduleId,
            loaded: false,
        });
        if (!modules[moduleId]) return '';
        modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
        module.loaded = true;
        return module.exports;
    }
    __webpack_require__.r = function (exports) {
        if (typeof Symbol !== 'undefined' && Symbol.toStringTag) {
            Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
        }
        Object.defineProperty(exports, '__esModule', { value: true });
    };
    __webpack_require__.o = function (object, property) {
        return Object.prototype.hasOwnProperty.call(object, property);
    };
    __webpack_require__.d = function (exports, name, getter) {
        if (!getter) {
            const definition = name;
            for (var key in definition) {
                if (__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
                    Object.defineProperty(exports, key, {
                        enumerable: true,
                        get: definition[key],
                    });
                }
            }
            return;
        }
        if (!__webpack_require__.o(exports, name)) {
            Object.defineProperty(exports, name, { enumerable: true, get: getter });
        }
    };

    __webpack_require__.c = installedModules;
    __webpack_require__.p = base;
    return __webpack_require__;
}
function extractSpine(modules, url = '', w = window) {
    const maybeFuncs = [];
    Object.keys(modules).forEach((k) => {
        const e = modules[k];
        const et = e.toString();
        if (et.includes('atlas:') && et.includes('json:')) maybeFuncs.push(k);
    });
    console.log('[extractSpine] Detected Top-Level Modules:', maybeFuncs);
    console.log(modules);
    const webpackRequire = createWebpackRequire(modules, url);
    const insideModules = [];
    w.Object._defineProperty = Object.defineProperty;
    w.Object.defineProperty = (module, __esmodule, value) => {
        if (__esmodule === '__esModule') {
            insideModules.push(module);
        }
        return w.Object._defineProperty(module, __esmodule, value);
    };
    const globalThis = window;
    const maybeModules = maybeFuncs.map((e) => webpackRequire(e));
    w.Object.defineProperty = Object._defineProperty;
    const spines = [];
    const mains = [];
    console.log('Detected Sub-Level Modules:', insideModules);
    const checkva = (va, name) => {
        console.log(va, name);
        const vk = Array.isArray(va) ? 0 : Object.keys(va)[0];
        let v = va[vk];
        if (!v) return;
        if (typeof v !== 'object') {
            v = va;
        }
        if (v.atlas && v.json) {
            spines.push(va);
            Object.values(va).forEach((v) => {
                v.module = name || v.module || '';
            });
            return;
        }
        if (v.id && v.src && v.type) {
            mains.push(va);
            va.forEach((v) => {
                v.module = name || v.module || '';
            });
        }
    };
    insideModules.forEach((e) => {
        const ek = Object.keys(e);
        ek.forEach((k) => {
            if (k.includes && k.includes('_MANIFEST')) {
                const obj = e[k];
                const name = k.replace('_MANIFEST', '');
                if (Array.isArray(obj)) {
                    checkva(obj, '_' + name);
                } else {
                    Object.values(obj).forEach((e) => checkva(e, name));
                }
            }
        });
    });
    let mains_arr = mains.reduce((b, a) => a.concat(b), []);
    mains_arr = mains_arr.filter((e) => {
        if (mains_arr.find((p) => e.src === p.src) && e.module.startsWith('_')) {
            return false;
        }
        return true;
    });
    return {
        SPINE_MANIFEST: spines.reduce((b, a) => Object.assign(a, b), {}),
        MAIN_MANIFEST: mains_arr,
    };
}
function extractStaticFiles(modules, base) {
    const matches = [];
    Object.keys(modules).forEach((k) => {
        const e = modules[k];
        const et = e.toString();
        const match = et.match(/[a-zA-Z0-9]\.exports\s?=\s?([a-zA-Z0-9]\.[a-zA-Z0-9]\s?\+)?\s?"(.*?)"/);
        if (match) {
            const url = match[2];
            if (!url.startsWith('data:') && !match[1]) {
                return;
            }
            let bname = basename(url);
            if (bname) {
                const a = bname.split('.');
                a.pop(); // remove extension
                if (a.length >= 2) {
                    // remove webpack hash
                    a.pop();
                }
                bname = a.join('.');
            } else {
                bname = k.replace(/\//g, '_').replace(/\./g, '_').replace(/\:/g, '_').replace(/\+/g, '_');
            }
            matches.push({
                id: bname,
                src: url.includes('data:') ? url : new URL(url, base).toString(),
                _module: k,
            });
        }
    });
    return matches;
}
async function fetchToZip(name, url) {
    const res = await fetch(url);
    const stream = () => res.body;
    return {
        name,
        stream,
    };
}
async function loadPageInIframe(url) {
    // fetch url and load by srcdoc
    const response = await fetch(url);
    let html = await response.text();
    if (html.includes('webpackJsonp')) {
        html = html.replace(new RegExp(`<script type="text/javascript">`, 'g'), `<script type="text/dontexecute">`);
    } else {
        let entrName = '';
        if (html.includes('Symbol.toStringTag') && html.includes('Object.defineProperty')) {
            // modified webpackjsonp name in html
            // parse to dom
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const script = doc.querySelectorAll('script');
            script.forEach((s) => {
                if (s.src.includes('sentry') || s.textContent.includes('Sentry') || s.textContent.includes('firebase'))
                    s.type = 'text/dontexecute';
                if (s.textContent.includes('Symbol.toStringTag') && s.textContent.includes('Object.defineProperty')) {
                    s.type = 'text/dontexecute';
                    const matches = [...s.textContent.matchAll(/self\.(.*?)=self.(.*?)\|\|\[\]/g)];
                    for (const match of matches) {
                        if (match[1] == match[2]) {
                            if (entrName != '') {
                                alert(`Warning: Multiple entry points found: ${entrName} and ${match[1]}`);
                            }
                            entrName = match[1];
                        }
                    }
                }
            });
            html = doc.documentElement.outerHTML;
        }
        html = html.replace(
            `</head>`,
            `\<script\>
window.webpackJsonp_ = [];
window.cachedModules = [];
window.loadedModules = [];
window.webpackJsonpProxy = new Proxy(webpackJsonp_, {
get: (target, prop) => {
if (prop === 'push') {
    return (...args) => {
        console.log(args);
        cachedModules.push(...args);
    };
}
if (prop in target) {
    return target[prop];
}
return undefined;
},
set: (target, prop, value) => {
if (prop === 'push') {
    value(['inject',{
        inject(module, exports, __webpack_require__){
            loadedModules = __webpack_require__.m
        }
    },[['inject']]])
    console.log('set', prop, value);
    return true;
}
target[prop] = value;
return true;
},
});
Object.defineProperty(window, '${entrName || 'webpackJsonp'}', {
value: webpackJsonpProxy,
writable: true,
enumerable: false,
configurable: false,
});\</script\>`,
        );
    }
    let base = url;
    const matchVendors = html.match(/src="([^"]*?\/)vendors([^"]*?)js"/);
    console.log(matchVendors);
    if (matchVendors) {
        base = matchVendors[1];
    }
    if (!base.includes('://')) {
        base = new URL(base, url).toString();
    }
    html = html.replace('<head>', `<head><base href="${base}">`);
    const iframe = document.createElement('iframe');
    iframe.srcdoc = html;
    iframe.style.display = 'none';
    document.body.appendChild(iframe);
    return new Promise((resolve) => {
        iframe.onload = () => {
            resolve({ iframe, base });
        };
    });
}
const dirname = (path) => {
    const a = path.split('/');
    a.pop();
    return a.join('/');
};
async function extract(url) {
    btn.innerText = 'Fetching Page...';
    const { iframe: frame, base } = await loadPageInIframe(url);
    frame.contentWindow.regeneratorRuntime = regeneratorRuntime;
    btn.innerText = 'Extracting Data...';
    let modules = {};
    if (frame.contentWindow.cachedModules) {
        modules = {
            ...frame.contentWindow.loadedModules,
        };
        for (const i of frame.contentWindow.cachedModules) {
            modules = {
                ...modules,
                ...i[1],
            };
        }
    } else {
        const webpackJsonp = frame.contentWindow.webpackJsonp;
        console.log('found WebpackJsonp', webpackJsonp);
        const vendors = webpackJsonp.find((e) => e[0].includes('vendors'));
        if (!vendors) {
            btn.innerText = 'Load vendors.js faild!';
            return;
        }
        const Index = webpackJsonp.find((e) => e[0].includes('index'));
        if (!Index) {
            btn.innerText = 'Load index.js faild!';
            return;
        }
        const Runtime = webpackJsonp.find((e) => e[0].includes('runtime'));
        modules = { ...vendors[1], ...Index[1], ...(Runtime ? Runtime[1] : {}) };
    }
    const spineres = extractSpine(modules, new URL('.', base).toString(), frame.contentWindow);
    console.log('Got Spine Data', spineres);
    const staticres = extractStaticFiles(modules, new URL('.', base).toString());
    console.log('Got Static Files', staticres);
    btn.innerText = 'Preparing resources...';
    const fn = (url.match(/event\/(.*?)\//) || ['', ''])[1].split('-')[0] || Date.now().toString();
    const fileStream = streamSaver.createWriteStream(fn + '.zip');
    const readableZipStream = new ZIP({
        async start(ctrl) {
            btn.innerText = 'Download started...';
            const savedIds = [];
            // save spine json & atlas
            for (const i of Object.keys(spineres.SPINE_MANIFEST)) {
                const dir = spineres.SPINE_MANIFEST[i].module || '';
                const atlas = new File([spineres.SPINE_MANIFEST[i].atlas], dir + '/' + i + '.atlas', {
                    type: 'text/plain',
                });
                ctrl.enqueue(atlas);
                const j = spineres.SPINE_MANIFEST[i].json;
                if (typeof j === 'string' && j.indexOf('http') === 0) {
                    savedIds.push(j);
                    ctrl.enqueue(await fetchToZip(dir + '/' + i + '.json', j));
                } else {
                    const json = new File([JSON.stringify(j, null, 4)], dir + '/' + i + '.json', {
                        type: 'application/json',
                    });
                    ctrl.enqueue(json);
                }
            }
            // save images
            const promises = Object.values(spineres.MAIN_MANIFEST).map((e) => {
                const dir = e.module || '';
                const fn = dir + '/' + e.id + '.' + extname(e.src);
                savedIds.push(e.src);
                return fetchToZip(fn, e.src).then((res) => ctrl.enqueue(res));
            });
            // save other static
            let otherlen = 0;
            const staticPromises = staticres.map((e) => {
                //skip things in savedIds
                if (savedIds.includes(e.src)) {
                    return Promise.resolve();
                }
                const dir = '_other_resources';
                const fn = dir + '/' + e.id + '.' + extname(e.src);
                savedIds.push(e.src);
                otherlen++;
                return fetchToZip(fn, e.src).then((res) => ctrl.enqueue(res));
            });
            desc.innerText =
                `Extracted ${Object.keys(spineres.SPINE_MANIFEST).length} spine(s), ` +
                `${Object.keys(spineres.MAIN_MANIFEST).length} render-related image(s), ` +
                `${otherlen} other resource(s)`;
            await Promise.all(promises.concat(staticPromises));
            ctrl.close();
        },
    });
    if (window.WritableStream && readableZipStream.pipeTo) {
        await readableZipStream.pipeTo(fileStream);
        btn.innerText = 'Done';
    } else {
        btn.innerText = 'FileWriter Unsupported!';
    }
}
async function clk() {
    btn.disabled = true;
    try {
        await extract(url.value);
    } catch (e) {
        console.error(e);
        btn.innerText = 'Error!';
    }
    btn.disabled = false;
}
