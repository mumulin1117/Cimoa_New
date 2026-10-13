"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.withoutIndependentRoot = exports.withIndependentRootIfNeeded = exports.withIndependentRoot = exports.stringifyIndependentRoots = exports.setIndependentSubPackages = exports.resolveIndependentRoot = exports.parseIndependentVirtualRoot = exports.parseIndependentSubPackages = exports.parseIndependentRoot = exports.parseIndependentMainRoot = exports.normalizeIndependentRoot = exports.isInIndependentRoot = exports.isAppPagesJson = exports.hasIndependentRoot = exports.getIndependentSubPackages = exports.getIndependentRoots = exports.getIndependentRootByFilename = exports.formatIndependentVirtualId = exports.MP_INDEPENDENT_VIRTUAL_ROOT_QUERY = exports.MP_INDEPENDENT_MAIN_PREFIX = exports.MP_INDEPENDENT_ROOT_QUERY = exports.parseMiniProgramProjectJson = exports.parseMiniProgramPagesJson = exports.mergeMiniProgramAppJson = void 0;
__exportStar(require("./jsonFile"), exports);
var pages_1 = require("./pages");
Object.defineProperty(exports, "mergeMiniProgramAppJson", { enumerable: true, get: function () { return pages_1.mergeMiniProgramAppJson; } });
Object.defineProperty(exports, "parseMiniProgramPagesJson", { enumerable: true, get: function () { return pages_1.parseMiniProgramPagesJson; } });
var project_1 = require("./project");
Object.defineProperty(exports, "parseMiniProgramProjectJson", { enumerable: true, get: function () { return project_1.parseMiniProgramProjectJson; } });
var subpackage_1 = require("./subpackage");
Object.defineProperty(exports, "MP_INDEPENDENT_ROOT_QUERY", { enumerable: true, get: function () { return subpackage_1.MP_INDEPENDENT_ROOT_QUERY; } });
Object.defineProperty(exports, "MP_INDEPENDENT_MAIN_PREFIX", { enumerable: true, get: function () { return subpackage_1.MP_INDEPENDENT_MAIN_PREFIX; } });
Object.defineProperty(exports, "MP_INDEPENDENT_VIRTUAL_ROOT_QUERY", { enumerable: true, get: function () { return subpackage_1.MP_INDEPENDENT_VIRTUAL_ROOT_QUERY; } });
Object.defineProperty(exports, "formatIndependentVirtualId", { enumerable: true, get: function () { return subpackage_1.formatIndependentVirtualId; } });
Object.defineProperty(exports, "getIndependentRootByFilename", { enumerable: true, get: function () { return subpackage_1.getIndependentRootByFilename; } });
Object.defineProperty(exports, "getIndependentRoots", { enumerable: true, get: function () { return subpackage_1.getIndependentRoots; } });
Object.defineProperty(exports, "getIndependentSubPackages", { enumerable: true, get: function () { return subpackage_1.getIndependentSubPackages; } });
Object.defineProperty(exports, "hasIndependentRoot", { enumerable: true, get: function () { return subpackage_1.hasIndependentRoot; } });
Object.defineProperty(exports, "isAppPagesJson", { enumerable: true, get: function () { return subpackage_1.isAppPagesJson; } });
Object.defineProperty(exports, "isInIndependentRoot", { enumerable: true, get: function () { return subpackage_1.isInIndependentRoot; } });
Object.defineProperty(exports, "normalizeIndependentRoot", { enumerable: true, get: function () { return subpackage_1.normalizeIndependentRoot; } });
Object.defineProperty(exports, "parseIndependentMainRoot", { enumerable: true, get: function () { return subpackage_1.parseIndependentMainRoot; } });
Object.defineProperty(exports, "parseIndependentRoot", { enumerable: true, get: function () { return subpackage_1.parseIndependentRoot; } });
Object.defineProperty(exports, "parseIndependentSubPackages", { enumerable: true, get: function () { return subpackage_1.parseIndependentSubPackages; } });
Object.defineProperty(exports, "parseIndependentVirtualRoot", { enumerable: true, get: function () { return subpackage_1.parseIndependentVirtualRoot; } });
Object.defineProperty(exports, "resolveIndependentRoot", { enumerable: true, get: function () { return subpackage_1.resolveIndependentRoot; } });
Object.defineProperty(exports, "setIndependentSubPackages", { enumerable: true, get: function () { return subpackage_1.setIndependentSubPackages; } });
Object.defineProperty(exports, "stringifyIndependentRoots", { enumerable: true, get: function () { return subpackage_1.stringifyIndependentRoots; } });
Object.defineProperty(exports, "withIndependentRoot", { enumerable: true, get: function () { return subpackage_1.withIndependentRoot; } });
Object.defineProperty(exports, "withIndependentRootIfNeeded", { enumerable: true, get: function () { return subpackage_1.withIndependentRootIfNeeded; } });
Object.defineProperty(exports, "withoutIndependentRoot", { enumerable: true, get: function () { return subpackage_1.withoutIndependentRoot; } });
