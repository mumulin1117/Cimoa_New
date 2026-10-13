"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.defineUniManifestJsonPlugin = exports.defineUniPagesJsonPlugin = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const constants_1 = require("../../constants");
const subpackage_1 = require("../../json/mp/subpackage");
const utils_1 = require("../../utils");
exports.defineUniPagesJsonPlugin = createDefineJsonJsPlugin('pages.json');
exports.defineUniManifestJsonPlugin = createDefineJsonJsPlugin('manifest.json');
function createDefineJsonJsPlugin(name) {
    const JSON_JS = constants_1.JSON_JS_MAP[name];
    // pages-json-js 仅允许独立分包 root query；manifest-json-js 仍保持 app 级。
    const allowedQuery = name === 'pages.json' ? subpackage_1.MP_INDEPENDENT_ROOT_QUERY : '';
    return function (createVitePlugin) {
        const opts = {
            resolvedConfig: {},
            filter(id) {
                return !!parseJsonJsRequest(id, JSON_JS, allowedQuery);
            },
        };
        const plugin = createVitePlugin(opts);
        const origLoad = plugin.load;
        const origResolveId = plugin.resolveId;
        const origConfigResolved = plugin.configResolved;
        let jsonPath = '';
        let jsonJsPath = '';
        plugin.resolveId = function (id, importer, options) {
            const res = origResolveId && origResolveId.call(this, id, importer, options);
            if (res) {
                return res;
            }
            const jsonJsRequest = parseJsonJsRequest(id, JSON_JS, allowedQuery);
            if (jsonJsRequest) {
                return jsonJsPath + jsonJsRequest.query;
            }
        };
        plugin.configResolved = function (config) {
            opts.resolvedConfig = config;
            jsonPath = (0, utils_1.normalizePath)(path_1.default.join(process.env.UNI_INPUT_DIR, name));
            jsonJsPath = (0, utils_1.normalizePath)(path_1.default.join(process.env.UNI_INPUT_DIR, JSON_JS));
            return origConfigResolved && origConfigResolved(config);
        };
        plugin.load = function (id, ssr) {
            const res = origLoad && origLoad.call(this, id, ssr);
            if (res) {
                return res;
            }
            if (!opts.filter(id)) {
                return;
            }
            return fs_1.default.readFileSync(jsonPath, 'utf8');
        };
        return plugin;
    };
}
function parseJsonJsRequest(id, jsonJs, allowedQuery) {
    const queryIndex = id.indexOf('?');
    const query = queryIndex === -1 ? '' : id.slice(queryIndex + 1);
    if (query && !isAllowedJsonJsQuery(query, allowedQuery)) {
        return;
    }
    if (queryIndex !== -1 && !query) {
        return;
    }
    const filename = queryIndex === -1 ? id : id.slice(0, queryIndex);
    if (!filename.endsWith(jsonJs)) {
        return;
    }
    return {
        filename,
        query: queryIndex === -1 ? '' : id.slice(queryIndex),
    };
}
function isAllowedJsonJsQuery(query, allowedQuery) {
    if (!allowedQuery) {
        return false;
    }
    const items = query.split('&');
    if (items.length !== 1) {
        return false;
    }
    const item = items[0];
    const equalIndex = item.indexOf('=');
    if (equalIndex === -1) {
        return false;
    }
    return (item.slice(0, equalIndex) === allowedQuery &&
        item.slice(equalIndex + 1).length > 0);
}
