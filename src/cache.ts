import * as AST from './ast';

interface CacheEntry {
    key: string;
    source: string; // For collision detection
    program: AST.Program;
}

/**
 * Simple hash function that works in both Node.js and browser.
 * Uses djb2 algorithm for fast, consistent hashing.
 */
function simpleHash(str: string): string {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * LRU Cache for parsed AST programs.
 * Avoids re-parsing identical scripts.
 */
export class ASTCache {
    private capacity: number;
    private cache: Map<string, CacheEntry>;

    constructor(capacity = 1000) {
        this.capacity = capacity;
        this.cache = new Map();
    }

    /**
     * Generate hash for source code.
     */
    private hash(source: string): string {
        return simpleHash(source);
    }

    /**
     * Retrieve cached AST program.
     * Returns undefined if not found or source mismatch (collision).
     */
    get(source: string): AST.Program | undefined {
        const key = this.hash(source);
        const entry = this.cache.get(key);

        if (!entry) return undefined;

        // Collision detection
        if (entry.source !== source) return undefined;

        // Move to end (most recently used)
        this.cache.delete(key);
        this.cache.set(key, entry);

        return entry.program;
    }

    /**
     * Store AST program in cache.
     */
    set(source: string, program: AST.Program): void {
        const key = this.hash(source);

        // Remove existing
        this.cache.delete(key);

        // Evict oldest if at capacity
        if (this.cache.size >= this.capacity) {
            const oldest = this.cache.keys().next().value;
            if (oldest) this.cache.delete(oldest);
        }

        this.cache.set(key, { key, source, program });
    }

    /**
     * Clear all cached entries.
     */
    clear(): void {
        this.cache.clear();
    }

    /**
     * Get number of cached entries.
     */
    size(): number {
        return this.cache.size;
    }
}

/** Global default cache instance */
export const defaultCache = new ASTCache(1000);
