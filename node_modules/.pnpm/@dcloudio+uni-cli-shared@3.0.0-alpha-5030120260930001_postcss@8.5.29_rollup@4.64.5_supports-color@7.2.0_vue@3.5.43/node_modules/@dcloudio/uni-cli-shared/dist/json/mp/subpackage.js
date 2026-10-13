"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseIndependentVirtualRoot = exports.parseIndependentMainRoot = exports.formatIndependentVirtualId = exports.hasIndependentRoot = exports.withoutIndependentRoot = exports.withIndependentRoot = exports.parseIndependentRoot = exports.normalizeIndependentRoot = exports.stringifyIndependentRoots = exports.isAppPagesJson = exports.isInIndependentRoot = exports.withIndependentRootIfNeeded = exports.resolveIndependentRoot = exports.getIndependentRootByFilename = exports.getIndependentRoots = exports.getIndependentSubPackages = exports.setIndependentSubPackages = exports.parseIndependentSubPackages = exports.MP_INDEPENDENT_VIRTUAL_ROOT_QUERY = exports.MP_INDEPENDENT_MAIN_PREFIX = exports.MP_INDEPENDENT_ROOT_QUERY = void 0;
const path_1 = __importDefault(require("path"));
const utils_1 = require("../../utils");
exports.MP_INDEPENDENT_ROOT_QUERY = 'uni_mp_independent_root';
exports.MP_INDEPENDENT_MAIN_PREFIX = '\0uni:mp-independent-main';
exports.MP_INDEPENDENT_VIRTUAL_ROOT_QUERY = 'root';
function parseIndependentSubPackages(pagesJson) {
    if (!pagesJson) {
        return [];
    }
    const subPackages = pagesJson.subPackages || pagesJson.subpackages || [];
    if (!Array.isArray(subPackages)) {
        return [];
    }
    return subPackages.reduce((packages, subPackage) => {
        if (!subPackage || subPackage.independent !== true) {
            return packages;
        }
        const root = normalizeSubPackageRoot(subPackage.root);
        const pages = normalizeSubPackagePages(subPackage.pages);
        if (!root || !pages.length) {
            return packages;
        }
        packages.push({
            root,
            pages,
            independent: true,
        });
        return packages;
    }, []);
}
exports.parseIndependentSubPackages = parseIndependentSubPackages;
let independentSubPackages = [];
let independentRootMatchers = [];
function setIndependentSubPackages(packages) {
    independentSubPackages = packages.reduce((result, pkg) => {
        const root = normalizeIndependentRoot(pkg.root);
        if (root) {
            result.push({
                ...pkg,
                root,
            });
        }
        return result;
    }, []);
    independentRootMatchers = independentSubPackages
        .map(({ root }) => ({
        root,
        normalizedRoot: root,
    }))
        .sort((a, b) => b.normalizedRoot.length - a.normalizedRoot.length);
}
exports.setIndependentSubPackages = setIndependentSubPackages;
function getIndependentSubPackages() {
    return independentSubPackages;
}
exports.getIndependentSubPackages = getIndependentSubPackages;
function getIndependentRoots() {
    return new Set(independentSubPackages.map(({ root }) => root));
}
exports.getIndependentRoots = getIndependentRoots;
function getIndependentRootByFilename(filename, inputDir) {
    const cleanFilename = splitIdQuery(withoutIndependentRoot(filename)).filename;
    if (!inputDir || !path_1.default.isAbsolute(cleanFilename)) {
        return;
    }
    const relativeFilename = (0, utils_1.normalizePath)(path_1.default.relative(inputDir, cleanFilename));
    const matcher = independentRootMatchers.find(({ normalizedRoot }) => {
        return (relativeFilename === normalizedRoot ||
            relativeFilename.startsWith(`${normalizedRoot}/`));
    });
    return matcher?.root;
}
exports.getIndependentRootByFilename = getIndependentRootByFilename;
function resolveIndependentRoot(id, importer, inputDir, platform) {
    if (!platform?.startsWith('mp-')) {
        return;
    }
    const root = parseIndependentRoot(id) ||
        (importer
            ? parseIndependentRoot(importer) ||
                getIndependentRootByFilename(importer, inputDir)
            : undefined);
    const normalizedRoot = root && normalizeIndependentRoot(root);
    if (normalizedRoot && getIndependentRoots().has(normalizedRoot)) {
        return normalizedRoot;
    }
}
exports.resolveIndependentRoot = resolveIndependentRoot;
function withIndependentRootIfNeeded(id, root, inputDir) {
    if (!root ||
        !inputDir ||
        parseIndependentRoot(id) ||
        isIndependentStyleRequest(id)) {
        return id;
    }
    if (isInIndependentRoot(id, inputDir, root) || isAppPagesJson(id, inputDir)) {
        return withIndependentRoot(id, root);
    }
    return id;
}
exports.withIndependentRootIfNeeded = withIndependentRootIfNeeded;
function isInIndependentRoot(filename, inputDir, root) {
    const cleanFilename = (0, utils_1.normalizePath)(withoutIndependentRoot(filename)).split('?')[0];
    const normalizedInputDir = (0, utils_1.normalizePath)(inputDir);
    const normalizedRoot = normalizeIndependentRoot(root);
    const rootDir = `${normalizedInputDir}/${normalizedRoot}`;
    return cleanFilename === rootDir || cleanFilename.startsWith(`${rootDir}/`);
}
exports.isInIndependentRoot = isInIndependentRoot;
function isAppPagesJson(filename, inputDir) {
    const cleanFilename = (0, utils_1.normalizePath)(withoutIndependentRoot(filename)).split('?')[0];
    const pagesJson = (0, utils_1.normalizePath)(path_1.default.join(inputDir, 'pages.json'));
    // uni-app x 的 UTS resolver 会把 JSON 文件映射为 .json.ts 参与类型编译。
    return cleanFilename === pagesJson || cleanFilename === `${pagesJson}.ts`;
}
exports.isAppPagesJson = isAppPagesJson;
function stringifyIndependentRoots(packages) {
    return packages
        .map(({ root }) => normalizeIndependentRoot(root))
        .filter(Boolean)
        .sort()
        .join('\n');
}
exports.stringifyIndependentRoots = stringifyIndependentRoots;
function normalizeIndependentRoot(root) {
    return (0, utils_1.normalizePath)(root).replace(/^\/+|\/+$/g, '');
}
exports.normalizeIndependentRoot = normalizeIndependentRoot;
function isIndependentStyleRequest(id) {
    const cleanId = withoutIndependentRoot(id);
    // 这里保持独立判断，避免 json/mp 基础能力反向依赖 Vite CSS 插件实现。
    return /\.(?:css|less|sass|scss|styl|stylus|pcss|postcss)(?:$|\?)/.test(cleanId);
}
function normalizeSubPackageRoot(root) {
    if (typeof root !== 'string') {
        return '';
    }
    return normalizeIndependentRoot(root.trim());
}
function normalizeSubPackagePages(pages) {
    if (!Array.isArray(pages)) {
        return [];
    }
    return pages.reduce((paths, page) => {
        if (typeof page === 'string' && page) {
            paths.push((0, utils_1.normalizePath)(page));
        }
        else if (page && typeof page.path === 'string' && page.path) {
            paths.push((0, utils_1.normalizePath)(page.path));
        }
        return paths;
    }, []);
}
function parseIndependentRoot(id) {
    const query = splitIdQuery(id).query;
    if (!query) {
        return;
    }
    for (const item of query.split('&')) {
        const [name, value = ''] = splitQueryItem(item);
        if (name === exports.MP_INDEPENDENT_ROOT_QUERY) {
            return decodeURIComponent(value);
        }
    }
}
exports.parseIndependentRoot = parseIndependentRoot;
function withIndependentRoot(id, root) {
    const cleanId = withoutIndependentRoot(id);
    const { filename, query } = splitIdQuery(cleanId);
    const rootQuery = `${exports.MP_INDEPENDENT_ROOT_QUERY}=${encodeURIComponent(root)}`;
    return `${(0, utils_1.normalizePath)(filename)}?${query ? query + '&' : ''}${rootQuery}`;
}
exports.withIndependentRoot = withIndependentRoot;
function withoutIndependentRoot(id) {
    const { filename, query } = splitIdQuery(id);
    if (!query) {
        return id;
    }
    const nextQuery = query
        .split('&')
        .filter((item) => splitQueryItem(item)[0] !== exports.MP_INDEPENDENT_ROOT_QUERY)
        .join('&');
    return nextQuery ? `${filename}?${nextQuery}` : filename;
}
exports.withoutIndependentRoot = withoutIndependentRoot;
function hasIndependentRoot(id) {
    return parseIndependentRoot(id) !== undefined;
}
exports.hasIndependentRoot = hasIndependentRoot;
function formatIndependentVirtualId(prefix, root) {
    return `${prefix}?${exports.MP_INDEPENDENT_VIRTUAL_ROOT_QUERY}=${encodeURIComponent(root)}`;
}
exports.formatIndependentVirtualId = formatIndependentVirtualId;
function parseIndependentMainRoot(id) {
    return parseIndependentVirtualRoot(id, exports.MP_INDEPENDENT_MAIN_PREFIX);
}
exports.parseIndependentMainRoot = parseIndependentMainRoot;
function parseIndependentVirtualRoot(id, prefix) {
    if (!id.startsWith(`${prefix}?`)) {
        return;
    }
    const { query } = splitIdQuery(id);
    if (!query) {
        return;
    }
    for (const item of query.split('&')) {
        const [name, value = ''] = splitQueryItem(item);
        if (name === exports.MP_INDEPENDENT_VIRTUAL_ROOT_QUERY) {
            return decodeURIComponent(value);
        }
    }
}
exports.parseIndependentVirtualRoot = parseIndependentVirtualRoot;
function splitIdQuery(id) {
    const queryIndex = id.indexOf('?');
    if (queryIndex === -1) {
        return { filename: id, query: '' };
    }
    return {
        filename: id.slice(0, queryIndex),
        query: id.slice(queryIndex + 1),
    };
}
function splitQueryItem(item) {
    const equalIndex = item.indexOf('=');
    if (equalIndex === -1) {
        return [item, ''];
    }
    return [item.slice(0, equalIndex), item.slice(equalIndex + 1)];
}
