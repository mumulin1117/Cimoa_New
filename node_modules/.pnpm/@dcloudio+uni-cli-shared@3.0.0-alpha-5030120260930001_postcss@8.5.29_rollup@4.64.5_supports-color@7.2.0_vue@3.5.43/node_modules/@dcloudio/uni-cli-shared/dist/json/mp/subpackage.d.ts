export declare const MP_INDEPENDENT_ROOT_QUERY = "uni_mp_independent_root";
export declare const MP_INDEPENDENT_MAIN_PREFIX = "\0uni:mp-independent-main";
export declare const MP_INDEPENDENT_VIRTUAL_ROOT_QUERY = "root";
export interface IndependentSubPackage {
    root: string;
    pages: string[];
    independent: true;
}
export declare function parseIndependentSubPackages(pagesJson: UniApp.PagesJson | undefined): IndependentSubPackage[];
export declare function setIndependentSubPackages(packages: IndependentSubPackage[]): void;
export declare function getIndependentSubPackages(): IndependentSubPackage[];
export declare function getIndependentRoots(): Set<string>;
export declare function getIndependentRootByFilename(filename: string, inputDir: string | undefined): string | undefined;
export declare function resolveIndependentRoot(id: string, importer: string | undefined, inputDir: string | undefined, platform: string | undefined): string | undefined;
export declare function withIndependentRootIfNeeded(id: string, root: string | undefined, inputDir: string | undefined): string;
export declare function isInIndependentRoot(filename: string, inputDir: string, root: string): boolean;
export declare function isAppPagesJson(filename: string, inputDir: string): boolean;
export declare function stringifyIndependentRoots(packages: IndependentSubPackage[]): string;
export declare function normalizeIndependentRoot(root: string): string;
export declare function parseIndependentRoot(id: string): string | undefined;
export declare function withIndependentRoot(id: string, root: string): string;
export declare function withoutIndependentRoot(id: string): string;
export declare function hasIndependentRoot(id: string): boolean;
export declare function formatIndependentVirtualId(prefix: string, root: string): string;
export declare function parseIndependentMainRoot(id: string): string | undefined;
export declare function parseIndependentVirtualRoot(id: string, prefix: string): string | undefined;
